import mqttService from './mqttService.js';
import pool from '../config/db.js';

class AutomationService {
  constructor() {
    // Store automation state and configs
    this.automationModes = {
      auto: { active: false, config: {} },
      away: { active: false, config: {} },
      night: { active: false, config: {} },
      morning: { active: false, config: {} }
    };

    this.sensorData = {
      temperature: null,
      humidity: null,
      lastUpdate: null
    };

    // Track presence simulation
    this.presenceSimulation = null;

    // AUTO Mode settings
    this.autoModeSettings = {
      fanEnabled: true,
      fanTime: "08:00",
      fanTemperature: 28,
      lightEnabled: true,
      lightTime: "07:00",
    };

    // Track phút đã trigger để tránh trigger lặp hoặc bỏ sót
    this.lastFanTriggerMinute = null;
    this.lastLightTriggerMinute = null;

    // Load settings từ DB trước, sau đó mới setup monitoring
    // Dùng Promise thay vì setTimeout để đảm bảo thứ tự thực thi
    this._loadSettingsFromDb().then(() => {
      this.setupSensorMonitoring();
    });
  }

  /**
   * Load settings từ DB khi khởi động
   * Đảm bảo checkAutoModeSchedule dùng đúng giá trị user đã lưu, không dùng default
   */
  async _loadSettingsFromDb() {
    try {
      const [rows] = await pool.execute(
        'SELECT setting_key, setting_value FROM automation_settings'
      );
      if (rows.length > 0) {
        const fromDb = {};
        rows.forEach(row => { fromDb[row.setting_key] = row.setting_value; });

        const parseBool = (val, fallback) => {
          if (val === 'true' || val === '1' || val === true || val === 1) return true;
          if (val === 'false' || val === '0' || val === false || val === 0) return false;
          return fallback;
        };

        // Normalize HH:MM:SS → HH:MM (MySQL TIME type trả về có giây)
        const normalizeTime = (t) => (t && t.length > 5) ? t.slice(0, 5) : (t ?? null);
        this.autoModeSettings = {
          fanEnabled: parseBool(fromDb.fanEnabled, true),
          fanTime: normalizeTime(fromDb.fanTime) ?? this.autoModeSettings.fanTime,
          fanTemperature: Number(fromDb.fanTemperature ?? this.autoModeSettings.fanTemperature),
          lightEnabled: parseBool(fromDb.lightEnabled, true),
          lightTime: normalizeTime(fromDb.lightTime) ?? this.autoModeSettings.lightTime,
        };
        console.log(' [AutomationService] Settings loaded from DB on startup:', this.autoModeSettings);
      } else {
        console.log('ℹ️ [AutomationService] No settings in DB, using defaults');
      }
    } catch (error) {
      console.error('❌ [AutomationService] Failed to load settings on startup:', error.message);
    }
  }

  /**
   * ===== MORNING MODE =====
   * Fade-in effect from 5:45 AM to 6:00 AM
   * Color: Warm (red/orange) → Cool white
   * Fan: Speed 1
   */
  async executeMorningMode() {
    console.log('🌅 [Morning Mode] Starting fade-in effect at 5:45 AM');

    const startTime = new Date();
    startTime.setHours(5, 45, 0, 0);
    const endTime = new Date();
    endTime.setHours(6, 0, 0, 0);

    // Duration: 15 minutes (900 seconds)
    const duration = 15 * 60 * 1000;
    const steps = 30; // 30 steps over 15 minutes = 30 second intervals
    const stepDuration = duration / steps;

    // Warm color (red/orange): RGB(255, 140, 80) = decimal 16743760
    // Cool white: RGB(255, 255, 255) = decimal 16777215
    const warmColor = 16743760;
    const coolColor = 16777215;

    console.log(`🌅 [Morning Mode] Fade-in starting: ${startTime.toLocaleTimeString()}`);

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps; // 0 to 1
      const brightness = Math.round(5 + (95 * progress)); // 5% to 100%

      // Interpolate color: warm → cool
      const colorProgress = progress;
      const r = Math.round(255);
      const g = Math.round(140 + (115 * colorProgress)); // 140 → 255
      const b = Math.round(80 + (175 * colorProgress)); // 80 → 255

      // Convert RGB to decimal
      const color = (r << 16) | (g << 8) | b;

      try {
        // Update light color and brightness
        await mqttService.publishCommand('rgb-state', color.toString());
        console.log(`🌅 [Morning Mode] Step ${i + 1}/${steps + 1}: ${brightness}% brightness, Color: RGB(${r}, ${g}, ${b})`);

        // Wait before next step
        await new Promise(resolve => setTimeout(resolve, stepDuration));
      } catch (error) {
        console.error('❌ [Morning Mode] Error:', error.message);
      }
    }

    // Set fan to Speed 1
    try {
      await mqttService.publishCommand('fan-state', '1'); // Speed 1
      console.log('🌅 [Morning Mode] Fan set to Speed 1');
    } catch (error) {
      console.error('❌ [Morning Mode] Fan error:', error.message);
    }

    // Log the action
    await pool.execute(
      'INSERT INTO action_logs (device, action) VALUES (?, ?)',
      ['morning-mode', 'Fade-in complete - Light at 100% cool white, Fan Speed 1']
    );
  }

  /**
   * ===== NIGHT MODE =====
   * Activate at 22:30
   * - Dim light to 20% warm color
   * - Set fan to Auto mode
   * - Check if door is open → auto close
   * - Turn off TV
   */
  async executeNightMode() {
    console.log('🌙 [Night Mode] Activating at 22:30');

    try {
      // 1. Set light to 20% warm color (orange/yellow)
      // Warm amber: RGB(255, 180, 0) = decimal 16757760
      const warmAmber = 16757760;
      await mqttService.publishCommand('rgb-state', warmAmber.toString());
      console.log('🌙 [Night Mode] Light set to 20% warm amber');

      // 2. Set fan to Auto mode (Speed 3)
      await mqttService.publishCommand('fan-state', '3'); // Speed 3 = Auto
      console.log('🌙 [Night Mode] Fan set to Auto mode');

      // 3. Check garage door status - auto close if open
      const [doorResult] = await pool.execute(
        'SELECT status FROM devices WHERE feed_key = ?',
        ['door']
      );

      if (doorResult.length > 0 && doorResult[0].status === 'OPEN') {
        console.log('🌙 [Night Mode] Door is OPEN - auto closing...');
        await mqttService.publishCommand('door', '0'); // Close door
        await pool.execute(
          'INSERT INTO action_logs (device, action) VALUES (?, ?)',
          ['door', 'Auto-closed during Night Mode']
        );
      }

      // 4. Turn off TV
      await mqttService.publishCommand('tv-state', '0');
      console.log('🌙 [Night Mode] TV turned OFF');

      // Log the action
      await pool.execute(
        'INSERT INTO action_logs (device, action) VALUES (?, ?)',
        ['night-mode', 'Activated - Light 20% warm, Fan Auto, Door checked, TV off']
      );
    } catch (error) {
      console.error('❌ [Night Mode] Error:', error.message);
    }
  }

  /**
   * ===== AWAY MODE =====
   * - Turn off all devices (Master Switch)
   * - Lock garage door
   * - Start presence simulation (random light toggle 19:00-22:00)
   */
  async executeAwayMode(activate = true) {
    console.log(`🚗 [Away Mode] ${activate ? 'Activating' : 'Deactivating'}`);

    try {
      if (activate) {
        // 1. Turn off all lights
        await mqttService.publishCommand('rgb-state', '0');
        console.log('🚗 [Away Mode] All lights OFF');

        // 2. Turn off fan
        await mqttService.publishCommand('fan-state', '0'); // OFF
        console.log('🚗 [Away Mode] Fan OFF');

        // 3. Turn off TV
        await mqttService.publishCommand('tv-state', '0');
        console.log('🚗 [Away Mode] TV OFF');

        // 4. Close and lock garage door
        await mqttService.publishCommand('door', '0');
        console.log('🚗 [Away Mode] Garage door CLOSED');

        // 5. Start presence simulation
        this.startPresenceSimulation();

        // Log the action
        await pool.execute(
          'INSERT INTO action_logs (device, action) VALUES (?, ?)',
          ['away-mode', 'Activated - All devices OFF, Door locked, Presence simulation ON']
        );
      } else {
        // Deactivate
        if (this.presenceSimulation) {
          clearInterval(this.presenceSimulation);
          this.presenceSimulation = null;
          console.log('🚗 [Away Mode] Presence simulation stopped');
        }

        await pool.execute(
          'INSERT INTO action_logs (device, action) VALUES (?, ?)',
          ['away-mode', 'Deactivated - Presence simulation stopped']
        );
      }
    } catch (error) {
      console.error('❌ [Away Mode] Error:', error.message);
    }
  }

  /**
   * ===== PRESENCE SIMULATION =====
   * Random light toggle between 19:00 and 22:00
   */
  startPresenceSimulation() {
    if (this.presenceSimulation) {
      clearInterval(this.presenceSimulation);
    }

    console.log('🎭 [Presence Simulation] Starting');

    // Run every 10-30 minutes between 19:00 and 22:00
    this.presenceSimulation = setInterval(async () => {
      const now = new Date();
      const hour = now.getHours();

      // Only run between 19:00 (7 PM) and 22:00 (10 PM)
      if (hour >= 19 && hour < 22) {
        const randomOn = Math.random() > 0.5;
        const brightness = randomOn ? Math.floor(Math.random() * 100) + 50 : 0; // 50-100% or OFF

        try {
          if (randomOn) {
            // Set random warm color
            const colors = [16743760, 16757760, 16746224]; // Different warm tones
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            await mqttService.publishCommand('rgb-state', randomColor.toString());
            console.log(`🎭 [Presence Sim] Light ON at ${brightness}%`);
          } else {
            await mqttService.publishCommand('rgb-state', '0');
            console.log('🎭 [Presence Sim] Light OFF');
          }
        } catch (error) {
          console.error('❌ [Presence Sim] Error:', error.message);
        }
      }
    }, 10 * 60 * 1000); // Check every 10 minutes
  }

  /**
   * ===== AUTO MODE - Smart Sensor-Driven Controls =====
   * Listen to temperature/humidity changes and adjust devices automatically
   */
  setupSensorMonitoring() {
    // In a real implementation, this would listen to MQTT sensor streams
    // For now, we'll create a polling mechanism

    setInterval(async () => {
      if (!this.automationModes.auto.active) return;

      try {
        // Get latest sensor data
        const [result] = await pool.execute(
          'SELECT temperature, humidity FROM sensor_logs ORDER BY timestamp DESC LIMIT 1'
        );

        if (result.length > 0) {
          const { temperature, humidity } = result[0];
          this.sensorData = { temperature, humidity, lastUpdate: new Date() };

          // AUTO Mode: Smart Fan Control based on temperature threshold from settings
          await this.smartFanControlWithSettings(temperature);
          // Note: humidity is stored in sensorData for display only — no auto action taken
        }
      } catch (error) {
        console.error('❌ [AUTO Mode] Sensor monitoring error:', error.message);
      }
    }, 60 * 1000); // Check every 60 seconds
    // Also check schedule every minute
    setInterval(async () => {
      await this.checkAutoModeSchedule();
    }, 10 * 1000); // check mỗi 10 giây để không bỏ sót cửa sổ 1 phút

  }

  /**
   * Set automation mode active/inactive
   */
  async setModeStatus(mode, active) {
    this.automationModes[mode].active = active;
    console.log(`⚙️ [Automation] Mode "${mode}" set to ${active ? 'ACTIVE' : 'INACTIVE'}`);

    if (mode === 'away' && active) {
      await this.executeAwayMode(true);
    } else if (mode === 'away' && !active) {
      await this.executeAwayMode(false);
    }

    return { mode, active, success: true };
  }

  /**
   * Get current automation state
   */
  getAutomationState() {
    return {
      modes: this.automationModes,
      sensorData: this.sensorData
    };
  }

  /**
   * Get sensor data
   */
  getSensorData() {
    return this.sensorData;
  }


  /**
   * Smart Fan Control based on AUTO Mode settings
   * Checks if current temperature exceeds fanTemperature setting
   * Publishes fan-state (0=OFF, 1=Speed1, 2=Speed2, 3=Auto)
   */
  async smartFanControlWithSettings(temperature) {
    if (!this.automationModes.auto.active) return;
    if (!this.autoModeSettings.fanEnabled) return;

    const fanTempThreshold = Number(this.autoModeSettings.fanTemperature);

    if (temperature >= fanTempThreshold) {
      console.log(`🌡️ [AUTO Mode] Temperature ${temperature}°C >= Setting ${fanTempThreshold}°C → Turning on fan (fan-state=2)`);
      try {
        await mqttService.publishCommand('fan-state', '2');
        await pool.execute(
          'INSERT INTO action_logs (device, action) VALUES (?, ?)',
          ['auto-mode', `Fan auto-on by temperature: ${temperature}°C >= ${fanTempThreshold}°C`]
        );
      } catch (error) {
        console.error('❌ [AUTO Mode] Fan temperature control error:', error.message);
      }
    }
  }

  /**
   * Check and apply AUTO Mode scheduled tasks
   * This checks if current time matches fanTime or lightTime from settings
   */
  async checkAutoModeSchedule() {
    if (!this.automationModes.auto.active) return;

    // FIX: Dùng giờ Việt Nam thay vì giờ UTC của server/Docker (lệch +7 tiếng)
    const now = new Date();
    const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const hour = vnNow.getHours().toString().padStart(2, '0');
    const minute = vnNow.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hour}:${minute}`;

    // Key bao gồm CẢ NGÀY để trigger đúng mỗi ngày.
    // Bug cũ: chỉ dùng 'HH:MM' → sau khi trigger '07:00', ngày hôm sau
    // vẫn thấy lastXTriggerMinute === '07:00' === minuteKey → không bao giờ trigger lại.
    const dateStr = `${vnNow.getFullYear()}-${String(vnNow.getMonth() + 1).padStart(2, '0')}-${String(vnNow.getDate()).padStart(2, '0')}`;
    const minuteKey = `${dateStr}_${currentTime}`;

    // Check fan time — only if fan automation is enabled
    // trim() để loại bỏ khoảng trắng thừa có thể có từ DB
    const fanTimeNorm = (this.autoModeSettings.fanTime ?? '').trim().slice(0, 5);
    if (
      this.autoModeSettings.fanEnabled &&
      currentTime === fanTimeNorm &&
      this.lastFanTriggerMinute !== minuteKey
    ) {
      this.lastFanTriggerMinute = minuteKey;
      console.log(`🕐 [AUTO Mode] Fan auto-on time matched: ${currentTime} → fan-state=2`);
      try {
        await mqttService.publishCommand('fan-state', '2');
        await pool.execute(
          'INSERT INTO action_logs (device, action) VALUES (?, ?)',
          ['auto-mode', `Fan auto-on by schedule: ${currentTime}`]
        );
      } catch (error) {
        console.error('❌ [AUTO Mode] Fan schedule error:', error.message);
      }
    }

    // Check light time — only if light automation is enabled
    // trim() để loại bỏ khoảng trắng thừa có thể có từ DB
    const lightTimeNorm = (this.autoModeSettings.lightTime ?? '').trim().slice(0, 5);
    if (
      this.autoModeSettings.lightEnabled &&
      currentTime === lightTimeNorm &&
      this.lastLightTriggerMinute !== minuteKey
    ) {
      this.lastLightTriggerMinute = minuteKey;
      console.log(`🕐 [AUTO Mode] Light auto-on time matched: ${currentTime} → rgb-state=16757760`);
      try {
        await mqttService.publishCommand('rgb-state', '16757760');
        await pool.execute(
          'INSERT INTO action_logs (device, action) VALUES (?, ?)',
          ['auto-mode', `Light auto-on by schedule: ${currentTime}`]
        );
      } catch (error) {
        console.error('❌ [AUTO Mode] Light schedule error:', error.message);
      }
    }
  }

  /**
   * Get AUTO Mode settings - load from DB first, fallback to memory
   */
  async getAutoModeSettings() {
    try {
      const [rows] = await pool.execute(
        'SELECT setting_key, setting_value FROM automation_settings'
      );

      if (rows.length > 0) {
        const fromDb = {};
        rows.forEach(row => { fromDb[row.setting_key] = row.setting_value; });

        // parseBool: DB lưu string "true"/"false", Number("true")=NaN nên KHÔNG dùng Boolean(Number())
        const parseBool = (val, fallback) => {
          if (val === 'true' || val === '1' || val === true || val === 1) return true;
          if (val === 'false' || val === '0' || val === false || val === 0) return false;
          return fallback;
        };

        // Normalize HH:MM:SS → HH:MM (MySQL TIME type trả về có giây)
        const normalizeTime = (t) => (t && t.length > 5) ? t.slice(0, 5) : (t ?? null);
        this.autoModeSettings = {
          fanEnabled: parseBool(fromDb.fanEnabled, true),
          fanTime: normalizeTime(fromDb.fanTime) ?? this.autoModeSettings.fanTime,
          fanTemperature: Number(fromDb.fanTemperature ?? this.autoModeSettings.fanTemperature),
          lightEnabled: parseBool(fromDb.lightEnabled, true),
          lightTime: normalizeTime(fromDb.lightTime) ?? this.autoModeSettings.lightTime,
        };
      }
    } catch (error) {
      console.error('❌ [AUTO Mode] Failed to load settings from DB:', error.message);
    }

    return this.autoModeSettings;
  }

  /**
   * Set AUTO Mode settings - persist to DB
   */
  async setAutoModeSettings(settings) {
    // parseBool: xử lý boolean JS, string "true"/"false", number 1/0
    const parseBool = (val, fallback) => {
      if (val === 'true' || val === '1' || val === true || val === 1) return true;
      if (val === 'false' || val === '0' || val === false || val === 0) return false;
      return fallback;
    };

    // Lưu lại trạng thái enabled trước khi thay đổi để so sánh
    const prevFanEnabled = this.autoModeSettings.fanEnabled;
    const prevLightEnabled = this.autoModeSettings.lightEnabled;
    const prevFanTime = this.autoModeSettings.fanTime;
    const prevLightTime = this.autoModeSettings.lightTime;

    // Normalize HH:MM:SS → HH:MM phòng trường hợp frontend hoặc DB gửi có giây
    const normalizeTime = (t) => (t && t.length > 5) ? t.slice(0, 5) : (t ?? null);
    this.autoModeSettings = {
      fanEnabled: parseBool(settings.fanEnabled, this.autoModeSettings.fanEnabled),
      fanTime: normalizeTime(settings.fanTime) ?? this.autoModeSettings.fanTime,
      fanTemperature: Number(settings.fanTemperature ?? this.autoModeSettings.fanTemperature), // luôn lưu dạng number để so sánh nhiệt độ đúng
      lightEnabled: parseBool(settings.lightEnabled, this.autoModeSettings.lightEnabled),
      lightTime: normalizeTime(settings.lightTime) ?? this.autoModeSettings.lightTime,
    };

    // Nếu giờ hẹn thay đổi → reset trigger cache về null để giờ mới được nhận diện đúng.
    // minuteKey đã bao gồm ngày (YYYY-MM-DD_HH:MM) nên không lo trigger lặp vào ngày hôm sau.
    if (this.autoModeSettings.fanTime !== prevFanTime) {
      this.lastFanTriggerMinute = null;
      console.log(`⚙️ [AUTO Mode] Fan schedule changed to ${this.autoModeSettings.fanTime} — trigger cache reset`);
    }
    if (this.autoModeSettings.lightTime !== prevLightTime) {
      this.lastLightTriggerMinute = null;
      console.log(`⚙️ [AUTO Mode] Light schedule changed to ${this.autoModeSettings.lightTime} — trigger cache reset`);
    }

    try {
      // Upsert each setting key into DB
      const entries = Object.entries(this.autoModeSettings);
      for (const [key, value] of entries) {
        await pool.execute(
          `INSERT INTO automation_settings (setting_key, setting_value)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [key, value !== null && value !== undefined ? String(value) : null]
        );
      }
      console.log(`⚙️ [AUTO Mode Settings] Saved to DB:`, this.autoModeSettings);
    } catch (error) {
      console.error('❌ [AUTO Mode] Failed to save settings to DB:', error.message);
    }

    // Chỉ áp dụng ngay lên thiết bị khi trạng thái enabled/disabled thay đổi
    // KHÔNG bật/tắt thiết bị khi user chỉ điều chỉnh giờ hẹn hoặc ngưỡng nhiệt độ
    if (this.automationModes.auto.active) {
      const fanEnabledChanged = this.autoModeSettings.fanEnabled !== prevFanEnabled;
      const lightEnabledChanged = this.autoModeSettings.lightEnabled !== prevLightEnabled;
      if (fanEnabledChanged || lightEnabledChanged) {
        await this._applySettingsNow(fanEnabledChanged, lightEnabledChanged);
      }
    }

    return this.autoModeSettings;
  }

  /**
   * Áp dụng settings ngay lên thiết bị khi AUTO Mode đang bật.
   * Chỉ áp dụng thiết bị có trạng thái enabled/disabled thay đổi.
   * KHÔNG gọi hàm này khi user chỉ đổi giờ hoặc ngưỡng nhiệt độ.
   *
   * @param {boolean} applyFan   - true nếu trạng thái fanEnabled vừa thay đổi
   * @param {boolean} applyLight - true nếu trạng thái lightEnabled vừa thay đổi
   */
  async _applySettingsNow(applyFan = true, applyLight = true) {
    console.log(' [AUTO Mode] Applying changed enabled-state to devices...');

    if (applyFan) {
      try {
        if (this.autoModeSettings.fanEnabled) {
          await mqttService.publishCommand('fan-state', '2');
          console.log(' [AUTO Mode] Fan turned ON (fan-state=2)');
        } else {
          await mqttService.publishCommand('fan-state', '0');
          console.log(' [AUTO Mode] Fan turned OFF (fan-state=0)');
        }
      } catch (error) {
        console.error('❌ [AUTO Mode] Failed to apply fan state:', error.message);
      }
    }

    if (applyLight) {
      try {
        if (this.autoModeSettings.lightEnabled) {
          await mqttService.publishCommand('rgb-state', '16757760');
          console.log(' [AUTO Mode] Light turned ON (rgb-state=16757760)');
        } else {
          await mqttService.publishCommand('rgb-state', '0');
          console.log(' [AUTO Mode] Light turned OFF (rgb-state=0)');
        }
      } catch (error) {
        console.error('❌ [AUTO Mode] Failed to apply light state:', error.message);
      }
    }

    try {
      await pool.execute(
        'INSERT INTO action_logs (device, action) VALUES (?, ?)',
        ['auto-mode', `Enabled-state applied: fan=${this.autoModeSettings.fanEnabled} (changed=${applyFan}), light=${this.autoModeSettings.lightEnabled} (changed=${applyLight})`]
      );
    } catch (_) { }
  }

}

export default new AutomationService();
import mqttService from './mqttService.js';
import pool from '../config/db.js';

class AutomationService {
  constructor() {
    // Store automation state and configs
    this.automationModes = {
      auto: { active: true, config: {} },
      away: { active: false, config: {} },
      night: { active: false, config: {} },
      morning: { active: true, config: {} }
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
      fanTime: "08:00",
      lightTime: "07:00",
      fanTemperature: 28
    };

    // Real-time sensor monitoring
    this.setupSensorMonitoring();
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
      await mqttService.publishCommand('fan-speed', '50'); // 50 = Speed 1
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
      await mqttService.publishCommand('fan-speed', '150');
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
        await mqttService.publishCommand('fan-speed', '0');
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

          // Smart Fan Control based on temperature
          await this.smartFanControl(temperature);

          // Humidity check and alert
          await this.humidityCheck(humidity);

                  // AUTO Mode: Smart Fan Control with settings
                  await this.smartFanControlWithSettings(temperature);
        }
      } catch (error) {
        console.error('❌ [AUTO Mode] Sensor monitoring error:', error.message);
      }
    }, 60 * 1000); // Check every 60 seconds
    // Also check schedule every minute
    setInterval(async () => {
      await this.checkAutoModeSchedule();
    }, 60 * 1000);

  }

  /**
   * Smart Fan Control: Adjust fan speed based on temperature
   */
  async smartFanControl(temperature) {
    let targetSpeed = 1; // Default Speed 1

    if (temperature > 32) {
      targetSpeed = 3; // High speed if > 32°C
      console.log(`❄️ [Smart Fan] Temp ${temperature}°C > 32°C → Fan Speed 3`);
    } else if (temperature > 28) {
      targetSpeed = 2; // Medium speed if 28-32°C
      console.log(`❄️ [Smart Fan] Temp ${temperature}°C > 28°C → Fan Speed 2`);
    } else if (temperature < 26) {
      targetSpeed = 1; // Low speed if < 26°C
      console.log(`❄️ [Smart Fan] Temp ${temperature}°C < 26°C → Fan Speed 1`);
    }

    try {
      // Convert UI level to backend value: 1=50, 2=100, 3=150
      const speedValue = targetSpeed === 3 ? 150 : targetSpeed === 2 ? 100 : 50;
      await mqttService.publishCommand('fan-speed', speedValue.toString());
    } catch (error) {
      console.error('❌ [Smart Fan] Error:', error.message);
    }
  }

  /**
   * Humidity Check: Alert and adjust if humidity > 80%
   */
  async humidityCheck(humidity) {
    if (humidity > 80) {
      console.log(`💧 [Humidity Alert] Humidity ${humidity}% > 80% → Enabling air circulation`);

      try {
        // Turn on fan at low speed
        await mqttService.publishCommand('fan-speed', '50');

        // Change light to warm color to create "dry" feeling
        const warmColor = 16757760;
        await mqttService.publishCommand('rgb-state', warmColor.toString());

        // Log alert
        await pool.execute(
          'INSERT INTO action_logs (device, action) VALUES (?, ?)',
          ['humidity-alert', `High humidity ${humidity}% - Auto fan ON, color warm`]
        );

        console.log('💧 [Humidity] Fan ON, light color warm');
      } catch (error) {
        console.error('❌ [Humidity Check] Error:', error.message);
      }
    }
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
   */
  async smartFanControlWithSettings(temperature) {
    if (!this.automationModes.auto.active) return;

    const fanTempThreshold = this.autoModeSettings.fanTemperature;
    
    if (temperature >= fanTempThreshold) {
      console.log(`🌡️ [AUTO Mode] Temperature ${temperature}°C >= Setting ${fanTempThreshold}°C → Turning on fan`);
      try {
        await mqttService.publishCommand('fan-speed', '100'); // Turn on fan at medium speed
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

    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                        now.getMinutes().toString().padStart(2, '0');

    // Check fan time
    if (currentTime === this.autoModeSettings.fanTime) {
      console.log(`🕐 [AUTO Mode] Fan auto-on time matched: ${currentTime}`);
      try {
        await mqttService.publishCommand('fan-speed', '50'); // Turn on fan
        await pool.execute(
          'INSERT INTO action_logs (device, action) VALUES (?, ?)',
          ['auto-mode', `Fan auto-on by schedule: ${currentTime}`]
        );
      } catch (error) {
        console.error('❌ [AUTO Mode] Fan schedule error:', error.message);
      }
    }

    // Check light time
    if (currentTime === this.autoModeSettings.lightTime) {
      console.log(`🕐 [AUTO Mode] Light auto-on time matched: ${currentTime}`);
      try {
        await mqttService.publishCommand('rgb-state', '16777215'); // Turn on light (white)
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
   * Get AUTO Mode settings
   */
  async getAutoModeSettings() {
    return this.autoModeSettings;
  }

  /**
   * Set AUTO Mode settings
   */
  async setAutoModeSettings(settings) {
    this.autoModeSettings = {
      fanTime: settings.fanTime,
      lightTime: settings.lightTime,
      fanTemperature: settings.fanTemperature
    };
    
    console.log(`⚙️ [AUTO Mode Settings] Updated:`, this.autoModeSettings);
    return this.autoModeSettings;
  }

}

export default new AutomationService();

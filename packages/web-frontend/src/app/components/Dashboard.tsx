import { Thermometer, Droplet, Zap, Shield, Lightbulb, Fan, Palette } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import axios from "../utils/axiosInstance";
import { useNotification } from "../context/NotificationContext";

interface Device {
  id: number;
  name: string;
  type: string;
  status: string;
  feed_key?: string;
  current_value?: string | null;
}

// Helper tính thiết bị thực sự đang hoạt động.
// Quạt (fan-state): backend lưu tốc độ trực tiếp trong status ('0','1','2','3')
//   status '1','2','3' = đang chạy (online); '0' hoặc OFF = tắt (offline)
// Thiết bị khác: dùng status 'ON'/'OPEN' như bình thường.
const isDeviceActuallyOn = (device: Device): boolean => {
  if (device.feed_key === 'fan-state') {
    const speed = Number(device.status ?? 0);
    return speed >= 1 && speed <= 3;
  }
  return device.status === 'ON' || device.status === 'OPEN';
};

export function Dashboard() {
  const { addNotification } = useNotification();
  const [sensorData, setSensorData] = useState({ temperature: 24, humidity: 65, timestamp: "" });
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [deviceIdMap, setDeviceIdMap] = useState<Record<string, number>>({});

  const [fanSpeed, setFanSpeed] = useState<number>(0);
  const [colorValue, setColorValue] = useState<number>(1);
  const [masterControl, setMasterControl] = useState<boolean>(false);
  const [devices, setDevices] = useState({
    livingRoomLight: false,
    livingRoomFan: false,
  });

  const isFanInteractingRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false); // true sau lần fetch đầu tiên
  const isUserInteractingRef = useRef<boolean>(false); // true khi user đang bấm nút
  const previousDevicesRef = useRef<Record<string, boolean>>({
    livingRoomLight: false,
    livingRoomFan: false,
  });

  const mapBackendFanSpeedToUI = (backendValue: number): number => {
    if (backendValue >= 0 && backendValue <= 3) return backendValue;
    return 0;
  };

  // --- 1. ĐỌC DỮ LIỆU TỪ BACKEND ---
  const fetchDevices = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/devices');
      const rawDevices: Device[] = response.data;

      setAllDevices(rawDevices);

      const deviceMap = { livingRoomLight: false, livingRoomFan: false };
      const idMap: Record<string, number> = {};
      let fetchedFanSpeed = 0;
      let isAnyDeviceOn = false;

      rawDevices.forEach((device: Device) => {
        // FIX: dùng helper isDeviceActuallyOn để tính đúng trạng thái quạt
        const isOn = isDeviceActuallyOn(device);

        if (device.feed_key === 'rgb-state') {
          deviceMap.livingRoomLight = isOn;
          idMap.livingRoomLight = device.id;
          idMap.livingRoomColor = device.id;
          if (isOn) isAnyDeviceOn = true;
          if (device.current_value != null) {
            setColorValue(Number(device.current_value));
          }
        } else if (
          device.feed_key === 'fan-state' ||
          // Fallback: nhận diện quạt qua name nếu feed_key không khớp
          (!idMap.livingRoomFan && device.name?.toLowerCase().includes('fan'))
        ) {
          deviceMap.livingRoomFan = isOn;
          idMap.livingRoomFan = device.id;
          if (isOn) isAnyDeviceOn = true;
          if (device.current_value != null) {
            fetchedFanSpeed = mapBackendFanSpeedToUI(Number(device.current_value));
          }
        }
      });

      // Thông báo khi trạng thái thay đổi từ bên ngoài (automation, v.v.)
      // Bỏ qua lần đầu tiên load (isInitializedRef chưa set) và khi user đang tương tác
      const previousDevices = previousDevicesRef.current;
      if (isInitializedRef.current && !isUserInteractingRef.current) {
        Object.entries(deviceMap).forEach(([key, newStatus]) => {
          if (previousDevices[key] !== newStatus) {
            const deviceName = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, (s) => s.toUpperCase())
              .trim();
            addNotification(`${deviceName} ${newStatus ? 'turned ON' : 'turned OFF'}`, 'info');
          }
        });
      }
      // Luôn cập nhật ref để lần sau so sánh đúng
      Object.entries(deviceMap).forEach(([key, newStatus]) => {
        previousDevices[key] = newStatus;
      });

      // Chỉ cập nhật state thiết bị khi user KHÔNG đang tương tác
      if (!isUserInteractingRef.current) {
        setDevices(deviceMap);
        setMasterControl(isAnyDeviceOn);
      }
      setDeviceIdMap(idMap);
      isInitializedRef.current = true;

      // Sync fan speed từ backend trừ khi đang tương tác trực tiếp
      if (!isFanInteractingRef.current) {
        setFanSpeed(fetchedFanSpeed);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const fetchSensorData = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/sensors/latest');
      setSensorData(response.data);
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchSensorData();

    const interval = setInterval(() => {
      fetchDevices();
      fetchSensorData();
    }, 5000);

    // FIX: Lắng nghe CustomEvent từ Automation.tsx để refresh ngay lập tức
    // thay vì chờ tới chu kỳ poll 5 giây tiếp theo
    const handleAutomationChange = () => {
      setTimeout(fetchDevices, 500); // delay nhỏ để backend kịp xử lý xong
    };
    window.addEventListener('automation-mode-changed', handleAutomationChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('automation-mode-changed', handleAutomationChange);
    };
  }, []);

  // --- 2. XỬ LÝ SỰ KIỆN KHI NGƯỜI DÙNG TƯƠNG TÁC ---
  const toggleDevice = async (deviceKey: string, deviceId: number) => {
    if (!deviceId) return addNotification('Device not found', 'error');

    isUserInteractingRef.current = true;
    setTimeout(() => { isUserInteractingRef.current = false; }, 3000);

    const newStatus = !devices[deviceKey as keyof typeof devices];
    // Optimistic update
    setDevices(prev => ({ ...prev, [deviceKey]: newStatus }));
    setAllDevices(prev => prev.map(d =>
      d.id === deviceId ? { ...d, status: newStatus ? 'ON' : 'OFF' } : d
    ));

    try {
      await axios.post(
        `http://localhost:3000/api/devices/${deviceId}/control`,
        { action: newStatus ? '1' : '0' }
      );
      const deviceName = deviceKey
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
      addNotification(`${deviceName} turned ${newStatus ? 'ON' : 'OFF'}`, 'success');
    } catch (error) {
      // Rollback
      setDevices(prev => ({ ...prev, [deviceKey]: !newStatus }));
      setAllDevices(prev => prev.map(d =>
        d.id === deviceId ? { ...d, status: newStatus ? 'OFF' : 'ON' } : d
      ));
      addNotification('Failed to control device', 'error');
    }
  };

  const handleFanSpeedChange = async (speed: number) => {
    const deviceId = deviceIdMap.livingRoomFan;
    if (!deviceId) return addNotification('Cannot control fan - device not found', 'error');

    isFanInteractingRef.current = true;
    setTimeout(() => { isFanInteractingRef.current = false; }, 3000);

    const isFanOn = speed > 0;
    const prevSpeed = fanSpeed;
    const prevFanOn = devices.livingRoomFan;

    // Optimistic update: cập nhật UI + allDevices ngay lập tức
    setFanSpeed(speed);
    setDevices(prev => ({ ...prev, livingRoomFan: isFanOn }));
    // status = String(speed) để isDeviceActuallyOn đọc đúng ('1','2','3' = online, '0' = offline)
    setAllDevices(prev => prev.map(d =>
      d.id === deviceId
        ? { ...d, status: String(speed), current_value: String(speed) }
        : d
    ));

    try {
      await axios.post(
        `http://localhost:3000/api/devices/${deviceId}/control`,
        { action: String(speed) }
      );
      addNotification(
        `Living Room Fan set to ${speed === 0 ? 'Off' : speed === 3 ? 'Auto' : `Level ${speed}`}`,
        'success'
      );
    } catch (error) {
      // Rollback
      setFanSpeed(prevSpeed);
      setDevices(prev => ({ ...prev, livingRoomFan: prevFanOn }));
      setAllDevices(prev => prev.map(d =>
        d.id === deviceId
          ? { ...d, status: String(prevSpeed), current_value: String(prevSpeed) }
          : d
      ));
      addNotification('Failed to control fan speed', 'error');
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColorValue(Number(e.target.value));
  };

  const handleColorSubmit = async () => {
    const deviceId = deviceIdMap.livingRoomColor;
    if (!deviceId) return;
    try {
      await axios.post(
        `http://localhost:3000/api/devices/${deviceId}/control`,
        { action: colorValue.toString() }
      );
    } catch (error) {
      console.error('Color update failed');
      addNotification('Failed to adjust color', 'error');
    }
  };

  const handleMasterControl = async () => {
    isUserInteractingRef.current = true;
    setTimeout(() => { isUserInteractingRef.current = false; }, 3000);

    const newStatus = !masterControl;
    setMasterControl(newStatus);

    // Điều khiển đèn trực tiếp (không qua toggleDevice để tránh xung đột state)
    if (deviceIdMap.livingRoomLight) {
      const deviceId = deviceIdMap.livingRoomLight;
      setDevices(prev => ({ ...prev, livingRoomLight: newStatus }));
      setAllDevices(prev => prev.map(d =>
        d.id === deviceId ? { ...d, status: newStatus ? 'ON' : 'OFF' } : d
      ));
      try {
        await axios.post(
          `http://localhost:3000/api/devices/${deviceId}/control`,
          { action: newStatus ? '1' : '0' }
        );
      } catch (error) {
        setDevices(prev => ({ ...prev, livingRoomLight: !newStatus }));
        setAllDevices(prev => prev.map(d =>
          d.id === deviceId ? { ...d, status: newStatus ? 'OFF' : 'ON' } : d
        ));
        addNotification('Failed to control light', 'error');
      }
    }

    // Điều khiển quạt
    if (deviceIdMap.livingRoomFan) {
      await handleFanSpeedChange(newStatus ? 1 : 0);
    }
  };

  const getFanStatusText = (speed: number): string => {
    if (speed === 1) return 'Mức 1';
    if (speed === 2) return 'Mức 2';
    if (speed === 3) return 'Auto';
    return 'Off';
  };

  // Tổng cố định 4 thiết bị: 2 cảm biến (luôn online) + đèn + quạt
  const TOTAL_DEVICES = 4;
  const SENSOR_COUNT = 2; // Cảm biến nhiệt độ + độ ẩm luôn online
  // Dùng state devices + fanSpeed thay vì allDevices để tránh hiển thị sai
  // khi component mount lại (allDevices reset về [] trước khi fetch xong)
  const lightOn = devices.livingRoomLight ? 1 : 0;
  const fanOn = fanSpeed > 0 ? 1 : 0;
  const activeCount = SENSOR_COUNT + lightOn + fanOn;
  const offlineCount = TOTAL_DEVICES - activeCount;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <Thermometer className="text-orange-500" size={32} />
          </div>
          <div className="text-3xl font-bold text-gray-900">{sensorData.temperature}°C</div>
          <div className="text-sm text-gray-500 mt-1">Temperature</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <Droplet className="text-blue-500" size={32} />
          </div>
          <div className="text-3xl font-bold text-gray-900">{sensorData.humidity}%</div>
          <div className="text-sm text-gray-500 mt-1">Humidity</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <Zap className="text-yellow-500" size={32} />
          </div>
          <div className="text-3xl font-bold text-gray-900">{activeCount} Online</div>
          <div className="text-sm text-gray-500 mt-1">{offlineCount} Offline</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <Shield className="text-green-500" size={32} />
          </div>
          <div className="text-3xl font-bold text-gray-900">Armed</div>
          <div className="text-sm text-gray-500 mt-1">System Status</div>
        </div>
      </div>

      {/* Living Room Integration Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Living Room</h3>
            <p className="text-sm text-gray-500">{sensorData.temperature}°C • {sensorData.humidity}%</p>
          </div>
          <button
            onClick={handleMasterControl}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${masterControl ? 'bg-green-500' : 'bg-gray-300'
              }`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${masterControl ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Color Slider — chỉ hiển thị khi đèn đang bật */}
          {devices.livingRoomLight && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-700 flex items-center gap-2">
                  <Palette size={18} className="text-purple-500" /> Color
                </span>
                <span className="text-sm text-gray-500">{colorValue}</span>
              </div>
              <input
                type="range"
                min="1"
                max="65535"
                value={colorValue}
                onChange={handleColorChange}
                onMouseUp={handleColorSubmit}
                onTouchEnd={handleColorSubmit}
                className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                style={{ background: 'linear-gradient(to right, red, orange, yellow, green, cyan, blue, violet, magenta, red)' }}
              />
              <p className="text-xs text-gray-400 mt-2">Kéo để chọn màu, thả ra để áp dụng</p>
            </div>
          )}

          {/* Devices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Light Control */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${devices.livingRoomLight ? 'bg-yellow-100' : 'bg-white border border-gray-200'}`}>
                    <Lightbulb className={devices.livingRoomLight ? 'text-yellow-500' : 'text-gray-400'} size={24} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Light</div>
                    <div className="text-sm text-gray-500">{devices.livingRoomLight ? 'On' : 'Off'}</div>
                  </div>
                </div>
                <button
                  onClick={() => toggleDevice('livingRoomLight', deviceIdMap.livingRoomLight || 1)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${devices.livingRoomLight ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${devices.livingRoomLight ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Fan Control */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${fanSpeed > 0 ? 'bg-cyan-100' : 'bg-white border border-gray-200'}`}>
                    <Fan className={fanSpeed > 0 ? 'text-cyan-500' : 'text-gray-400'} size={24} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Fan Speed</div>
                    <div className="text-sm text-gray-500">{getFanStatusText(fanSpeed)}</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleFanSpeedChange(speed)}
                    type="button"
                    className={`flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-all duration-200 cursor-pointer ${fanSpeed === speed
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-700 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-cyan-300 hover:bg-cyan-50'
                      }`}
                  >
                    {speed === 0 ? 'Off' : speed === 3 ? 'Auto' : speed}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

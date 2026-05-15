import { Sofa, ChefHat, Bed, Bath, Thermometer, Droplet } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "../utils/axiosInstance";

interface RoomData {
  id: string;
  name: string;
  icon: any;
  temperature: number;
  humidity: number;
  brightness?: number;
  color?: number;
  fanSpeed: number;
  masterSwitch: boolean;
  fanDeviceId?: number;   // ID của Quạt từ DB
  lightDeviceId?: number; // ID của Đèn từ DB
  lightStatus?: boolean;  // ON/OFF status của đèn
}

interface Device {
  id: number;
  name: string;
  type: string;
  status: string;
  current_value?: string | null;
}

export function Rooms() {
  const [rooms, setRooms] = useState<RoomData[]>([
    {
      id: "living-room",
      name: "Living Room",
      icon: Sofa,
      temperature: 24,
      humidity: 65,
      color: 32768,
      fanSpeed: 2,
      masterSwitch: true,
      lightStatus: true,
    },
    {
      id: "kitchen",
      name: "Kitchen",
      icon: ChefHat,
      temperature: 26,
      humidity: 70,
      brightness: 100,
      fanSpeed: 1,
      masterSwitch: true,
    },
    {
      id: "bedroom",
      name: "Bedroom",
      icon: Bed,
      temperature: 22,
      humidity: 60,
      brightness: 40,
      fanSpeed: 3,
      masterSwitch: true,
    },
    {
      id: "bathroom",
      name: "Bathroom",
      icon: Bath,
      temperature: 23,
      humidity: 75,
      brightness: 60,
      fanSpeed: 0,
      masterSwitch: false,
    },
  ]);

  // --- HÀM HỖ TRỢ: Map backend fan speed values (0, 50, 100, 150) to UI levels (0, 1, 2, 3) ---
  const mapBackendFanSpeedToUI = (backendValue: number): number => {
    if (backendValue === 0) return 0; // Off
    if (backendValue === 50) return 1; // Level 1
    if (backendValue === 100) return 2; // Level 2
    if (backendValue === 150) return 3; // Auto
    return 0; // Default to Off
  };

  // Fetch room/device states từ backend
  useEffect(() => {
    const fetchRoomStates = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/devices');
        const devices: Device[] = response.data;
        
        // Update master switch and map device IDs/state to rooms
        setRooms(prevRooms => prevRooms.map(room => {
          let masterSwitch = room.masterSwitch;
          let fanDeviceId: number | undefined;
          let lightDeviceId: number | undefined;
          let fanSpeed = room.fanSpeed;
          let color = room.color;
          let lightStatus = room.lightStatus;
          
          // Map device status to master switch
          devices.forEach(device => {
            const isOn = device.status === 'ON' || device.status === 'OPEN';
            
            // Map ID & Status cho Living Room Light
            if (room.id === 'living-room' && device.type === 'light') {
              lightDeviceId = device.id;
              lightStatus = isOn; // Set light status from backend
              masterSwitch = masterSwitch || isOn;
              if (device.current_value !== null && device.current_value !== undefined) {
                color = Number(device.current_value);
              }
            } 
            // Chỉ Living Room được điều khiển fan-state
            else if (room.id === 'living-room' && device.type === 'fan') {
              fanDeviceId = device.id;
              masterSwitch = masterSwitch || isOn;
              // Map backend fan speed value to UI level
              if (device.current_value !== null && device.current_value !== undefined) {
                fanSpeed = mapBackendFanSpeedToUI(Number(device.current_value));
              }
            }
          });
          
          return { ...room, masterSwitch, fanDeviceId, lightDeviceId, fanSpeed, color, lightStatus };
        }));
      } catch (error) {
        console.error('Error fetching room states:', error);
      }
    };

    fetchRoomStates();
  }, []);

  const updateRoom = (id: string, updates: Partial<RoomData>) => {
    setRooms(prev => prev.map(room =>
      room.id === id ? { ...room, ...updates } : room
    ));
  };

  // --- HÀM XỬ LÝ ĐÈN (LIGHT TOGGLE) ---
  const handleLightToggle = async (room: RoomData) => {
    const newStatus = !(room.lightStatus ?? false);
    updateRoom(room.id, { lightStatus: newStatus });
    
    if (!room.lightDeviceId) {
      console.warn(`Không tìm thấy light device cho room ${room.id}`);
      return;
    }

    try {
      await axios.post(`http://localhost:3000/api/devices/${room.lightDeviceId}/control`, {
        action: newStatus ? '1' : '0'
      });
    } catch (error) {
      console.error('Lỗi khi điều khiển đèn:', error);
    }
  };

  // --- HÀM XỬ LÝ QUẠT (FAN SPEED) ---
  const handleFanSpeedChange = async (room: RoomData, speed: number) => {
    // 1. Cập nhật state trên giao diện (chuyển màu nút bấm)
    updateRoom(room.id, { fanSpeed: speed });
    const deviceId = room.fanDeviceId;
    if (!deviceId) {
      console.warn(`Không tìm thấy fan device cho room ${room.id}`);
      return;
    }
    try {
      await axios.post(`http://localhost:3000/api/devices/${room.fanDeviceId}/control`, { 
        action: speed.toString() 
      });
    } catch (error) {
      console.error('Lỗi khi điều khiển Fan:', error);
    }
  };

  // --- HÀM XỬ LÝ COLOR ---
  const handleColorChange = (room: RoomData, colorValue: number) => {
    // Cập nhật state màu ngay trên UI, chưa gửi xuống backend
    updateRoom(room.id, { color: colorValue });
  };

  const handleColorCommit = async (room: RoomData) => {
    const colorValue = room.color ?? 0;
    const deviceId = room.lightDeviceId || 1; // ID mặc định của đèn
    try {
      await axios.post(`http://localhost:3000/api/devices/${room.lightDeviceId}/control`, { 
        action: colorValue.toString() 
      });
    } catch (error) {
      console.error('Lỗi khi điều chỉnh màu:', error);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Rooms</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {rooms.map((room) => {
          const Icon = room.icon;

          return (
            <div key={room.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-lg shadow-sm">
                      <Icon className="text-blue-600" size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{room.name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Thermometer size={16} />
                          <span>{room.temperature}°C</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Droplet size={16} />
                          <span>{room.humidity}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Light Toggle for Living Room */}
                  {room.id === 'living-room' && (
                    <button
                      onClick={() => handleLightToggle(room)}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                        room.lightStatus ? 'bg-yellow-400' : 'bg-gray-300'
                      }`}
                      title={room.lightStatus ? 'Light is ON' : 'Light is OFF'}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          room.lightStatus ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>

              {/* Body - Controls */}
              <div className="p-6 space-y-6">
                {/* Brightness/Color Control */}
                <div>
                  {room.id === "living-room" ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <label className={`text-sm font-medium ${room.lightStatus ? 'text-gray-700' : 'text-gray-400'}`}>
                          Color
                        </label>
                        <span className={`text-sm ${room.lightStatus ? 'text-gray-500' : 'text-gray-400'}`}>
                          {room.color}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="65535"
                        value={room.color || 0}
                        onChange={(e) => handleColorChange(room, parseInt(e.target.value))}
                        onPointerUp={() => handleColorCommit(room)}
                        onTouchEnd={() => handleColorCommit(room)}
                        disabled={!room.lightStatus}
                        className={`w-full h-3 rounded-lg appearance-none cursor-pointer transition-opacity ${
                          !room.lightStatus ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        style={{
                          background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
                        }}
                      />
                      {!room.lightStatus && (
                        <p className="text-xs text-gray-400 mt-2">Turn on the light to adjust color</p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Brightness</label>
                        <span className="text-sm text-gray-500">{room.brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={room.brightness || 0}
                        onChange={(e) => updateRoom(room.id, { brightness: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </>
                  )}
                </div>

                {/* Fan Speed Control */}
                {room.id === 'living-room' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Fan Speed</label>
                    <span className="text-sm text-gray-500">
                      {room.fanSpeed === 0 ? 'Off' : room.fanSpeed === 3 ? 'Auto' : `Level ${room.fanSpeed}`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleFanSpeedChange(room, speed)}
                        className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                          room.fanSpeed === speed
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {speed === 0 ? 'Off' : speed === 3 ? 'Auto' : speed}
                      </button>
                    ))}
                  </div>
                </div>
                )}
              </div>

              {/* Footer - Master Switch */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Master Control</div>
                    <div className="text-sm text-gray-500">
                      {room.masterSwitch ? 'All devices active' : 'All devices off'}
                    </div>
                  </div>
                  <button
                    onClick={() => updateRoom(room.id, { masterSwitch: !room.masterSwitch })}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      room.masterSwitch ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        room.masterSwitch ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
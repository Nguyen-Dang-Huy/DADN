import { Sparkles, Moon, Home, Sun, Settings as SettingsIcon } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "../utils/axiosInstance";
import { useNotification } from "../context/NotificationContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";

interface AutomationMode {
  id: string;
  name: string;
  description: string;
  icon: any;
  active: boolean;
}

interface AutoSettings {
  fanEnabled: boolean;
  fanTime: string;
  fanTemperature: string;
  lightEnabled: boolean;
  lightTime: string;
}

export function Automation() {
  const { addNotification } = useNotification();
  const [modes, setModes] = useState<AutomationMode[]>([
    {
      id: "auto",
      name: "AUTO Mode",
      description: "Automatically adjust settings based on time and occupancy",
      icon: Sparkles,
      active: true,
    },
    {
      id: "away",
      name: "Away Mode",
      description: "Activate when you leave home - locks doors, turns off lights",
      icon: Home,
      active: false,
    },
    {
      id: "night",
      name: "Night Mode",
      description: "Dim lights, lock doors, activate night settings at bedtime",
      icon: Moon,
      active: false,
    },
    {
      id: "morning",
      name: "Morning Mode",
      description: "Gradually increase brightness and temperature in the morning",
      icon: Sun,
      active: false,
    },
  ]);

  const parseBool = (val: any): boolean => {
    if (typeof val === 'boolean') return val;
    if (val === 'true' || val === '1' || val === 1) return true;
    return false;
  };

  const SETTINGS_CACHE_KEY = 'auto_mode_settings';

  const loadCachedSettings = (): AutoSettings | null => {
    try {
      const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch { }
    return null;
  };

  const saveSettingsCache = (s: AutoSettings) => {
    try { localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(s)); } catch { }
  };

  const defaultSettings: AutoSettings = {
    fanEnabled: true,
    fanTime: "08:00",
    fanTemperature: "28",
    lightEnabled: true,
    lightTime: "07:00",
  };

  const [autoSettings, setAutoSettings] = useState<AutoSettings>(
    loadCachedSettings() ?? defaultSettings
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<AutoSettings>(
    loadCachedSettings() ?? defaultSettings
  );

  // Đồng bộ state từ backend khi mở trang
  useEffect(() => {
    const fetchAutomationState = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/automation/state');
        const backendModes = response.data.modes;

        setModes(prevModes => prevModes.map(m => ({
          ...m,
          active: backendModes[m.id] !== undefined ? backendModes[m.id].active : m.active
        })));
      } catch (error) {
        console.error('Failed to fetch automation state:', error);
      }
    };

    const fetchAutoSettings = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/automation/settings');
        const normalized: AutoSettings = {
          fanEnabled: parseBool(response.data.fanEnabled),
          fanTime: response.data.fanTime ?? "08:00",
          fanTemperature: String(response.data.fanTemperature ?? "28"),
          lightEnabled: parseBool(response.data.lightEnabled),
          lightTime: response.data.lightTime ?? "07:00",
        };
        saveSettingsCache(normalized);
        setAutoSettings(normalized);
        setTempSettings(normalized);
      } catch (error) {
        console.error('Failed to fetch auto settings:', error);
        // Fetch lỗi thì giữ nguyên cache localStorage đang có
      }
    };

    fetchAutomationState();
    fetchAutoSettings();
  }, []);

  const toggleMode = async (id: string) => {
    // Tìm mode đang được click
    const mode = modes.find(m => m.id === id);
    if (!mode) return;

    const newStatus = !mode.active;

    // Cập nhật giao diện lập tức (Optimistic update)
    setModes(prev => prev.map(m =>
      m.id === id ? { ...m, active: newStatus } : m
    ));

    try {
      // Gọi API báo cho backend
      await axios.post('http://localhost:3000/api/automation/mode', {
        mode: id,
        active: newStatus
      });

      // Hiện thông báo
      const statusText = newStatus ? 'activated' : 'deactivated';
      addNotification(`${mode.name} ${statusText}`, 'success');
    } catch (error) {
      console.error('Error updating automation mode:', error);

      // Nếu API lỗi, trả lại trạng thái cũ trên UI
      setModes(prev => prev.map(m =>
        m.id === id ? { ...m, active: !newStatus } : m
      ));

      addNotification('Failed to update automation mode', 'error');
    }
  };

  const saveAutoSettings = async () => {
    const isAutoActive = getAutoMode()?.active;

    // Phát hiện xem user có thay đổi trạng thái enabled không (toggle bật/tắt)
    const enabledChanged =
      tempSettings.fanEnabled !== autoSettings.fanEnabled ||
      tempSettings.lightEnabled !== autoSettings.lightEnabled;

    try {
      // 1. Lưu settings lên backend
      // Backend chỉ áp dụng ngay lên thiết bị nếu trạng thái enabled thay đổi
      const { data: savedSettings } = await axios.post('http://localhost:3000/api/automation/settings', tempSettings);
      saveSettingsCache(savedSettings);
      setAutoSettings(savedSettings);
      setTempSettings(savedSettings); // sync tempSettings với data đã normalize từ server
      setSettingsOpen(false);

      if (isAutoActive && enabledChanged) {
        // 2. Fetch lại trạng thái devices từ backend để cập nhật UI
        try {
          const { data: deviceList } = await axios.get('http://localhost:3000/api/devices');
          // Nếu backend trả về danh sách devices với trạng thái mới nhất,
          // component cha (Dashboard) sẽ cần refresh — emit event hoặc gọi callback nếu có.
          // Tạm thời dispatch custom event để các component khác biết cần refresh:
          window.dispatchEvent(new CustomEvent('devicesUpdated', { detail: deviceList }));
        } catch (_) { }

        addNotification('Đã lưu và áp dụng trạng thái thiết bị', 'success');
      } else if (isAutoActive) {
        // Chỉ đổi giờ/ngưỡng nhiệt độ → không bật/tắt thiết bị ngay, chỉ cập nhật lịch hẹn
        addNotification('Đã lưu cài đặt — đèn/quạt sẽ tự bật đúng giờ đã hẹn', 'success');
      } else {
        addNotification('Đã lưu cài đặt (AUTO Mode đang tắt, chưa áp dụng)', 'success');
      }
    } catch (error) {
      console.error('Error saving auto settings:', error);
      addNotification('Failed to save settings', 'error');
    }
  };

  const getAutoMode = () => modes.find(m => m.id === "auto");

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Automation</h2>

      {/* Automation Modes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isAutoMode = mode.id === "auto";

          return (
            <div
              key={mode.id}
              className={`bg-white rounded-xl p-6 shadow-sm border-2 transition-all relative ${mode.active
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200'
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-3 rounded-lg ${mode.active ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                    <Icon className={mode.active ? 'text-green-600' : 'text-gray-600'} size={28} />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{mode.name}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{mode.description}</p>

                    {mode.active && (
                      <div className="mt-3 inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        Active
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => toggleMode(mode.id)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ml-4 flex-shrink-0 ${mode.active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${mode.active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              {/* Settings button for AUTO Mode */}
              {isAutoMode && (
                <div className="absolute bottom-4 right-4">
                  <Dialog open={settingsOpen} onOpenChange={(open) => {
                    if (open) setTempSettings(autoSettings); // sync mỗi lần mở
                    setSettingsOpen(open);
                  }}>
                    <DialogTrigger asChild>
                      <button className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium flex items-center gap-1">
                        <SettingsIcon size={14} />
                        Settings
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>AUTO Mode Settings</DialogTitle>
                        <DialogDescription>
                          Bật/tắt tự động cho từng thiết bị riêng biệt. Chỉ hoạt động khi AUTO Mode được bật.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-5 py-2">

                        {/* ===== FAN SECTION ===== */}
                        <div className={`rounded-xl border-2 p-4 transition-colors ${tempSettings.fanEnabled ? 'border-cyan-400 bg-cyan-50' : 'border-gray-200 bg-gray-50'}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🌀</span>
                              <span className="font-semibold text-gray-800">Quạt tự động</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setTempSettings(prev => ({ ...prev, fanEnabled: !prev.fanEnabled }))}
                              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${tempSettings.fanEnabled ? 'bg-cyan-500' : 'bg-gray-300'}`}
                            >
                              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${tempSettings.fanEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                          </div>

                          <div className={`space-y-3 transition-opacity ${tempSettings.fanEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="space-y-1">
                              <Label htmlFor="fan-time" className="text-sm text-gray-600">Giờ bật tự động</Label>
                              <Input
                                id="fan-time"
                                type="time"
                                value={tempSettings.fanTime}
                                onChange={(e) => setTempSettings(prev => ({ ...prev, fanTime: e.target.value }))}
                              />
                              <p className="text-xs text-gray-400">Quạt sẽ tự bật vào giờ này mỗi ngày</p>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="fan-temp" className="text-sm text-gray-600">Bật khi nhiệt độ đạt (°C)</Label>
                              <Input
                                id="fan-temp"
                                type="number"
                                step="0.1"
                                value={tempSettings.fanTemperature}
                                onChange={(e) => setTempSettings(prev => ({ ...prev, fanTemperature: e.target.value }))}
                              />
                              <p className="text-xs text-gray-400">Quạt tự bật khi cảm biến vượt mức nhiệt này</p>
                            </div>
                          </div>
                        </div>

                        {/* ===== LIGHT SECTION ===== */}
                        <div className={`rounded-xl border-2 p-4 transition-colors ${tempSettings.lightEnabled ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-gray-50'}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">💡</span>
                              <span className="font-semibold text-gray-800">Đèn tự động</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setTempSettings(prev => ({ ...prev, lightEnabled: !prev.lightEnabled }))}
                              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${tempSettings.lightEnabled ? 'bg-yellow-400' : 'bg-gray-300'}`}
                            >
                              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${tempSettings.lightEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                          </div>

                          <div className={`space-y-1 transition-opacity ${tempSettings.lightEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <Label htmlFor="light-time" className="text-sm text-gray-600">Giờ bật tự động</Label>
                            <Input
                              id="light-time"
                              type="time"
                              value={tempSettings.lightTime}
                              onChange={(e) => setTempSettings(prev => ({ ...prev, lightTime: e.target.value }))}
                            />
                            <p className="text-xs text-gray-400">Đèn sẽ tự bật vào giờ này mỗi ngày</p>
                          </div>
                        </div>

                      </div>

                      <div className="flex justify-end gap-3 pt-1">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setTempSettings(autoSettings);
                            setSettingsOpen(false);
                          }}
                        >
                          Hủy
                        </Button>
                        <Button onClick={saveAutoSettings}>
                          Lưu cài đặt
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Additional Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 mb-2">Automation Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Multiple modes can be active simultaneously</li>
          <li>• Modes will execute in priority order if there are conflicts</li>
          <li>• You can customize each mode's behavior in Settings</li>
        </ul>
      </div>
    </div>
  );
}
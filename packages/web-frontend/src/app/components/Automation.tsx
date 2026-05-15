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
  fanTime: string;
  lightTime: string;
  fanTemperature: string;
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

  const [autoSettings, setAutoSettings] = useState<AutoSettings>({
    fanTime: "08:00",
    lightTime: "07:00",
    fanTemperature: "28",
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<AutoSettings>(autoSettings);

  // Đồng bộ state từ backend khi mở trang
  useEffect(() => {
    const fetchAutomationState = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/automation/state');
        const backendModes = response.data.modes;

        setModes(prevModes => prevModes.map(m => ({
          ...m,
          // Kiểm tra xem backend có trả về state của mode này không, nếu có thì đè lên
          active: backendModes[m.id] !== undefined ? backendModes[m.id].active : m.active 
        })));
      } catch (error) {
        console.error('Failed to fetch automation state:', error);
      }
    };

    const fetchAutoSettings = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/automation/settings');
        setAutoSettings(response.data);
        setTempSettings(response.data);
      } catch (error) {
        console.error('Failed to fetch auto settings:', error);
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
    try {
      await axios.post('http://localhost:3000/api/automation/settings', tempSettings);
      setAutoSettings(tempSettings);
      setSettingsOpen(false);
      addNotification('AUTO Mode settings saved successfully', 'success');
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
              className={`bg-white rounded-xl p-6 shadow-sm border-2 transition-all relative ${
                mode.active
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-3 rounded-lg ${
                    mode.active ? 'bg-green-100' : 'bg-gray-100'
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
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ml-4 flex-shrink-0 ${
                    mode.active ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      mode.active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Settings button for AUTO Mode */}
              {isAutoMode && (
                <div className="absolute bottom-4 right-4">
                  <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
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
                          Configure automatic settings. These will only take effect when AUTO Mode is enabled.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="fan-time">Fan Auto On Time</Label>
                          <Input
                            id="fan-time"
                            type="time"
                            value={tempSettings.fanTime}
                            onChange={(e) => setTempSettings({
                              ...tempSettings,
                              fanTime: e.target.value
                            })}
                          />
                          <p className="text-xs text-gray-500">Time when fan automatically turns on</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="light-time">Light Auto On Time</Label>
                          <Input
                            id="light-time"
                            type="time"
                            value={tempSettings.lightTime}
                            onChange={(e) => setTempSettings({
                              ...tempSettings,
                              lightTime: e.target.value
                            })}
                          />
                          <p className="text-xs text-gray-500">Time when light automatically turns on</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="fan-temp">Fan Auto On Temperature (°C)</Label>
                          <Input
                            id="fan-temp"
                            type="number"
                            step="0.1"
                            value={tempSettings.fanTemperature}
                            onChange={(e) => setTempSettings({
                              ...tempSettings,
                              fanTemperature: e.target.value
                            })}
                          />
                          <p className="text-xs text-gray-500">Temperature from sensor when fan automatically turns on</p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setTempSettings(autoSettings);
                            setSettingsOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button onClick={saveAutoSettings}>
                          Save Settings
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
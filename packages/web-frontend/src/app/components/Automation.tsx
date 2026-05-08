import { Sparkles, Moon, Home, Sun } from "lucide-react";
import { useState } from "react";

interface AutomationMode {
  id: string;
  name: string;
  description: string;
  icon: any;
  active: boolean;
}

export function Automation() {
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

  const toggleMode = (id: string) => {
    setModes(prev => prev.map(mode =>
      mode.id === id ? { ...mode, active: !mode.active } : mode
    ));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Automation</h2>

      {/* Automation Modes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modes.map((mode) => {
          const Icon = mode.icon;

          return (
            <div
              key={mode.id}
              className={`bg-white rounded-xl p-6 shadow-sm border-2 transition-all ${
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
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ml-4 ${
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

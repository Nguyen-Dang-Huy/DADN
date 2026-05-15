import { Lightbulb, DoorClosed, Fan, Tv, Lock, Thermometer, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "../utils/axiosInstance";
import { formatActionDisplay } from "../utils/actionFormatter";

interface HistoryEntry {
  id: number;
  device: string;
  action: string;
  time: string;
  icon: any;
}

export function History() {
  const [logs, setLogs] = useState<HistoryEntry[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [eventType, setEventType] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, [fromDate, toDate, eventType]);

  const fetchLogs = async () => {
    try {
      const params: any = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (eventType !== 'all') params.type = eventType;
      const response = await axios.get('/api/logs', { params });
      const uniqueLogs = response.data.filter((entry: HistoryEntry, index: number, array: HistoryEntry[]) => {
        return index === array.findIndex((other) =>
          other.device === entry.device &&
          other.action === entry.action &&
          other.time === entry.time
        );
      });
      setLogs(uniqueLogs);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const eventsToday = logs.filter((entry) => {
    const eventDate = new Date(entry.time).toDateString();
    return eventDate === new Date().toDateString();
  }).length;

  const uniqueDevices = new Set(logs.map((entry) => entry.device)).size;

  const getActionType = (action: string) => {
    if (/threshold/i.test(action)) return 'Config';
    return 'Device';
  };

  const getIcon = (device: string) => {
    const normalized = device.toLowerCase();
    if (normalized.includes('fan')) return Fan;
    if (normalized.includes('tv')) return Tv;
    if (normalized.includes('door') || normalized.includes('lock')) return DoorClosed;
    if (normalized.includes('light') || normalized.includes('led-state') || normalized.includes('rgb-state')) return Lightbulb;
    return Shield;
  };

  const getDeviceName = (device: string) => {
    switch (device.toLowerCase()) {
      case 'led-state':
      case 'rgb-state':
      case 'light':
        return 'Living Room Light';
      case 'fan-state':
      case 'fan':
        return 'Living Room Fan';
      case 'tv-state':
      case 'tv':
        return 'Living Room TV';
      case 'door':
      case 'front door':
        return 'Front Door';
      case 'system':
        return 'System';
      default:
        return device;
    }
  };

  // Convert hue value (0–65535) sang hex color (#RRGGBB)
  const hueToHex = (hue: number): string => {
    const h = (hue / 65535) * 360;
    const s = 1, v = 1;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60)      { r = c; g = x; b = 0; }
    else if (h < 120){ r = x; g = c; b = 0; }
    else if (h < 180){ r = 0; g = c; b = x; }
    else if (h < 240){ r = 0; g = x; b = c; }
    else if (h < 300){ r = x; g = 0; b = c; }
    else             { r = c; g = 0; b = x; }
    const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  };

  const formatAction = (action: string, device?: string) => {
    const normalized = action.trim();
    if (/turn(ed)?\s*on/i.test(normalized) || /TURN_ON/i.test(normalized)) return 'Turned On';
    if (/turn(ed)?\s*off/i.test(normalized) || /TURN_OFF/i.test(normalized)) return 'Turned Off';
    if (/open(ed)?/i.test(normalized) || /^OPEN$/i.test(normalized)) return 'Opened';
    if (/close(d)?/i.test(normalized) || /^CLOSED$/i.test(normalized)) return 'Closed';

    // Xử lý action dạng số '0'/'1' từ rgb-state / led-state (bật/tắt đèn)
    const isLightDevice = device && (
      device.toLowerCase().includes('light') ||
      device.toLowerCase().includes('led-state') ||
      device.toLowerCase().includes('rgb-state')
    );
    if (isLightDevice) {
      if (normalized === '0') return 'Turned Off';
      if (normalized === '1') return 'Turned On';
    }
    // Nếu action là số lớn hơn 1 và device là đèn → thay đổi màu (trả về hex)
    if (isLightDevice && /^\d+$/.test(normalized) && Number(normalized) > 1) {
      const hex = hueToHex(Number(normalized));
      return `color:${hex}`; // dùng prefix đặc biệt để render ô màu ở JSX
    }

    if (/speed/i.test(normalized)) {
      return normalized
        .replace(/speed/i, 'Speed')
        .replace(/set to/i, 'Set to')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (/threshold/i.test(normalized)) {
      return normalized
        .replace(/set temperature threshold to/i, 'Set temperature threshold to')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">History</h2>

      {/* Date Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end mb-4">
        <div className="flex gap-4 flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Events</option>
            <option value="device">Device Actions</option>
            <option value="config">Config Changes</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Time</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Device</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Type</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                  No history records found for the selected filters.
                </td>
              </tr>
            ) : (
              logs.map((entry, index) => {
                const Icon = getIcon(entry.device);
                const actionType = getActionType(entry.action);

                return (
                  <tr
                    key={entry.id}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{new Date(entry.time).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Icon className="text-blue-600" size={18} />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{getDeviceName(entry.device)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${actionType === 'Config' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                        {actionType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {(() => {
                        const result = formatAction(entry.action, entry.device);
                        if (result.startsWith('color:#')) {
                          const hex = result.replace('color:', '');
                          return (
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block w-5 h-5 rounded-md border border-gray-200 flex-shrink-0"
                                style={{ backgroundColor: hex }}
                              />
                              <span>Changed Color</span>
                            </div>
                          );
                        }
                        return result;
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{eventsToday}</div>
          <div className="text-sm text-gray-600 mt-1">Events Today</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{uniqueDevices}</div>
          <div className="text-sm text-gray-600 mt-1">Devices Seen</div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{logs.length}</div>
          <div className="text-sm text-gray-600 mt-1">Records Loaded</div>
        </div>
      </div>
    </div>
  );
}

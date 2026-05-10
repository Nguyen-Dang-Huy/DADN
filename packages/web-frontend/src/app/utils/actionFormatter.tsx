import React from 'react';

/**
 * Helper function to format action values for display
 * - If action is 'ON' or 'OFF', keep it as is
 * - If action is a number representing a color, format it with HSL and colored square
 * - If action is a fan speed value, format it appropriately
 * - Otherwise, return the action as is
 */
export const formatActionDisplay = (action: string | number, device?: string): React.ReactNode => {
  const actionStr = String(action).trim();

  // Check if this is a fan device
  const isFanDevice = device?.toLowerCase().includes('fan');

  // Check if it's a simple ON/OFF command
  if (/^(on|off|open|closed|opened)$/i.test(actionStr)) {
    return capitalizeFirstLetter(actionStr);
  }

  // Handle fan speed values
  if (isFanDevice) {
    const value = parseInt(actionStr, 10);
    if (!isNaN(value)) {
      // Map different fan speed value formats to readable text
      if (value === 0 || actionStr === '0') return 'OFF';
      if (value === 1 || value === 50) return 'Speed 1';
      if (value === 2 || value === 100) return 'Speed 2';
      if (value === 3 || value === 150) return 'Auto Mode';
      // Fallback for other numeric values
      return `Speed ${value}`;
    }
  }

  // Check if it's a number (could be a color value)
  const numberValue = parseInt(actionStr, 10);
  // FIX: Chỉ áp dụng dải màu nếu là số từ 0 đến 65535 và không phải là quạt
  if (!isNaN(numberValue) && numberValue >= 0 && numberValue <= 65535 && !isFanDevice) {
    // Convert dải 0-65535 sang độ (0-360) của hệ màu HSL
    const hue = (numberValue / 65535) * 360;
    
    return (
      <div className="flex items-center gap-2">
        <span>Color Change</span>
        <div
          className="w-4 h-4 rounded border border-gray-300 shadow-sm"
          style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
          title={`Value: ${numberValue}`}
        />
      </div>
    );
  }

  // For speed/threshold/other text commands, capitalize and format nicely
  const formatted = actionStr
    .replace(/speed/i, 'Speed')
    .replace(/set to/i, 'Set to')
    .replace(/set/i, 'Set')
    .replace(/threshold/i, 'Threshold')
    .replace(/temperature/i, 'Temperature')
    .replace(/\s+/g, ' ')
    .trim();

  return capitalizeFirstLetter(formatted);
};

/**
 * Helper to capitalize first letter of string
 */
const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Convert color value (0-65535) to HSL string
 * (Đã sửa lại từ colorToHex để đồng bộ nếu có component khác gọi tới)
 */
export const colorToHsl = (colorValue: number): string => {
  const hue = (colorValue / 65535) * 360;
  return `hsl(${hue}, 100%, 50%)`;
};

/**
 * Check if action is a color change
 */
export const isColorAction = (action: string | number): boolean => {
  const numberValue = parseInt(String(action), 10);
  return !isNaN(numberValue) && numberValue >= 0 && numberValue <= 65535 && !/^(0|1)$/i.test(String(action).trim());
};

/**
 * Convert fan speed value to readable text
 * Handles both UI levels (0, 1, 2, 3) and backend values (0, 50, 100, 150)
 */
export const formatFanSpeed = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
  
  if (isNaN(numValue)) return 'OFF';
  
  if (numValue === 0) return 'OFF';
  if (numValue === 1 || numValue === 50) return 'Speed 1';
  if (numValue === 2 || numValue === 100) return 'Speed 2';
  if (numValue === 3 || numValue === 150) return 'Auto Mode';
  
  return `Speed ${numValue}`;
};
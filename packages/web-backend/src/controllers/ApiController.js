// src/controllers/ApiController.js
import logRepository from '../repositories/LogRepository.js';
import deviceRepository from '../repositories/DeviceRepository.js';
import systemConfigRepository from '../repositories/SystemConfigRepository.js';
import mqttService from '../services/mqttService.js';
import automationService from '../services/AutomationService.js'; // <-- Đã thêm import

class ApiController {
    // 1. Lấy dữ liệu cảm biến mới nhất
    async getLatestSensors(req, res) {
        try {
            const data = await logRepository.getLatestSensorData();
            res.status(200).json({
                temperature: data ? data.temperature : 30.5,
                humidity: data ? data.humidity : 70,
                timestamp: data ? data.timestamp : new Date().toISOString()
            });
        } catch (error) {
            console.error("DEBUG - getLatestSensors Error:", error);
            res.status(500).json({ error: 'Server error' }); 
        }
    }

    // 2. Điều khiển thiết bị
    async controlDevice(req, res) {
        try {
            const deviceId = req.params.id;
            const { action } = req.body; 

            const device = await deviceRepository.getDeviceById(deviceId);
            if (!device) {
                return res.status(404).json({ error: 'Device not found' });
            }

            // CHỈ Publish lên Adafruit IO MQTT với giá trị số (1/0)
            await mqttService.publishCommand(device.feed_key, action);

            // Đã xóa phần update DB ở đây để chuyển sang MqttService xử lý
            res.status(200).json({ action: action, success: true });
        } catch (error) {
            console.error('Control device error:', error);
            res.status(400).json({ error: 'Invalid input' }); 
        }
    }

    // 3. Cấu hình ngưỡng nhiệt độ
    async configThreshold(req, res) {
        try {
            const { temperature } = req.body; 
            await systemConfigRepository.setThreshold(temperature);
            res.status(200).json({ temperature: temperature, success: true }); 
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }

    // 4. Truy vấn nhật ký (Logs)
    async getLogs(req, res) {
        try {
            const { from, to } = req.query;
            const logs = await logRepository.getLogs(from, to);
            res.status(200).json(logs); 
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }

    // 5. Lấy danh sách tất cả devices
    async getAllDevices(req, res) {
        try {
            const devices = await deviceRepository.getAllDevices();
            res.status(200).json(devices);
        } catch (error) {
            console.error("DEBUG - getAllDevices Error:", error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    // 6. API Đăng nhập 
    async login(req, res) {
        const { user, pass } = req.body; 
        if (user === 'admin' && pass === 'password') { 
            const token = "fake-jwt-token";
            res.status(200).json({ token: token, redirect: '/dashboard' }); 
        } else {
            res.status(401).json({ error: 'Unauthorized' }); 
        }
    }

    // 7. Cập nhật chế độ tự động hóa
    async setAutomationMode(req, res) {
        try {
            const { mode, active } = req.body;

            if (!mode || typeof active !== 'boolean') {
                return res.status(400).json({ error: 'Tham số không hợp lệ' });
            }

            // Gọi service thực thi kịch bản (ví dụ: tắt đèn, bật giả lập có người...)
            const result = await automationService.setModeStatus(mode, active);
            
            res.status(200).json(result);
        } catch (error) {
            console.error('❌ Set automation mode error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    // 8. Lấy trạng thái tự động hóa hiện tại
    async getAutomationState(req, res) {
        try {
            const state = automationService.getAutomationState();
            res.status(200).json(state);
        } catch (error) {
            console.error('❌ Lấy trạng thái automation error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
}

export default new ApiController();
import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../test-server.js';

// ==========================================
// 1. SETUP MOCKS (GIẢ LẬP TOÀN BỘ DEPENDENCIES)
// ==========================================
jest.mock('../src/config/db.js', () => ({
    execute: jest.fn(),
    query: jest.fn()
}));

jest.mock('../src/services/mqttService.js', () => ({
    publishCommand: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn()
}));

// Mock các Repositories để kiểm soát dữ liệu DB
jest.mock('../src/repositories/LogRepository.js', () => ({
    getLatestSensorData: jest.fn(),
    getLogs: jest.fn()
}));

jest.mock('../src/repositories/DeviceRepository.js', () => ({
    getAllDevices: jest.fn(),
    getDeviceById: jest.fn()
}));

jest.mock('../src/repositories/SystemConfigRepository.js', () => ({
    setThreshold: jest.fn()
}));

// Mock AutomationService chặn treo vòng lặp Open Handles
jest.mock('../src/services/AutomationService.js', () => ({
    setModeStatus: jest.fn(),
    getAutomationState: jest.fn(),
    getAutoModeSettings: jest.fn(),
    setAutoModeSettings: jest.fn()
}));

describe('API Integration Tests', () => {
    beforeAll(() => {
        process.env.NODE_ENV = 'test';
        process.env.PORT = '3001';
    });

    afterEach(() => {
        jest.clearAllMocks(); // Dọn dẹp mock sau mỗi test
    });

    // ==========================================
    // NHÓM 1: ĐĂNG NHẬP (AUTH)
    // ==========================================
    describe('POST /login', () => {
        it('should login successfully', async () => {
            const response = await request(app)
                .post('/login')
                .send({ user: 'admin', pass: 'password' })
                .expect(200);

            expect(response.body.token).toBeDefined();
            expect(response.body.redirect).toBe('/dashboard');
        });

        it('should reject invalid login', async () => {
            const response = await request(app)
                .post('/login')
                .send({ user: 'admin', pass: 'wrongpass' })
                .expect(401);

            expect(response.body.error).toBe('Unauthorized');
        });
    });

    // ==========================================
    // NHÓM 2: QUẢN LÝ THIẾT BỊ (DEVICES)
    // ==========================================
    describe('GET /api/devices', () => {
        it('should return list of devices', async () => {
            const mockDevices = [
                { id: 1, name: 'LED Light', type: 'led', status: 'off' },
                { id: 2, name: 'RGB Light', type: 'rgb', status: 'on' }
            ];
            
            const deviceRepository = require('../src/repositories/DeviceRepository.js');
            deviceRepository.getAllDevices.mockResolvedValue(mockDevices);

            const response = await request(app)
                .get('/api/devices')
                .expect(200);

            expect(response.body).toEqual(mockDevices);
        });
    });

    describe('POST /api/devices/:id/control', () => {
        it('should control device', async () => {
            const deviceRepository = require('../src/repositories/DeviceRepository.js');
            const mqtt = require('../src/services/mqttService.js');
            
            deviceRepository.getDeviceById.mockResolvedValue({ id: 1, feed_key: 'test-feed' });
            mqtt.publishCommand.mockResolvedValue(true); 

            const response = await request(app)
                .post('/api/devices/1/control') 
                .send({ action: 'on' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mqtt.publishCommand).toHaveBeenCalledWith('test-feed', 'on'); 
        });

        it('should return 404 if device not found', async () => {
            const deviceRepository = require('../src/repositories/DeviceRepository.js');
            deviceRepository.getDeviceById.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/devices/99/control') 
                .send({ action: 'on' })
                .expect(404);

            expect(response.body.error).toBe('Device not found');
        });
    });

    // ==========================================
    // NHÓM 3: CẢM BIẾN & NHẬT KÝ (SENSORS & LOGS)
    // ==========================================
    describe('GET /api/sensors/latest', () => {
        it('should return the latest sensor data', async () => {
            const mockSensorData = { temperature: 28.5, humidity: 65, timestamp: '2026-05-15T10:00:00Z' };
            const logRepository = require('../src/repositories/LogRepository.js');
            logRepository.getLatestSensorData.mockResolvedValue(mockSensorData);

            const response = await request(app).get('/api/sensors/latest').expect(200);
            expect(response.body.temperature).toBe(28.5);
        });
    });

    describe('GET /api/logs', () => {
        it('should return logs with date filter', async () => {
            const mockLogs = [{ id: 1, action: 'Turned on Fan' }];
            const logRepo = require('../src/repositories/LogRepository.js');
            logRepo.getLogs.mockResolvedValue(mockLogs);

            const response = await request(app)
                .get('/api/logs?from=2026-05-01&to=2026-05-30')
                .expect(200);

            expect(response.body).toEqual(mockLogs);
            expect(logRepo.getLogs).toHaveBeenCalledWith('2026-05-01', '2026-05-30');
        });
    });

    // ==========================================
    // NHÓM 4: CẤU HÌNH & TỰ ĐỘNG HÓA (CONFIG & AUTOMATION)
    // ==========================================
    describe('POST /api/config/threshold', () => {
        it('should set temperature threshold successfully', async () => {
            const configRepo = require('../src/repositories/SystemConfigRepository.js');
            configRepo.setThreshold.mockResolvedValue(true);

            const response = await request(app)
                .post('/api/config/threshold')
                .send({ temperature: 35 })
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/automation/mode', () => {
        it('should update automation mode', async () => {
            const automationService = require('../src/services/AutomationService.js');
            automationService.setModeStatus.mockResolvedValue({ mode: 'away', active: true, success: true });

            const response = await request(app)
                .post('/api/automation/mode')
                .send({ mode: 'away', active: true })
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should return 400 if parameters are missing', async () => {
            const response = await request(app).post('/api/automation/mode').send({ mode: 'away' }).expect(400);
            expect(response.body.error).toBe('Tham số không hợp lệ');
        });
    });

    describe('GET /api/automation/settings', () => {
        it('should return current auto mode settings', async () => {
            const mockSettings = { fanTime: "08:00", lightTime: "07:00", fanTemperature: 28 };
            const automationService = require('../src/services/AutomationService.js');
            automationService.getAutoModeSettings.mockResolvedValue(mockSettings);

            const response = await request(app).get('/api/automation/settings').expect(200);
            expect(response.body).toEqual(mockSettings);
        });
    });

    describe('POST /api/automation/settings', () => {
        it('should save new auto mode settings', async () => {
            const newSettings = { fanTime: "09:00", lightTime: "06:30", fanTemperature: 26 };
            const automationService = require('../src/services/AutomationService.js');
            automationService.setAutoModeSettings.mockResolvedValue(newSettings);

            const response = await request(app).post('/api/automation/settings').send(newSettings).expect(200);
            expect(response.body.fanTemperature).toBe(26);
        });
    });

    // ==========================================
    // NHÓM 5: LỖI HỆ THỐNG (ERROR SCENARIOS)
    // ==========================================
    describe('Error Scenarios', () => {
        it('should handle database connection error', async () => {
            const deviceRepository = require('../src/repositories/DeviceRepository.js');
            deviceRepository.getAllDevices.mockRejectedValue(new Error('Database connection failed'));

            const response = await request(app).get('/api/devices').expect(500);
            expect(response.body.error).toBe('Server error'); 
        });
    });
});
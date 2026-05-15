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

// Mock UserRepository để login không cần DB thật
jest.mock('../src/repositories/UserRepository.js', () => ({
    getUserByUsername: jest.fn()
}));

// Mock authMiddleware — named exports, khớp đúng cấu trúc thật
jest.mock('../src/middleware/authMiddleware.js', () => ({
    __esModule: true,
    authMiddleware: jest.fn((req, res, next) => next()), // Bỏ qua xác thực token trong test
    generateToken: jest.fn(() => 'fake-jwt-token'),
    verifyToken: jest.fn(() => ({ id: 1, username: 'admin', role: 'admin' }))
}));

// Mock AutomationService chặn treo vòng lặp Open Handles
jest.mock('../src/services/AutomationService.js', () => ({
    setModeStatus: jest.fn(),
    getAutomationState: jest.fn(),
    getAutoModeSettings: jest.fn(),
    setAutoModeSettings: jest.fn()
}));

// ==========================================
// 2. MOCK USER CHUẨN
// ==========================================
const mockUser = {
    id: 1,
    username: 'admin',
    password: 'password',
    email: 'admin@test.com',
    role: 'admin'
};

describe('API Integration Tests', () => {
    let authToken = 'fake-jwt-token'; // Dùng token giả vì verifyToken đã được mock

    beforeAll(() => {
        process.env.NODE_ENV = 'test';
        process.env.PORT = '3001';
        process.env.JWT_SECRET = 'test-secret';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ==========================================
    // NHÓM 1: ĐĂNG NHẬP (AUTH)
    // ==========================================
    describe('POST /login', () => {
        it('should login successfully', async () => {
            const userRepository = await import('../src/repositories/UserRepository.js');
            userRepository.default.getUserByUsername.mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/login')
                .send({ username: 'admin', password: 'password' })
                .expect(200);

            expect(response.body.token).toBeDefined();
            expect(response.body.message).toBe('Login successful');
        });

        it('should reject login with wrong password', async () => {
            const userRepository = await import('../src/repositories/UserRepository.js');
            userRepository.default.getUserByUsername.mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/login')
                .send({ username: 'admin', password: 'wrongpass' })
                .expect(401);

            expect(response.body.error).toBe('Invalid username or password');
        });

        it('should reject login with non-existent user', async () => {
            const userRepository = await import('../src/repositories/UserRepository.js');
            userRepository.default.getUserByUsername.mockResolvedValue(null);

            const response = await request(app)
                .post('/login')
                .send({ username: 'hacker', password: 'password' })
                .expect(401);

            expect(response.body.error).toBe('Invalid username or password');
        });

        it('should reject login with missing fields', async () => {
            const response = await request(app)
                .post('/login')
                .send({ username: 'admin' }) // Thiếu password
                .expect(400);

            expect(response.body.error).toBe('Username and password required');
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

            const deviceRepository = await import('../src/repositories/DeviceRepository.js');
            deviceRepository.default.getAllDevices.mockResolvedValue(mockDevices);

            const response = await request(app)
                .get('/api/devices')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toEqual(mockDevices);
        });
    });

    describe('POST /api/devices/:id/control', () => {
        it('should control device', async () => {
            const deviceRepository = await import('../src/repositories/DeviceRepository.js');
            const mqtt = await import('../src/services/mqttService.js');

            deviceRepository.default.getDeviceById.mockResolvedValue({ id: 1, feed_key: 'test-feed' });
            mqtt.default.publishCommand.mockResolvedValue(true);

            const response = await request(app)
                .post('/api/devices/1/control')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ action: 'on' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(mqtt.default.publishCommand).toHaveBeenCalledWith('test-feed', 'on');
        });

        it('should return 404 if device not found', async () => {
            const deviceRepository = await import('../src/repositories/DeviceRepository.js');
            deviceRepository.default.getDeviceById.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/devices/99/control')
                .set('Authorization', `Bearer ${authToken}`)
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
            const logRepository = await import('../src/repositories/LogRepository.js');
            logRepository.default.getLatestSensorData.mockResolvedValue(mockSensorData);

            const response = await request(app)
                .get('/api/sensors/latest')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.temperature).toBe(28.5);
        });
    });

    describe('GET /api/logs', () => {
        it('should return logs with date filter', async () => {
            const mockLogs = [{ id: 1, action: 'Turned on Fan' }];
            const logRepository = await import('../src/repositories/LogRepository.js');
            logRepository.default.getLogs.mockResolvedValue(mockLogs);

            const response = await request(app)
                .get('/api/logs?from=2026-05-01&to=2026-05-30')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toEqual(mockLogs);
            expect(logRepository.default.getLogs).toHaveBeenCalledWith('2026-05-01', '2026-05-30');
        });
    });

    // ==========================================
    // NHÓM 4: CẤU HÌNH & TỰ ĐỘNG HÓA (CONFIG & AUTOMATION)
    // ==========================================
    describe('POST /api/config/threshold', () => {
        it('should set temperature threshold successfully', async () => {
            const configRepo = await import('../src/repositories/SystemConfigRepository.js');
            configRepo.default.setThreshold.mockResolvedValue(true);

            const response = await request(app)
                .post('/api/config/threshold')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ temperature: 35 })
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/automation/mode', () => {
        it('should update automation mode', async () => {
            const automationService = await import('../src/services/AutomationService.js');
            automationService.default.setModeStatus.mockResolvedValue({ mode: 'away', active: true, success: true });

            const response = await request(app)
                .post('/api/automation/mode')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ mode: 'away', active: true })
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should return 400 if parameters are missing', async () => {
            const response = await request(app)
                .post('/api/automation/mode')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ mode: 'away' }) // Thiếu active
                .expect(400);

            expect(response.body.error).toBe('Tham số không hợp lệ');
        });
    });

    describe('GET /api/automation/settings', () => {
        it('should return current auto mode settings', async () => {
            const mockSettings = { fanTime: "08:00", lightTime: "07:00", fanTemperature: 28 };
            const automationService = await import('../src/services/AutomationService.js');
            automationService.default.getAutoModeSettings.mockResolvedValue(mockSettings);

            const response = await request(app)
                .get('/api/automation/settings')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toEqual(mockSettings);
        });
    });

    describe('POST /api/automation/settings', () => {
        it('should save new auto mode settings', async () => {
            const newSettings = { fanTime: "09:00", lightTime: "06:30", fanTemperature: 26 };
            const automationService = await import('../src/services/AutomationService.js');
            automationService.default.setAutoModeSettings.mockResolvedValue(newSettings);

            const response = await request(app)
                .post('/api/automation/settings')
                .set('Authorization', `Bearer ${authToken}`)
                .send(newSettings)
                .expect(200);

            expect(response.body.fanTemperature).toBe(26);
        });
    });

    // ==========================================
    // NHÓM 5: LỖI HỆ THỐNG (ERROR SCENARIOS)
    // ==========================================
    describe('Error Scenarios', () => {
        it('should handle database connection error', async () => {
            const deviceRepository = await import('../src/repositories/DeviceRepository.js');
            deviceRepository.default.getAllDevices.mockRejectedValue(new Error('Database connection failed'));

            const response = await request(app)
                .get('/api/devices')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(500);

            expect(response.body.error).toBe('Server error');
        });
    });
});
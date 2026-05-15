import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../test-server.js';

// ============================================================================
// SYSTEM TESTS
// Kiểm tra toàn bộ luồng HTTP: Request → Route → Middleware → Controller → Response
// Không mock DB/Services — chỉ mock external dependencies (MQTT, DB connection)
// ============================================================================

// Mock DB connection để không cần DB thật
jest.mock('../src/config/db.js', () => ({
    execute: jest.fn(),
    query: jest.fn()
}));

// Mock MQTT để không cần broker thật
jest.mock('../src/services/mqttService.js', () => ({
    publishCommand: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn()
}));

// Mock AutomationService để tránh vòng lặp scheduler
jest.mock('../src/services/AutomationService.js', () => ({
    setModeStatus: jest.fn(),
    getAutomationState: jest.fn(),
    getAutoModeSettings: jest.fn(),
    setAutoModeSettings: jest.fn()
}));

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Tạo JWT token hợp lệ để dùng trong các test cần auth
 * Dùng generateToken thật (không mock) để token pass qua authMiddleware thật
 */
async function getValidToken() {
    const { generateToken } = await import('../src/middleware/authMiddleware.js');
    return generateToken({ id: 1, username: 'admin', role: 'admin' });
}

describe('System Tests — Full HTTP Flow', () => {
    let validToken;

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = 'test-secret';
        validToken = await getValidToken();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ============================================================================
    // SYS-01: AUTHENTICATION FLOW
    // ============================================================================
    describe('SYS-01: Authentication Flow', () => {

        it('SYS-01-01: Public route /login không cần token', async () => {
            // Login không có DB thật → expect 500 hoặc 400, nhưng KHÔNG phải 401 từ authMiddleware
            const response = await request(app)
                .post('/login')
                .send({ username: 'admin', password: 'password' });

            // Quan trọng: route public không bị chặn bởi authMiddleware
            expect(response.status).not.toBe(401);
        });

        it('SYS-01-02: Protected route bị chặn khi không có token', async () => {
            const response = await request(app)
                .get('/api/devices');
                // Không đính Authorization header

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('No token provided');
        });

        it('SYS-01-03: Protected route bị chặn khi token sai', async () => {
            const response = await request(app)
                .get('/api/devices')
                .set('Authorization', 'Bearer invalid.token.here');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid token');
        });

        it('SYS-01-04: Protected route cho qua khi token hợp lệ', async () => {
            // Mock repo trả dữ liệu để controller không lỗi
            const deviceRepo = await import('../src/repositories/DeviceRepository.js');
            deviceRepo.default.getAllDevices = jest.fn().mockResolvedValue([]);

            const response = await request(app)
                .get('/api/devices')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
        });

        it('SYS-01-05: Token sai format (thiếu Bearer) bị từ chối', async () => {
            const response = await request(app)
                .get('/api/devices')
                .set('Authorization', validToken); // Thiếu "Bearer "

            expect(response.status).toBe(401);
        });
    });

    // ============================================================================
    // SYS-02: DEVICES FLOW
    // ============================================================================
    describe('SYS-02: Device Management Flow', () => {

        it('SYS-02-01: Lấy danh sách devices thành công', async () => {
            const deviceRepo = await import('../src/repositories/DeviceRepository.js');
            deviceRepo.default.getAllDevices = jest.fn().mockResolvedValue([
                { id: 1, name: 'LED Light', type: 'led', status: 'off' },
                { id: 2, name: 'Fan', type: 'fan', status: 'on' }
            ]);

            const response = await request(app)
                .get('/api/devices')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body).toHaveLength(2);
            expect(response.body[0]).toHaveProperty('id');
            expect(response.body[0]).toHaveProperty('name');
        });

        it('SYS-02-02: Điều khiển device thành công', async () => {
            const deviceRepo = await import('../src/repositories/DeviceRepository.js');
            const mqtt = await import('../src/services/mqttService.js');

            deviceRepo.default.getDeviceById = jest.fn().mockResolvedValue({
                id: 1, name: 'LED Light', feed_key: 'led-feed'
            });
            mqtt.default.publishCommand = jest.fn().mockResolvedValue(true);

            const response = await request(app)
                .post('/api/devices/1/control')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ action: '1' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(mqtt.default.publishCommand).toHaveBeenCalledWith('led-feed', '1');
        });

        it('SYS-02-03: Điều khiển device không tồn tại → 404', async () => {
            const deviceRepo = await import('../src/repositories/DeviceRepository.js');
            deviceRepo.default.getDeviceById = jest.fn().mockResolvedValue(null);

            const response = await request(app)
                .post('/api/devices/999/control')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ action: '1' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Device not found');
        });

        it('SYS-02-04: DB lỗi khi lấy devices → 500', async () => {
            const deviceRepo = await import('../src/repositories/DeviceRepository.js');
            deviceRepo.default.getAllDevices = jest.fn().mockRejectedValue(
                new Error('DB connection failed')
            );

            const response = await request(app)
                .get('/api/devices')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Server error');
        });
    });

    // ============================================================================
    // SYS-03: SENSORS FLOW
    // ============================================================================
    describe('SYS-03: Sensor Data Flow', () => {

        it('SYS-03-01: Lấy dữ liệu cảm biến mới nhất', async () => {
            const logRepo = await import('../src/repositories/LogRepository.js');
            logRepo.default.getLatestSensorData = jest.fn().mockResolvedValue({
                temperature: 28.5,
                humidity: 65,
                timestamp: '2026-05-15T10:00:00Z'
            });

            const response = await request(app)
                .get('/api/sensors/latest')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('temperature');
            expect(response.body).toHaveProperty('humidity');
            expect(response.body).toHaveProperty('timestamp');
            expect(typeof response.body.temperature).toBe('number');
        });

        it('SYS-03-02: Không có dữ liệu cảm biến → trả về giá trị mặc định', async () => {
            const logRepo = await import('../src/repositories/LogRepository.js');
            logRepo.default.getLatestSensorData = jest.fn().mockResolvedValue(null);

            const response = await request(app)
                .get('/api/sensors/latest')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            // Controller trả về giá trị mặc định khi data null
            expect(response.body.temperature).toBe(30.5);
            expect(response.body.humidity).toBe(70);
        });
    });

    // ============================================================================
    // SYS-04: LOGS FLOW
    // ============================================================================
    describe('SYS-04: Logs Flow', () => {

        it('SYS-04-01: Lấy logs với bộ lọc ngày', async () => {
            const logRepo = await import('../src/repositories/LogRepository.js');
            logRepo.default.getLogs = jest.fn().mockResolvedValue([
                { id: 1, action: 'Turned on LED', timestamp: '2026-05-10T08:00:00Z' },
                { id: 2, action: 'Turned off Fan', timestamp: '2026-05-11T09:00:00Z' }
            ]);

            const response = await request(app)
                .get('/api/logs?from=2026-05-01&to=2026-05-30')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(logRepo.default.getLogs).toHaveBeenCalledWith('2026-05-01', '2026-05-30');
        });

        it('SYS-04-02: Lấy logs không có filter → vẫn hoạt động', async () => {
            const logRepo = await import('../src/repositories/LogRepository.js');
            logRepo.default.getLogs = jest.fn().mockResolvedValue([]);

            const response = await request(app)
                .get('/api/logs')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
        });
    });

    // ============================================================================
    // SYS-05: CONFIG FLOW
    // ============================================================================
    describe('SYS-05: System Config Flow', () => {

        it('SYS-05-01: Cập nhật ngưỡng nhiệt độ thành công', async () => {
            const configRepo = await import('../src/repositories/SystemConfigRepository.js');
            configRepo.default.setThreshold = jest.fn().mockResolvedValue(true);

            const response = await request(app)
                .post('/api/config/threshold')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ temperature: 35 });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.temperature).toBe(35);
        });
    });

    // ============================================================================
    // SYS-06: AUTOMATION FLOW
    // ============================================================================
    describe('SYS-06: Automation Flow', () => {

        it('SYS-06-01: Cập nhật chế độ automation thành công', async () => {
            const automationService = await import('../src/services/AutomationService.js');
            automationService.default.setModeStatus = jest.fn().mockResolvedValue({
                mode: 'away', active: true, success: true
            });

            const response = await request(app)
                .post('/api/automation/mode')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ mode: 'away', active: true });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('SYS-06-02: Thiếu tham số active → 400', async () => {
            const response = await request(app)
                .post('/api/automation/mode')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ mode: 'away' }); // Thiếu active

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Tham số không hợp lệ');
        });

        it('SYS-06-03: active không phải boolean → 400', async () => {
            const response = await request(app)
                .post('/api/automation/mode')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ mode: 'away', active: 'yes' }); // active là string, không phải boolean

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Tham số không hợp lệ');
        });

        it('SYS-06-04: Lấy cài đặt automation', async () => {
            const mockSettings = { fanTime: '08:00', lightTime: '07:00', fanTemperature: 28 };
            const automationService = await import('../src/services/AutomationService.js');
            automationService.default.getAutoModeSettings = jest.fn().mockResolvedValue(mockSettings);

            const response = await request(app)
                .get('/api/automation/settings')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('fanTime');
            expect(response.body).toHaveProperty('lightTime');
            expect(response.body).toHaveProperty('fanTemperature');
        });

        it('SYS-06-05: Lưu cài đặt automation thành công', async () => {
            const newSettings = { fanTime: '09:00', lightTime: '06:30', fanTemperature: 26 };
            const automationService = await import('../src/services/AutomationService.js');
            automationService.default.setAutoModeSettings = jest.fn().mockResolvedValue(newSettings);

            const response = await request(app)
                .post('/api/automation/settings')
                .set('Authorization', `Bearer ${validToken}`)
                .send(newSettings);

            expect(response.status).toBe(200);
            expect(response.body.fanTemperature).toBe(26);
        });

        it('SYS-06-06: Lưu cài đặt automation thiếu tham số → 400', async () => {
            const response = await request(app)
                .post('/api/automation/settings')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ fanTime: '09:00' }); // Thiếu lightTime và fanTemperature

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Missing required parameters');
        });

        it('SYS-06-07: Lấy trạng thái automation', async () => {
            const automationService = await import('../src/services/AutomationService.js');
            automationService.default.getAutomationState = jest.fn().mockReturnValue({
                mode: 'home', active: true
            });

            const response = await request(app)
                .get('/api/automation/state')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
        });
    });

    // ============================================================================
    // SYS-07: ROUTE NOT FOUND
    // ============================================================================
    describe('SYS-07: Unknown Routes', () => {

        it('SYS-07-01: Route không tồn tại → 404', async () => {
            const response = await request(app)
                .get('/api/nonexistent')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(404);
        });
    });
});
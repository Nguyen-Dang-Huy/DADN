// src/repositories/LogRepository.js
const db = require('../config/db'); // Giả sử bạn đã setup kết nối mysql2 pool ở đây

class LogRepository {
    async getLatestSensorData() {
        // Truy vấn dữ liệu lịch sử mới nhất từ DB [cite: 11]
        const [rows] = await db.query('SELECT * FROM sensor_logs ORDER BY timestamp DESC LIMIT 1');
        return rows[0];
    }

    async getLogs(fromDate, toDate) {
        // Truy vấn lịch sử hoạt động [cite: 101]
        const [rows] = await db.query(
            'SELECT * FROM action_logs WHERE time >= ? AND time <= ? ORDER BY time DESC',
            [fromDate, toDate]
        );
        return rows;
    }
}

module.exports = new LogRepository();
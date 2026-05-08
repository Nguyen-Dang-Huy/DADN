// src/repositories/LogRepository.js
import db from '../config/db.js';

class LogRepository {
    async getLatestSensorData() {
        const [rows] = await db.query('SELECT * FROM sensor_logs ORDER BY timestamp DESC LIMIT 1');
        return rows[0];
    }

    async addActionLog(device, action) {
        await db.query(
            'INSERT INTO action_logs (device, action) VALUES (?, ?)',
            [device, action]
        );
    }

    async getLogs(fromDate, toDate, type) {
        const conditions = [];
        const params = [];

        if (fromDate) {
            conditions.push('time >= ?');
            params.push(`${fromDate} 00:00:00`);
        }
        if (toDate) {
            conditions.push('time <= ?');
            params.push(`${toDate} 23:59:59`);
        }

        if (type === 'device') {
            conditions.push("action NOT LIKE '%threshold%' AND action NOT LIKE '%set temperature threshold%'");
        } else if (type === 'config') {
            conditions.push("(action LIKE '%threshold%' OR action LIKE '%set temperature threshold%')");
        }

        const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
        const [rows] = await db.query(
            `SELECT * FROM action_logs${whereClause} ORDER BY time DESC`,
            params
        );
        return rows;
    }
}

export default new LogRepository();

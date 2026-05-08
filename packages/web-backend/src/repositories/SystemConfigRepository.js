// src/repositories/SystemConfigRepository.js
import db from '../config/db.js';

class SystemConfigRepository {
    async getThreshold() {
        const [rows] = await db.query('SELECT value FROM system_configs WHERE key_name = "temperature_threshold"');
        return rows[0] ? parseFloat(rows[0].value) : 30; // Default 30°C
    }

    async setThreshold(value) {
        await db.query(
            'INSERT INTO system_configs (key_name, value) VALUES ("temperature_threshold", ?) ON DUPLICATE KEY UPDATE value = ?',
            [value, value]
        );
    }
}

export default new SystemConfigRepository();
// src/repositories/DeviceRepository.js
import db from '../config/db.js';

class DeviceRepository {
    async getAllDevices() {
        const [rows] = await db.query('SELECT * FROM devices');
        return rows;
    }

    async getDeviceById(id) {
        const [rows] = await db.query('SELECT * FROM devices WHERE id = ?', [id]);
        return rows[0];
    }

    async addDevice(device) {
        const { name, type, status } = device;
        const [result] = await db.query('INSERT INTO devices (name, type, status) VALUES (?, ?, ?)', [name, type, status]);
        return result.insertId;
    }

    async updateDevice(id, device) {
        const { name, type, status } = device;
        await db.query('UPDATE devices SET name = ?, type = ?, status = ? WHERE id = ?', [name, type, status, id]);
    }

    async deleteDevice(id) {
        await db.query('DELETE FROM devices WHERE id = ?', [id]);
    }
}

export default new DeviceRepository();
import db from '../config/db.js';

class UserRepository {
    async getUserByUsername(username) {
        try {
            const [results] = await db.execute(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('Error getting user by username:', error);
            throw error;
        }
    }

    async getUserById(id) {
        try {
            const [results] = await db.execute(
                'SELECT id, username, email, role FROM users WHERE id = ?',
                [id]
            );
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('Error getting user by ID:', error);
            throw error;
        }
    }

    async createUser(username, hashedPassword, email = null, role = 'user') {
        try {
            const [result] = await db.execute(
                'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
                [username, hashedPassword, email, role]
            );
            return { id: result.insertId, username, email, role };
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    async updateUser(id, updates) {
        try {
            const fields = [];
            const values = [];

            if (updates.email !== undefined) {
                fields.push('email = ?');
                values.push(updates.email);
            }
            if (updates.password !== undefined) {
                fields.push('password = ?');
                values.push(updates.password);
            }

            if (fields.length === 0) {
                return { id };
            }

            values.push(id);
            const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
            await db.execute(query, values);

            return await this.getUserById(id);
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }

    async getAllUsers() {
        try {
            const [results] = await db.execute(
                'SELECT id, username, email, role FROM users'
            );
            return results;
        } catch (error) {
            console.error('Error getting all users:', error);
            throw error;
        }
    }

    async deleteUser(id) {
        try {
            await db.execute('DELETE FROM users WHERE id = ?', [id]);
            return { success: true };
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }
}

export default new UserRepository();
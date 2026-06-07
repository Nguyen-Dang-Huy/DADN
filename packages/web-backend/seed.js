import bcrypt from 'bcrypt';
import db from './src/config/db.js';

async function seedUsers() {
    try {
        console.log('Starting user seed...');

        // Hash password
        const hashedPassword = await bcrypt.hash('password', 10);

        // Check if admin user already exists
        const [existingUsers] = await db.execute(
            'SELECT id FROM users WHERE username = ?',
            ['admin']
        );

        if (existingUsers.length > 0) {
            console.log('Admin user already exists');
            return;
        }

        // Insert demo users
        await db.execute(
            'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
            ['admin', hashedPassword, 'admin@smarthome.local', 'admin']
        );

        await db.execute(
            'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
            ['user', hashedPassword, 'user@smarthome.local', 'user']
        );

        console.log(' Users seeded successfully');
        console.log('Demo accounts:');
        console.log('  - Username: admin, Password: password');
        console.log('  - Username: user, Password: password');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding users:', error);
        process.exit(1);
    }
}

seedUsers();
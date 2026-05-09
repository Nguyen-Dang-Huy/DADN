// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiRoutes from './src/routes/apiRoutes.js';
import db from './src/config/db.js';

// Import SchedulerService để chạy tự động hóa ngầm
import schedulerService from './src/services/SchedulerService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json()); // Để parse JSON body

const PORT = process.env.PORT || 3000;

async function migrateFeedKeys() {
    await db.execute(
        'UPDATE devices SET feed_key = ? WHERE feed_key = ?',
        ['rgb-state', 'led-state']
    );
}

async function startServer() {
    await migrateFeedKeys();

    // Đăng ký routes
    app.use('/', apiRoutes);

    // Khởi chạy hệ thống đặt lịch tự động hóa (Cron jobs)
    schedulerService.initSchedules();

    app.listen(PORT, () => {
        console.log(`Backend Server is running on port ${PORT}`);
    });
}

startServer().catch((error) => {
    console.error('Failed to start backend server:', error);
    process.exit(1);
});
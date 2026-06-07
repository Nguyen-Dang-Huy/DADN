import express from 'express';
import apiController from '../controllers/ApiController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/api/auth/login', apiController.login);

// Protected routes (require authentication)
router.use(authMiddleware);
router.get('/api/sensors/latest', apiController.getLatestSensors);
router.get('/api/devices', apiController.getAllDevices);
router.post('/api/devices/:id/control', apiController.controlDevice); 
router.post('/api/config/threshold', apiController.configThreshold); 
router.get('/api/logs', apiController.getLogs);

// --- API AUTOMATION ---
router.post('/api/automation/mode', apiController.setAutomationMode);
router.get('/api/automation/state', apiController.getAutomationState);
router.get('/api/automation/settings', apiController.getAutomationSettings);
router.post('/api/automation/settings', apiController.setAutomationSettings);

export default router;
import express from 'express';
import apiController from '../controllers/ApiController.js';

const router = express.Router();

// Các Endpoint 
router.post('/login', apiController.login);
router.get('/api/sensors/latest', apiController.getLatestSensors);
router.get('/api/devices', apiController.getAllDevices);
router.post('/api/devices/:id/control', apiController.controlDevice); 
router.post('/api/config/threshold', apiController.configThreshold); 
router.get('/api/logs', apiController.getLogs);

// --- API AUTOMATION ---
router.post('/api/automation/mode', apiController.setAutomationMode);
router.get('/api/automation/state', apiController.getAutomationState); // <-- Dòng vừa được thêm

export default router;
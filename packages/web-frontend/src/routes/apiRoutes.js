// src/routes/apiRoutes.js
const express = require('express');
const router = express.Router();
const apiController = require('../controllers/ApiController');

// Các Endpoint 
router.post('/login', apiController.login); [cite: 65]
router.get('/api/sensors/latest', apiController.getLatestSensors); [cite: 76]
router.post('/api/devices/:id/control', apiController.controlDevice); [cite: 86]
router.post('/api/config/threshold', apiController.configThreshold); [cite: 94]
router.get('/api/logs', apiController.getLogs); [cite: 102]

module.exports = router;
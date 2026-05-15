import express from 'express';
import cors from 'cors';
import apiRoutes from './src/routes/apiRoutes.js';

// Create test app without starting server
const app = express();
app.use(cors());
app.use(express.json());
app.use('/', apiRoutes);

export default app;
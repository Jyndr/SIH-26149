
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import connectDB from './config/database.js';
import logger from './utils/logger.js';
import errorHandler from './middleware/errorHandler.js';

import healthRoutes from './routes/health.js';
import caseRoutes from './routes/case.routes.js';
import authRoutes from './routes/auth.routes.js';
import evidenceRoutes from './routes/evidence.routes.js';
import jobRoutes from './routes/job.routes.js';
import analysisRoutes from './routes/analysis.routes.js';
import recoveryRoutes from './routes/recovery.routes.js';
import sanitizationRoutes from './routes/sanitization.routes.js';
import auditRoutes from './routes/audit.routes.js';
import reportRoutes from './routes/report.routes.js';
import forensicRoutes from './routes/forensic.routes.js';
import nativeAgentRoutes from './routes/nativeAgent.routes.js';


const app = express();

const PORT = process.env.PORT || 5001;
const isDev = process.env.NODE_ENV !== 'production';

app.use(
  helmet({
    contentSecurityPolicy: false,
    hsts: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

const allowedOrigins = [
  'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:5001',
  'http://localhost:3000',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5001',
  'http://127.0.0.1:3000',
  ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()) : [])
];


app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || isDev) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition']
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 5,
  message: 'Too many authentication attempts, please try again later'
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  message: 'Too many requests, please try again later'
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/cases', caseRoutes);
app.use('/api/v1', evidenceRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1', analysisRoutes);
app.use('/api/v1', recoveryRoutes);
app.use('/api/v1', sanitizationRoutes);
app.use('/api/v1', auditRoutes);
app.use('/api/v1', reportRoutes);
app.use('/api/v1', forensicRoutes);
app.use('/api/v1', nativeAgentRoutes);

// Serve frontend static build if available
const clientDistPath = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // SPA fallback for client-side routing (non-API GET requests)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found'
    }
  });
});

app.use(errorHandler);


const startServer = async () => {
  try {
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    await connectDB();
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;

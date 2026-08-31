
import 'dotenv/config';

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


const app = express();

const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

app.use(
  helmet({
    contentSecurityPolicy: false,
    hsts: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
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

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found'
    }
  });
});

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;


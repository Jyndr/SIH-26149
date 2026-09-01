import 'dotenv/config';
import express from 'express';

import healthRoutes from './src/routes/health.js';
import caseRoutes from './src/routes/case.routes.js';
import authRoutes from './src/routes/auth.routes.js';
import evidenceRoutes from './src/routes/evidence.routes.js';
import jobRoutes from './src/routes/job.routes.js';
import analysisRoutes from './src/routes/analysis.routes.js';
import recoveryRoutes from './src/routes/recovery.routes.js';
import sanitizationRoutes from './src/routes/sanitization.routes.js';
import auditRoutes from './src/routes/audit.routes.js';
import reportRoutes from './src/routes/report.routes.js';

const app = express();

app.use(express.json());

console.log('Registering health');
app.use('/api/v1/health', healthRoutes);

console.log('Registering auth');
app.use('/api/v1/auth', authRoutes);

console.log('Registering cases');
app.use('/api/v1/cases', caseRoutes);

console.log('Registering evidence');
app.use('/api/v1', evidenceRoutes);

console.log('Registering jobs');
app.use('/api/v1/jobs', jobRoutes);

console.log('Registering analysis');
app.use('/api/v1', analysisRoutes);

console.log('Registering recovery');
app.use('/api/v1', recoveryRoutes);

console.log('Registering sanitization');
app.use('/api/v1', sanitizationRoutes);

console.log('Registering audit');
app.use('/api/v1', auditRoutes);

console.log('Registering reports');
app.use('/api/v1', reportRoutes);

console.log('All routes registered');

app.listen(3001, () => {
  console.log('Test server running on 3001');
});
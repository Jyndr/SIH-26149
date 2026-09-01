import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.MOCK_PYTHON_PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory job storage
const jobs = new Map();
let jobIdCounter = 1;

const generateJobId = () => `py-job-${jobIdCounter++}`;

// Health endpoint
app.get('/internal/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0-mock',
    timestamp: new Date().toISOString()
  });
});

// Analyze endpoint
app.post('/internal/v1/analyze', (req, res) => {
  const { filePath, options } = req.body;
  const jobId = generateJobId();
  
  jobs.set(jobId, {
    jobId,
    status: 'QUEUED',
    type: 'ANALYSIS',
    progress: 0,
    startedAt: null,
    completedAt: null,
    result: null,
    error: null
  });
  
  // Simulate processing
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'RUNNING';
      job.startedAt = new Date().toISOString();
      job.progress = 50;
    }
  }, 1000);
  
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'COMPLETED';
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      job.result = {
        filesystem: 'NTFS',
        files: [
          { name: 'document.docx', size: 24576, type: 'document' },
          { name: 'image.jpg', size: 524288, type: 'image' },
          { name: 'data.csv', size: 1024, type: 'data' }
        ],
        metadata: {
          totalFiles: 3,
          totalSize: 550888,
          analysisTime: 2.5
        }
      };
    }
  }, 3000);
  
  res.json({ jobId });
});

// Recover endpoint
app.post('/internal/v1/recover', (req, res) => {
  const { filePath, targetPath, options } = req.body;
  const jobId = generateJobId();
  
  jobs.set(jobId, {
    jobId,
    status: 'QUEUED',
    type: 'RECOVERY',
    progress: 0,
    startedAt: null,
    completedAt: null,
    result: null,
    error: null
  });
  
  // Simulate processing
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'RUNNING';
      job.startedAt = new Date().toISOString();
      job.progress = 30;
    }
  }, 1000);
  
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      job.progress = 70;
    }
  }, 2000);
  
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'COMPLETED';
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      job.result = {
        recoveredFiles: [
          { path: `${targetPath}/recovered_document.docx`, size: 24576, hash: 'abc123' },
          { path: `${targetPath}/recovered_image.jpg`, size: 524288, hash: 'def456' }
        ],
        totalRecovered: 2,
        totalSize: 548864
      };
    }
  }, 4000);
  
  res.json({ jobId });
});

// Sanitize endpoint
app.post('/internal/v1/sanitize', (req, res) => {
  const { target, method } = req.body;
  const jobId = generateJobId();
  
  jobs.set(jobId, {
    jobId,
    status: 'QUEUED',
    type: 'SANITIZATION',
    progress: 0,
    startedAt: null,
    completedAt: null,
    result: null,
    error: null
  });
  
  // Simulate processing
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'RUNNING';
      job.startedAt = new Date().toISOString();
      job.progress = 40;
    }
  }, 1000);
  
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'COMPLETED';
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      job.result = {
        sanitized: true,
        method: method || 'zero-fill',
        verification: {
          passed: true,
          sectors: 1024,
          verified: 1024
        }
      };
    }
  }, 3000);
  
  res.json({ jobId });
});

// Verify endpoint
app.post('/internal/v1/verify', (req, res) => {
  const { target } = req.body;
  const jobId = generateJobId();
  
  jobs.set(jobId, {
    jobId,
    status: 'QUEUED',
    type: 'VERIFICATION',
    progress: 0,
    startedAt: null,
    completedAt: null,
    result: null,
    error: null
  });
  
  // Simulate processing
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'RUNNING';
      job.startedAt = new Date().toISOString();
      job.progress = 50;
    }
  }, 500);
  
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'COMPLETED';
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      job.result = {
        verified: true,
        hash: 'mock-hash-123456',
        algorithm: 'SHA-256'
      };
    }
  }, 1500);
  
  res.json({ jobId });
});

// Job status endpoint
app.get('/internal/v1/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  
  if (!job) {
    return res.status(404).json({
      error: 'Job not found'
    });
  }
  
  res.json(job);
});

app.listen(PORT, () => {
  console.log(`Mock Python server running on port ${PORT}`);
});

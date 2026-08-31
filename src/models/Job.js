import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true,
    index: true
  },
  evidenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evidence'
  },
  type: {
    type: String,
    enum: ['ANALYSIS', 'RECOVERY', 'CARVING', 'SANITIZATION', 'VERIFICATION', 'REPORT'],
    required: true
  },
  status: {
    type: String,
    enum: ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'QUEUED'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  stage: {
    type: String
  },
  pythonJobId: {
    type: String
  },
  result: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    code: String,
    message: String
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index for dashboard listing
jobSchema.index({ caseId: 1, type: 1, status: 1 });

// Index for Python job ID lookup
jobSchema.index({ pythonJobId: 1 });

const Job = mongoose.model('Job', jobSchema);

export default Job;

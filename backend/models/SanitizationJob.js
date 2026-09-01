import mongoose from 'mongoose';

const sanitizationJobSchema = new mongoose.Schema({
  sanitizationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
    index: true
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true,
    index: true
  },
  target: {
    type: String,
    required: true
  },
  targetType: {
    type: String,
    enum: ['FILE', 'FOLDER', 'DRIVE'],
    required: true
  },
  method: {
    type: String,
    enum: ['ZERO_FILL', 'RANDOM', 'CRYPTO_ERASE'],
    default: 'ZERO_FILL'
  },
  status: {
    type: String,
    enum: ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'],
    default: 'QUEUED'
  },
  verification: {
    passed: {
      type: Boolean,
      default: false
    },
    sectors: {
      type: Number
    },
    verified: {
      type: Number
    },
    hash: {
      type: String
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index for dashboard listing
sanitizationJobSchema.index({ caseId: 1, status: 1 });

const SanitizationJob = mongoose.model('SanitizationJob', sanitizationJobSchema);

export default SanitizationJob;

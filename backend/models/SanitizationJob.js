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
  targetReference: { type: String },
  method: {
    type: String,
    enum: ['CLEAR', 'PURGE', 'CRYPTOGRAPHIC_ERASE', 'DESTROY', 'ZERO_FILL', 'RANDOM', 'CRYPTO_ERASE'],
    default: 'CLEAR'
  },
  status: {
    type: String,
    enum: ['QUEUED', 'RUNNING', 'DRY_RUN', 'FAILED'],
    default: 'QUEUED'
  },
  mode: { type: String, enum: ['DRY_RUN'], default: 'DRY_RUN' },
  executed: { type: Boolean, default: false },
  supported: { type: Boolean, default: false },
  reason: { type: String, default: 'Real sanitization provider not enabled.' },
  requirements: { type: [String], default: [] },
  counteredRecoveryPaths: { type: [String], default: [] },
  verificationStatus: { type: String, enum: ['NOT_EXECUTED'], default: 'NOT_EXECUTED' },
  verification: {
    passed: {
      type: Boolean,
      default: undefined
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

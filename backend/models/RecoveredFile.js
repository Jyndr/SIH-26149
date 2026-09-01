import mongoose from 'mongoose';

const recoveredFileSchema = new mongoose.Schema({
  recoveredFileId: {
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
  evidenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evidence',
    required: true,
    index: true
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true,
    index: true
  },
  originalPath: {
    type: String
  },
  recoveredPath: {
    type: String
  },
  size: {
    type: Number
  },
  hash: {
    type: String
  },
  fileType: {
    type: String
  },
  recoveryStatus: {
    type: String,
    enum: ['SUCCESS', 'PARTIAL', 'FAILED'],
    default: 'SUCCESS'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Compound index for listing recovered files by job
recoveredFileSchema.index({ jobId: 1, createdAt: -1 });

const RecoveredFile = mongoose.model('RecoveredFile', recoveredFileSchema);

export default RecoveredFile;

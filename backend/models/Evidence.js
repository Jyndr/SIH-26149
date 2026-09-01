import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema({
  evidenceId: {
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
  originalFilename: {
    type: String
  },
  storedFilename: {
    type: String
  },
  size: {
    type: Number
  },
  mimeType: {
    type: String
  },
  sha256: {
    type: String
  },
  storagePath: {
    type: String
  },
  filesystem: {
    type: mongoose.Schema.Types.Mixed
  },
  analysisStatus: {
    type: String,
    enum: ['PENDING', 'ANALYZING', 'ANALYZED', 'FAILED'],
    default: 'PENDING'
  },
  integrity: {
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date
    },
    currentHash: {
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

// Compound index for listing evidence by case
evidenceSchema.index({ caseId: 1, createdAt: -1 });

// Compound unique index to prevent duplicate uploads within a case
evidenceSchema.index({ caseId: 1, sha256: 1 }, { unique: true });

const Evidence = mongoose.model('Evidence', evidenceSchema);

export default Evidence;

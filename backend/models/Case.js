import mongoose from 'mongoose';

const caseSchema = new mongoose.Schema({
  caseId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  investigators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED'],
    default: 'OPEN'
  }
}, {
  timestamps: true
});

// Compound index for dashboard listing
caseSchema.index({ status: 1, createdAt: -1 });

const Case = mongoose.model('Case', caseSchema);

export default Case;

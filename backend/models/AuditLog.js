import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  auditId: { type: String, required: true, unique: true, index: true },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
  evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  operation: { type: String, required: true, trim: true },
  target: { type: String, required: true, trim: true },
  result: { type: String, enum: ['SUCCESS', 'FAILURE'], required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, required: true, default: Date.now, immutable: true },
  previousHash: { type: String, default: null, immutable: true },
  recordHash: { type: String, required: true, immutable: true }
}, { timestamps: false });

auditLogSchema.index({ caseId: 1, timestamp: -1, _id: -1 });

export default mongoose.model('AuditLog', auditLogSchema);

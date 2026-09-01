import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reportId: { type: String, required: true, unique: true, index: true },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
  type: { type: String, enum: ['CASE_SUMMARY', 'RECOVERY_REPORT', 'SANITIZATION_CERTIFICATE', 'AUDIT_REPORT'], required: true },
  generatedAt: { type: Date, required: true, default: Date.now },
  filePath: { type: String, required: true },
  hash: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

reportSchema.index({ caseId: 1, type: 1, generatedAt: -1 });

export default mongoose.model('Report', reportSchema);

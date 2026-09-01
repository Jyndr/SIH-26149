import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Case from '../models/Case.js';
import Evidence from '../models/Evidence.js';
import RecoveredFile from '../models/RecoveredFile.js';
import SanitizationJob from '../models/SanitizationJob.js';
import Job from '../models/Job.js';
import AuditLog from '../models/AuditLog.js';
import Report from '../models/Report.js';
import jobService from './job.service.js';
import auditService from './audit/audit.service.js';
import storageService from './storage/storage.service.js';
import hashService from './hash/hash.service.js';

const generateReportId = () => `RPT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const buildContent = async (caseDoc, type) => {
  const [evidence, jobs, recoveredFiles, sanitizationJobs, auditEntries] = await Promise.all([
    Evidence.find({ caseId: caseDoc._id }).lean(),
    Job.find({ caseId: caseDoc._id }).lean(),
    RecoveredFile.find({ caseId: caseDoc._id }).lean(),
    SanitizationJob.find({ caseId: caseDoc._id }).lean(),
    AuditLog.find({ caseId: caseDoc._id }).sort({ timestamp: 1, _id: 1 }).lean()
  ]);
  const document = {
    reportVersion: 1,
    reportType: type,
    generatedAt: new Date().toISOString(),
    case: { caseId: caseDoc.caseId, title: caseDoc.title, description: caseDoc.description, status: caseDoc.status, createdAt: caseDoc.createdAt }
  };
  if (type === 'CASE_SUMMARY') Object.assign(document, { evidence, jobs });
  if (type === 'RECOVERY_REPORT') Object.assign(document, { recoveredFiles });
  if (type === 'SANITIZATION_CERTIFICATE') Object.assign(document, { sanitizationJobs });
  if (type === 'AUDIT_REPORT') Object.assign(document, { auditEntries });
  return document;
};

const reportService = {
  async create(caseId, type, userId) {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) throw new Error('Case not found');
    const job = await jobService.create({ caseId: caseDoc._id, type: 'REPORT', options: { type } }, userId);
    try {
      await jobService.updateStatus(job.jobId, 'RUNNING', { stage: 'assembling report' });
      const reportId = generateReportId();
      const reportDirectory = path.resolve(storageService.getReportsStoragePath());
      await fs.promises.mkdir(reportDirectory, { recursive: true });
      const filePath = path.join(reportDirectory, `${reportId}.json`);
      const content = await buildContent(caseDoc, type);
      await fs.promises.writeFile(filePath, `${JSON.stringify(content, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      const hash = await hashService.computeSHA256FromFile(filePath);
      const report = await Report.create({ reportId, caseId: caseDoc._id, type, generatedAt: new Date(), filePath, hash, createdBy: userId });
      await jobService.updateStatus(job.jobId, 'COMPLETED', { progress: 100, stage: 'report generated', result: { reportId, hash } });
      await auditService.record({ caseId: caseDoc._id, jobId: job._id, actor: userId, operation: 'REPORT_GENERATED', target: `Report ${reportId}`, details: { type, hash } });
      return { job, report };
    } catch (error) {
      await jobService.updateStatus(job.jobId, 'FAILED', { error: { code: 'REPORT_GENERATION_FAILED', message: error.message } });
      throw error;
    }
  },

  async listByCase(caseId, { page = 1, limit = 50 } = {}) {
    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
      Report.find({ caseId }).sort({ generatedAt: -1, _id: -1 }).skip(skip).limit(limit),
      Report.countDocuments({ caseId })
    ]);
    return { reports, total, page, limit };
  },

  async getByReportId(reportId) { return Report.findOne({ reportId }); },

  async getDownload(reportId) {
    const report = await Report.findOne({ reportId });
    if (!report) return null;
    const reportsRoot = path.resolve(storageService.getReportsStoragePath());
    const filePath = path.resolve(report.filePath);
    if (path.dirname(filePath) !== reportsRoot) throw new Error('Invalid report storage path');
    await fs.promises.access(filePath, fs.constants.R_OK);
    return { report, filePath };
  }
};

export default reportService;

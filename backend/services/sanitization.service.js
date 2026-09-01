import SanitizationJob from '../models/SanitizationJob.js';
import jobService from './job.service.js';
import sanitizeService from './python/sanitize.js';
import verifyService from './python/verify.js';
import auditService from './audit/audit.service.js';
import logger from '../utils/logger.js';

const generateSanitizationId = () => {
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `SAN-${random}`;
};

const sanitizationService = {
  startSanitize: async ({ target, targetType, method, caseId, userId }) => {
    const job = await jobService.create({
      caseId,
      type: 'SANITIZATION'
    }, userId);

    const sanitizationJob = await SanitizationJob.create({
      sanitizationId: generateSanitizationId(),
      jobId: job._id,
      caseId,
      target,
      targetType,
      method,
      status: 'QUEUED',
      createdBy: userId
    });

    setImmediate(() => {
      sanitizationService.runSanitize(job.jobId, sanitizationJob.sanitizationId, userId).catch((error) => {
        logger.error(`Background sanitization failed: ${error.message}`);
      });
    });

    return { job, sanitizationJob };
  },

  runSanitize: async (jobId, sanitizationId, userId) => {
    const sanitizationJob = await SanitizationJob.findOne({ sanitizationId });
    try {
      await jobService.updateStatus(jobId, 'RUNNING', { startedAt: new Date(), progress: 10, stage: 'wiping' });
      sanitizationJob.status = 'RUNNING';
      await sanitizationJob.save();

      const result = await sanitizeService.sanitizeTarget(sanitizationJob.target, sanitizationJob.method);

      sanitizationJob.status = 'COMPLETED';
      sanitizationJob.verification = result.verification;
      await sanitizationJob.save();

      await auditService.record({
        caseId: sanitizationJob.caseId,
        actor: userId,
        operation: 'SANITIZE',
        target: sanitizationJob.target,
        details: { method: sanitizationJob.method, verification: result.verification }
      });

      await jobService.updateStatus(jobId, 'COMPLETED', {
        progress: 100,
        stage: 'completed',
        result
      });
    } catch (error) {
      sanitizationJob.status = 'FAILED';
      await sanitizationJob.save();
      await jobService.updateStatus(jobId, 'FAILED', {
        error: { code: 'SANITIZE_ERROR', message: error.message }
      });
      throw error;
    }
  },

  verifyTarget: async (target, userId, caseId) => {
    const job = await jobService.create({ caseId, type: 'VERIFICATION' }, userId);
    await jobService.updateStatus(job.jobId, 'RUNNING', { startedAt: new Date() });
    const result = await verifyService.verifyTarget(target);
    await jobService.updateStatus(job.jobId, 'COMPLETED', { progress: 100, result });
    return { job, result };
  },

  getSanitizationJob: async (sanitizationId) => SanitizationJob.findOne({ sanitizationId }),

  listByCase: async (caseId) =>
    SanitizationJob.find({ caseId }).populate('jobId', 'jobId status progress').sort({ createdAt: -1 })
};

export default sanitizationService;

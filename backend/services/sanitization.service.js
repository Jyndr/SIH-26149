import SanitizationJob from '../models/SanitizationJob.js';
import jobService from './job.service.js';
import nativeAgent from './nativeAgent.service.js';
import verifyService from './python/verify.js';
import auditService from './audit/audit.service.js';
import logger from '../utils/logger.js';
import Case from '../models/Case.js';

const generateSanitizationId = () => {
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `SAN-${random}`;
};

const sanitizationService = {
  startSanitize: async ({ target, targetType, targetReference, method, caseId, userId }) => {
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
      targetReference,
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
      await jobService.updateStatus(jobId, 'RUNNING', { startedAt: new Date(), progress: 10, stage: 'dry-run-planning' });
      sanitizationJob.status = 'RUNNING';
      await sanitizationJob.save();

      const caseDoc = await Case.findById(sanitizationJob.caseId);
      const result = await nativeAgent.startSanitization({
        deviceId: sanitizationJob.target,
        caseId: caseDoc?.caseId || String(sanitizationJob.caseId),
        method: sanitizationJob.method,
        targetScope: sanitizationJob.targetType === 'FILE' ? 'FILE' : 'DEVICE',
        artifactId: sanitizationJob.targetReference || undefined
      });

      sanitizationJob.status = 'DRY_RUN';
      sanitizationJob.mode = 'DRY_RUN';
      sanitizationJob.executed = false;
      sanitizationJob.supported = false;
      sanitizationJob.reason = result.reason;
      sanitizationJob.requirements = result.requirements || [];
      sanitizationJob.counteredRecoveryPaths = result.counteredRecoveryPaths || [];
      sanitizationJob.verificationStatus = 'NOT_EXECUTED';
      sanitizationJob.verification = {};
      await sanitizationJob.save();

      await auditService.record({
        caseId: sanitizationJob.caseId,
        actor: userId,
        operation: 'SANITIZATION',
        target: sanitizationJob.target,
        details: {
          method: sanitizationJob.method, mode: 'DRY_RUN', executed: false,
          supported: false, verificationStatus: 'NOT_EXECUTED', status: 'DRY_RUN',
          targetScope: result.targetScope, artifactId: result.artifactId,
          requirements: result.requirements, counteredRecoveryPaths: result.counteredRecoveryPaths,
          reason: result.reason
        }
      });

      await jobService.updateStatus(jobId, 'COMPLETED', {
        progress: 100,
        stage: 'dry-run-complete',
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
    await auditService.record({
      caseId, actor: userId, operation: 'VERIFICATION', target,
      details: { executed: false, verificationStatus: 'NOT_EXECUTED', mode: 'DRY_RUN', status: 'NOT_EXECUTED' }
    });
    return { job, result };
  },

  getSanitizationJob: async (sanitizationId) => SanitizationJob.findOne({ sanitizationId }),

  listByCase: async (caseId) =>
    SanitizationJob.find({ caseId }).populate('jobId', 'jobId status progress').sort({ createdAt: -1 })
};

export default sanitizationService;

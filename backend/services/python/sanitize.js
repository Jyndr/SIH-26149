import logger from '../../utils/logger.js';

const sanitizeService = {
  async sanitizeTarget(target, method = 'ZERO_FILL', options = {}) {
    try {
      void options;
      logger.info(`Dry-run sanitization requested for opaque target ${target} using method ${method}`);
      const now = new Date().toISOString();
      return {
        jobId: `sanitize-${Date.now()}`,
        target,
        method,
        operation: 'SANITIZATION',
        mode: 'DRY_RUN',
        startedAt: now,
        completedAt: now,
        supported: false,
        executed: false,
        status: 'DRY_RUN',
        verificationStatus: 'NOT_EXECUTED',
        reason: 'Real sanitization provider not enabled.'
      };
    } catch (error) {
      logger.error(`Error sanitizing target: ${error.message}`);
      throw error;
    }
  }
};

export default sanitizeService;

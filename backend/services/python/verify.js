import logger from '../../utils/logger.js';

const verifyService = {
  async verifyTarget(target, options = {}) {
    try {
      void options;
      logger.info(`Verification not executed for dry-run target ${target}`);
      return {
        jobId: `verify-${Date.now()}`,
        target,
        executed: false,
        status: 'NOT_EXECUTED',
        verificationStatus: 'NOT_EXECUTED',
        reason: 'No sanitization was executed in DRY_RUN mode.'
      };
    } catch (error) {
      logger.error(`Error verifying target: ${error.message}`);
      throw error;
    }
  }
};

export default verifyService;

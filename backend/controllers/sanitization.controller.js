import sanitizationService from '../services/sanitization.service.js';
import { sanitizeSchema, verifySchema, sanitizationIdSchema } from '../validators/sanitization.validators.js';

const sanitizationController = {
  sanitizeTarget: async (req, res, next) => {
    try {
      const validatedData = sanitizeSchema.parse(req.body);
      if (!req.case) {
        return res.status(400).json({
          success: false,
          error: { message: 'Case is required for sanitization' }
        });
      }

      const result = await sanitizationService.startSanitize({
        target: validatedData.target,
        targetType: validatedData.targetType,
        method: validatedData.method,
        caseId: req.case._id,
        userId: req.user.id
      });

      res.status(202).json({
        success: true,
        data: {
          jobId: result.job.jobId,
          sanitizationId: result.sanitizationJob.sanitizationId,
          status: result.job.status
        }
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: { message: 'Validation error', details: error.errors }
        });
      }
      next(error);
    }
  },

  listByCase: async (req, res, next) => {
    try {
      const jobs = await sanitizationService.listByCase(req.case._id);
      res.json({ success: true, data: jobs });
    } catch (error) {
      next(error);
    }
  },

  verifyTarget: async (req, res, next) => {
    try {
      const validatedData = verifySchema.parse(req.body);
      const result = await sanitizationService.verifyTarget(
        validatedData.target,
        req.user.id,
        req.case?._id
      );
      res.status(202).json({
        success: true,
        data: { jobId: result.job.jobId, status: result.job.status }
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: { message: 'Validation error', details: error.errors }
        });
      }
      next(error);
    }
  },

  getSanitizationJob: async (req, res, next) => {
    try {
      const { sanitizationId } = sanitizationIdSchema.parse(req.params);
      const sanitizationJob = await sanitizationService.getSanitizationJob(sanitizationId);
      if (!sanitizationJob) {
        return res.status(404).json({
          success: false,
          error: { message: 'Sanitization job not found' }
        });
      }
      res.json({ success: true, data: sanitizationJob });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: { message: 'Validation error', details: error.errors }
        });
      }
      next(error);
    }
  }
};

export default sanitizationController;

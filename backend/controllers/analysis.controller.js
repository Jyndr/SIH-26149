import recoveryService from '../services/recovery.service.js';
import { evidenceIdSchema } from '../validators/recovery.validators.js';

const analysisController = {
  analyzeEvidence: async (req, res, next) => {
    try {
      const { evidenceId } = evidenceIdSchema.parse(req.params);
      const userId = req.user.id;
      
      const result = await recoveryService.startAnalysis(evidenceId, userId);
      
      res.status(202).json({
        success: true,
        data: {
          jobId: result.job.jobId,
          status: result.job.status
        }
      });
    } catch (error) {
      if (error.message === 'Evidence not found' || error.message === 'Case not found') {
        return res.status(404).json({ success: false, error: { message: error.message } });
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        });
      }
      next(error);
    }
  }
};

export default analysisController;

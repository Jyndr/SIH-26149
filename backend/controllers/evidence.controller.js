import evidenceService from '../services/evidence.service.js';
import { evidenceIdSchema, caseIdSchema } from '../validators/evidence.validators.js';

const evidenceController = {
  upload: async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'No file uploaded'
          }
        });
      }

      const { caseId } = caseIdSchema.parse(req.params);
      const userId = req.user.id;
      const mongoCaseId = req.case?._id || caseId;
      
      const evidence = await evidenceService.upload(req.file, mongoCaseId, userId);
      
      res.status(201).json({
        success: true,
        data: evidence
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        });
      }
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: {
            message: 'Duplicate evidence: this file already exists in this case'
          }
        });
      }
      next(error);
    }
  },

  list: async (req, res, next) => {
    try {
      const evidence = await evidenceService.list(req.case._id, req.user.id);
      
      res.json({
        success: true,
        data: evidence
      });
    } catch (error) {
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
  },

  getById: async (req, res, next) => {
    try {
      const { evidenceId } = evidenceIdSchema.parse(req.params);
      
      const evidence = await evidenceService.getById(evidenceId, req.user.id);
      
      if (!evidence) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Evidence not found'
          }
        });
      }
      
      res.json({
        success: true,
        data: evidence
      });
    } catch (error) {
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
  },

  verifyIntegrity: async (req, res, next) => {
    try {
      const { evidenceId } = evidenceIdSchema.parse(req.params);
      
      const evidence = await evidenceService.verifyIntegrity(evidenceId, req.user.id);
      
      res.json({
        success: true,
        data: evidence
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        });
      }
      if (error.message === 'Evidence not found') {
        return res.status(404).json({
          success: false,
          error: {
            message: error.message
          }
        });
      }
      next(error);
    }
  }
};

export default evidenceController;

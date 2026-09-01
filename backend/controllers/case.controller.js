import caseService from '../services/case.service.js';
import { createCaseSchema, updateCaseSchema, caseIdSchema } from '../validators/case.validators.js';
import logger from '../utils/logger.js';

const caseController = {
  create: async (req, res, next) => {
    try {
      const validatedData = createCaseSchema.parse(req.body);
      const userId = req.user.id;
      const newCase = await caseService.create(validatedData, userId);
      res.status(201).json({
        success: true,
        data: newCase
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

  list: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const cases = await caseService.list(userId);
      res.json({
        success: true,
        data: cases
      });
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const caseDoc = req.case || await caseService.getById(req.params.caseId, req.user.id);
      
      if (!caseDoc) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Case not found'
          }
        });
      }
      
      res.json({
        success: true,
        data: caseDoc
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

  update: async (req, res, next) => {
    try {
      const { caseId } = caseIdSchema.parse(req.params);
      const validatedData = updateCaseSchema.parse(req.body);
      const userId = req.user.id;
      const updatedCase = await caseService.update(caseId, validatedData, userId);
      
      if (!updatedCase) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Case not found'
          }
        });
      }
      
      res.json({
        success: true,
        data: updatedCase
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
  }
};

export default caseController;

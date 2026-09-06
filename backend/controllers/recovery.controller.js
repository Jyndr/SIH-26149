import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import recoveryService from '../services/recovery.service.js';
import RecoveredFile from '../models/RecoveredFile.js';
import { evidenceIdSchema } from '../validators/recovery.validators.js';

const recoveryController = {
  recoverFiles: async (req, res, next) => {
    try {
      const { evidenceId } = evidenceIdSchema.parse(req.params);
      const userId = req.user.id;

      const result = await recoveryService.startRecovery(evidenceId, userId);

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
  },

  getRecoveredFiles: async (req, res, next) => {
    try {
      const { evidenceId } = evidenceIdSchema.parse(req.params);

      const recoveredFiles = await recoveryService.getRecoveredFiles(evidenceId);

      res.json({
        success: true,
        data: recoveredFiles
      });
    } catch (error) {
      if (error.message === 'Evidence not found') {
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
  },

  downloadFile: async (req, res, next) => {
    try {
      const { recoveredFileId } = req.params;
      const file = await RecoveredFile.findOne({
        $or: [
          { recoveredFileId },
          { _id: mongoose.isValidObjectId(recoveredFileId) ? recoveredFileId : null }
        ]
      });

      if (!file || !file.recoveredPath) {
        return res.status(404).json({ success: false, error: { message: 'Recovered file record not found' } });
      }

      if (!fs.existsSync(file.recoveredPath)) {
        return res.status(404).json({ success: false, error: { message: 'Recovered artifact file not found on disk' } });
      }

      const filename = file.filename || path.basename(file.recoveredPath);
      res.download(file.recoveredPath, filename);
    } catch (error) {
      next(error);
    }
  }
};

export default recoveryController;

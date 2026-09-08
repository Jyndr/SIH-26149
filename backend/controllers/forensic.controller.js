import fs from 'fs';
import forensicArtifactService from '../services/forensicArtifact.service.js';
import forensicAnalystService from '../services/forensicAnalyst.service.js';

const forensicController = {
  getOverview: async (req, res, next) => {
    try {
      const { evidenceId } = req.params;
      const overview = await forensicArtifactService.getOverview(evidenceId);
      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, error: { message: error.message } });
      }
      next(error);
    }
  },

  downloadReportJson: async (req, res, next) => {
    try {
      const { evidenceId } = req.params;
      const reportPath = await forensicArtifactService.getReportPath(evidenceId);
      if (!reportPath || !fs.existsSync(reportPath)) {
        return res.status(404).json({ success: false, error: { message: 'report.json not found on disk' } });
      }
      res.download(reportPath, `${evidenceId}_forensic_report.json`);
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, error: { message: error.message } });
      }
      next(error);
    }
  },

  getFileTree: async (req, res, next) => {
    try {
      const { evidenceId } = req.params;
      const folderPath = req.query.path || '/';
      const tree = await forensicArtifactService.getFileTree(evidenceId, folderPath, req.query);
      res.json({
        success: true,
        data: tree
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, error: { message: error.message } });
      }
      next(error);
    }
  },

  getArtifacts: async (req, res, next) => {
    try {
      const { evidenceId } = req.params;
      const type = req.query.type || 'all';
      const artifacts = await forensicArtifactService.getArtifacts(evidenceId, type);
      res.json({
        success: true,
        data: artifacts
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, error: { message: error.message } });
      }
      next(error);
    }
  },

  searchArtifacts: async (req, res, next) => {
    try {
      const { evidenceId } = req.params;
      const query = req.query.q || '';
      const category = req.query.category || 'all';
      const results = await forensicArtifactService.searchArtifacts(evidenceId, query, category);
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, error: { message: error.message } });
      }
      next(error);
    }
  },

  getFilePreview: async (req, res, next) => {
    try {
      const { evidenceId, fileId } = req.params;
      const preview = await forensicArtifactService.getFilePreview(evidenceId, fileId);
      res.json({
        success: true,
        data: preview
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, error: { message: error.message } });
      }
      next(error);
    }
  },

  downloadFile: async (req, res, next) => {
    try {
      const { evidenceId, fileId } = req.params;
      const { filePath, filename } = await forensicArtifactService.getFileDownload(evidenceId, fileId);
      res.download(filePath, filename);
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ success: false, error: { message: error.message } });
      }
      next(error);
    }
  },

  askAnalyst: async (req, res, next) => {
    try {
      const { evidenceId } = req.params;
      const { question } = req.body;
      const answer = await forensicAnalystService.ask(evidenceId, question);
      res.json({
        success: true,
        data: answer
      });
    } catch (error) {
      if (error.code === 'AI_KEY_MISSING') {
        return res.status(412).json({
          success: false,
          code: 'AI_KEY_MISSING',
          message: error.message,
          error: {
            code: 'AI_KEY_MISSING',
            message: error.message,
            provider: process.env.AI_PROVIDER || 'gemini'
          }
        });
      }
      if (error.message && error.message.includes('not found')) {
        return res.status(404).json({ success: false, error: { message: error.message } });
      }
      next(error);
    }
  },

  getAnalystStatus: async (req, res, next) => {
    try {
      const status = forensicAnalystService.getStatus();
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }
};

export default forensicController;


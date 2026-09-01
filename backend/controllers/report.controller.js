import path from 'path';
import reportService from '../services/report.service.js';
import { createReportSchema, reportIdSchema } from '../validators/report.validators.js';

const parsePagination = (query) => ({ page: Math.max(Number.parseInt(query.page, 10) || 1, 1), limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 50, 1), 100) });

const reportController = {
  async create(req, res, next) {
    try {
      const { type } = createReportSchema.parse(req.body);
      const { job } = await reportService.create(req.case._id, type, req.user.id);
      res.status(202).json({ success: true, data: { jobId: job.jobId, status: job.status } });
    } catch (error) {
      if (error.name === 'ZodError') return res.status(400).json({ success: false, error: { message: 'Validation error', details: error.errors } });
      next(error);
    }
  },
  async listByCase(req, res, next) {
    try {
      const result = await reportService.listByCase(req.case._id, parsePagination(req.query));
      res.json({ success: true, data: result.reports, pagination: { total: result.total, page: result.page, limit: result.limit } });
    } catch (error) { next(error); }
  },
  async getById(req, res, next) {
    try {
      const { reportId } = reportIdSchema.parse(req.params);
      const report = await reportService.getByReportId(reportId);
      if (!report) return res.status(404).json({ success: false, error: { message: 'Report not found' } });
      res.json({ success: true, data: report });
    } catch (error) {
      if (error.name === 'ZodError') return res.status(400).json({ success: false, error: { message: 'Validation error', details: error.errors } });
      next(error);
    }
  },
  async download(req, res, next) {
    try {
      const { reportId } = reportIdSchema.parse(req.params);
      const download = await reportService.getDownload(reportId);
      if (!download) return res.status(404).json({ success: false, error: { message: 'Report not found' } });
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(download.filePath)}"`);
      return res.download(download.filePath, path.basename(download.filePath));
    } catch (error) {
      if (error.name === 'ZodError') return res.status(400).json({ success: false, error: { message: 'Validation error', details: error.errors } });
      next(error);
    }
  }
};

export default reportController;

import express from 'express';
import Report from '../models/Report.js';
import reportController from '../controllers/report.controller.js';
import auth from '../middleware/auth.middleware.js';
import { authorizeCaseAccess } from '../middleware/authorize.middleware.js';

const router = express.Router();
const loadReportCase = async (req, res, next) => {
  try {
    const report = await Report.findOne({ reportId: req.params.reportId }).select('caseId');
    if (!report) return res.status(404).json({ success: false, error: { message: 'Report not found' } });
    req.params.caseId = String(report.caseId);
    return authorizeCaseAccess(req, res, next);
  } catch (error) { return next(error); }
};

router.use(auth);
router.post('/cases/:caseId/reports', authorizeCaseAccess, reportController.create);
router.get('/cases/:caseId/reports', authorizeCaseAccess, reportController.listByCase);
router.get('/reports/:reportId', loadReportCase, reportController.getById);
router.get('/reports/:reportId/download', loadReportCase, reportController.download);

export default router;

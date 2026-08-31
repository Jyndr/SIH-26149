import express from 'express';
import caseController from '../controllers/case.controller.js';
import jobController from '../controllers/job.controller.js';
import auditController from '../controllers/audit.controller.js';
import sanitizationController from '../controllers/sanitization.controller.js';
import auth from '../middleware/auth.middleware.js';
import { authorizeCaseAccess, requireRole } from '../middleware/authorize.middleware.js';

const router = express.Router();

router.use(auth);

router.post('/', caseController.create);
router.get('/', caseController.list);
router.get('/:caseId/jobs', authorizeCaseAccess, jobController.listByCase);
router.get('/:caseId/audit', authorizeCaseAccess, auditController.listByCase);
router.get('/:caseId/audit/verify-chain', authorizeCaseAccess, auditController.verifyChain);
router.post('/:caseId/sanitize', authorizeCaseAccess, requireRole(['ADMIN', 'INVESTIGATOR']), sanitizationController.sanitizeTarget);
router.get('/:caseId/sanitize/jobs', authorizeCaseAccess, sanitizationController.listByCase);
router.get('/:caseId', authorizeCaseAccess, caseController.getById);
router.patch('/:caseId', authorizeCaseAccess, caseController.update);

export default router;

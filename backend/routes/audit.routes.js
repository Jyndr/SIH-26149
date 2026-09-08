import express from 'express';
import auditController from '../controllers/audit.controller.js';
import auth from '../middleware/auth.middleware.js';
import { requireRole, authorizeCaseAccess } from '../middleware/authorize.middleware.js';

const router = express.Router();

router.use(auth);

// Get case audit logs
router.get('/cases/:caseId/audit', authorizeCaseAccess, auditController.listByCase);
router.get('/cases/:caseId/audit/verify-chain', authorizeCaseAccess, auditController.verifyChain);

// Get all audit logs
router.get('/audit', auditController.listAll);

// Verify audit chain
router.get('/audit/verify-chain', auditController.verifyChain);

// Get logs by entity
router.get('/audit/entity/:entityType/:entityId', auditController.getLogsByEntity);

// Get logs by current user
router.get('/audit/user', auditController.getLogsByUser);

export default router;

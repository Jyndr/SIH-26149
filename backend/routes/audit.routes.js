import express from 'express';
import auditController from '../controllers/audit.controller.js';
import auth from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/authorize.middleware.js';

const router = express.Router();

router.use(auth);

// Verify audit chain (admin only)
router.get('/audit/verify-chain', requireRole(['ADMIN']), auditController.verifyChain);

// Get logs by entity
router.get('/audit/entity/:entityType/:entityId', auditController.getLogsByEntity);

// Get logs by current user
router.get('/audit/user', auditController.getLogsByUser);

export default router;

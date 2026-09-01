import express from 'express';
import sanitizationController from '../controllers/sanitization.controller.js';
import auth from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/authorize.middleware.js';

const router = express.Router();

router.use(auth); // All sanitization routes require authentication

// Sanitization requires ADMIN or INVESTIGATOR role
router.post('/sanitize', requireRole(['ADMIN', 'INVESTIGATOR']), sanitizationController.sanitizeTarget);
router.post('/verify', sanitizationController.verifyTarget);
router.get('/sanitize/:sanitizationId', sanitizationController.getSanitizationJob);

export default router;

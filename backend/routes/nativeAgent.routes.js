import express from 'express';
import auth from '../middleware/auth.middleware.js';
import { authorizeCaseAccess, requireRole } from '../middleware/authorize.middleware.js';
import controller from '../controllers/nativeAgent.controller.js';

const router = express.Router();
router.use(auth);
router.get('/native-agent/health', controller.health);
router.get('/devices', controller.devices);
router.get('/devices/:deviceId', controller.device);
router.post('/cases/:caseId/acquisition/start', authorizeCaseAccess, requireRole(['ADMIN', 'INVESTIGATOR']), controller.startAcquisition);
router.get('/acquisition/:jobId', controller.acquisition);
router.post('/cases/:caseId/sanitization/prepare', authorizeCaseAccess, requireRole(['ADMIN', 'INVESTIGATOR']), controller.prepareSanitization);
router.post('/cases/:caseId/sanitization/start', authorizeCaseAccess, requireRole(['ADMIN', 'INVESTIGATOR']), controller.startSanitization);

export default router;

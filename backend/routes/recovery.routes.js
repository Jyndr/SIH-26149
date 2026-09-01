import express from 'express';
import recoveryController from '../controllers/recovery.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(auth); // All recovery routes require authentication

router.post('/evidence/:evidenceId/recover', recoveryController.recoverFiles);
router.get('/evidence/:evidenceId/recovered-files', recoveryController.getRecoveredFiles);
router.get('/evidence/:evidenceId/recovery-results', recoveryController.getRecoveredFiles);

export default router;

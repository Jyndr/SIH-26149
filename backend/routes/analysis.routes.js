import express from 'express';
import analysisController from '../controllers/analysis.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(auth); // All analysis routes require authentication

router.post('/evidence/:evidenceId/analyze', analysisController.analyzeEvidence);

export default router;

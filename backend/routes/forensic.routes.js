import express from 'express';
import forensicController from '../controllers/forensic.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(auth);

router.get('/evidence/:evidenceId/overview', forensicController.getOverview);
router.get('/evidence/:evidenceId/files', forensicController.getFileTree);
router.get('/evidence/:evidenceId/artifacts', forensicController.getArtifacts);
router.get('/evidence/:evidenceId/search', forensicController.searchArtifacts);
router.get('/evidence/:evidenceId/file-preview/:fileId', forensicController.getFilePreview);
router.get('/evidence/:evidenceId/file-download/:fileId', forensicController.downloadFile);
router.post('/evidence/:evidenceId/ask', forensicController.askAnalyst);
router.get('/evidence/:evidenceId/analyst-status', forensicController.getAnalystStatus);

export default router;


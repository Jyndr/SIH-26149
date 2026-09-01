import express from 'express';
import jobController from '../controllers/job.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(auth);

router.post('/', jobController.create);
router.get('/:jobId/events', jobController.events);
router.get('/:jobId', jobController.getById);

export default router;

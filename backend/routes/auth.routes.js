import express from 'express';
import authController from '../controllers/auth.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', auth, authController.me);

export default router;

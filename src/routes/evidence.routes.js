import express from 'express';
import multer from 'multer';
import path from 'path';
import evidenceController from '../controllers/evidence.controller.js';
import auth from '../middleware/auth.middleware.js';
import { authorizeCaseAccess } from '../middleware/authorize.middleware.js';
import storageService from '../services/storage/storage.service.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storageService.getEvidenceStoragePath());
  },
  filename: (req, file, cb) => {
    // Temporary filename, will be renamed by service
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB forensic images
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, can be restricted later
    cb(null, true);
  }
});

router.use(auth); // All evidence routes require authentication

router.post('/cases/:caseId/evidence', authorizeCaseAccess, upload.single('file'), evidenceController.upload);
router.get('/cases/:caseId/evidence', authorizeCaseAccess, evidenceController.list);
router.get('/evidence/:evidenceId', evidenceController.getById);
router.post('/evidence/:evidenceId/verify', evidenceController.verifyIntegrity);

export default router;

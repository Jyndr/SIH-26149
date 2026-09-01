import Evidence from '../models/Evidence.js';
import storageService from './storage/storage.service.js';
import hashService from './hash/hash.service.js';
import auditService from './audit/audit.service.js';
import { findEvidenceByParam } from '../utils/ids.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

const generateEvidenceId = () => {
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `EVD-${random}`;
};

const evidenceService = {
  upload: async (file, caseId, userId) => {
    try {
      const evidenceId = generateEvidenceId();
      const storedFilename = storageService.generateStoredFilename(evidenceId, file.originalname);
      const storagePath = path.join('evidence', storedFilename);
      const fullPath = path.join(storageService.getEvidenceStoragePath(), storedFilename);

      // Move file to storage
      await fs.promises.rename(file.path, fullPath);

      // Compute SHA-256
      const sha256 = await hashService.computeSHA256FromFile(fullPath);

      // Get file size
      const stats = await fs.promises.stat(fullPath);
      const size = stats.size;

      // Create evidence record
      const evidence = await Evidence.create({
        evidenceId,
        caseId,
        originalFilename: file.originalname,
        storedFilename,
        size,
        mimeType: file.mimetype,
        sha256,
        storagePath,
        createdBy: userId
      });

      // Audit logging
      await auditService.record({
        caseId: evidence.caseId,
        evidenceId: evidence._id,
        actor: userId,
        operation: 'EVIDENCE_UPLOADED',
        target: `Evidence ${evidenceId}`,
        details: {
          originalFilename: file.originalname,
          size,
          sha256
        },
        userId
      });

      logger.info(`Evidence uploaded: ${evidenceId}`);
      return evidence;
    } catch (error) {
      logger.error(`Error uploading evidence: ${error.message}`);
      throw error;
    }
  },

  list: async (caseId, userId) => {
    try {
      const evidence = await Evidence.find({ caseId }).sort({ createdAt: -1 });
      return evidence;
    } catch (error) {
      logger.error(`Error listing evidence: ${error.message}`);
      throw error;
    }
  },

  getById: async (evidenceId, userId) => {
    try {
      const evidence = await findEvidenceByParam(Evidence, evidenceId);
      void userId;
      return evidence;
    } catch (error) {
      logger.error(`Error getting evidence: ${error.message}`);
      throw error;
    }
  },

  verifyIntegrity: async (evidenceId, userId) => {
    try {
      const evidence = await findEvidenceByParam(Evidence, evidenceId);
      if (!evidence) {
        throw new Error('Evidence not found');
      }

      const fullPath = path.join(storageService.getEvidenceStoragePath(), evidence.storedFilename);
      const currentHash = await hashService.computeSHA256FromFile(fullPath);

      const isVerified = currentHash === evidence.sha256;

      evidence.integrity = {
        verified: isVerified,
        verifiedAt: new Date(),
        currentHash
      };

      await evidence.save();

      // Audit logging
      await auditService.record({
        caseId: evidence.caseId,
        evidenceId: evidence._id,
        actor: userId,
        operation: 'EVIDENCE_INTEGRITY_VERIFIED',
        target: `Evidence ${evidenceId}`,
        result: isVerified ? 'SUCCESS' : 'FAILURE',
        details: {
          verified: isVerified,
          currentHash
        }
      });

      logger.info(`Evidence integrity verified: ${evidenceId}, verified: ${isVerified}`);
      return evidence;
    } catch (error) {
      logger.error(`Error verifying evidence integrity: ${error.message}`);
      throw error;
    }
  }
};

export default evidenceService;

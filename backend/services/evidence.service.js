import mongoose from 'mongoose';
import Evidence from '../models/Evidence.js';
import Case from '../models/Case.js';
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
  registerAcquiredImage: async ({ sourcePath, caseId, userId, acquisition }) => {
    const evidenceId = generateEvidenceId();
    const originalFilename = path.basename(sourcePath);
    const storedFilename = storageService.generateStoredFilename(evidenceId, originalFilename);
    const fullPath = path.join(storageService.getEvidenceStoragePath(), storedFilename);
    await fs.promises.copyFile(sourcePath, fullPath, fs.constants.COPYFILE_EXCL);
    try {
      const sha256 = await hashService.computeSHA256FromFile(fullPath);
      if (acquisition.sha256 && sha256 !== acquisition.sha256) {
        throw new Error('Acquired image hash does not match native-agent metadata');
      }
      const stats = await fs.promises.stat(fullPath);
      const evidence = await Evidence.create({
        evidenceId, caseId, originalFilename, storedFilename, size: stats.size,
        mimeType: 'application/octet-stream', sha256, storagePath: path.join('evidence', storedFilename),
        acquisition: {
          acquisitionId: acquisition.acquisitionId, sourceDevice: acquisition.sourceDevice,
          imageFormat: acquisition.imageFormat, startedAt: acquisition.startedAt,
          completedAt: acquisition.completedAt, readOnly: true
        },
        createdBy: userId
      });
      await auditService.record({
        caseId: evidence.caseId, evidenceId: evidence._id, actor: userId,
        operation: 'EVIDENCE_ACQUIRED', target: `Evidence ${evidenceId}`,
        details: { acquisitionId: acquisition.acquisitionId, sourceDevice: acquisition.sourceDevice,
          imageFormat: acquisition.imageFormat, size: stats.size, sha256, mode: 'READ_ONLY' }
      });
      return evidence;
    } catch (error) {
      await fs.promises.unlink(fullPath).catch(() => {});
      throw error;
    }
  },

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

  list: async (caseIdParam, userId) => {
    try {
      let targetCaseId = caseIdParam;
      let foundCase = null;
      if (!mongoose.Types.ObjectId.isValid(caseIdParam)) {
        foundCase = await Case.findOne({ caseId: caseIdParam });
        if (foundCase) {
          targetCaseId = foundCase._id;
        }
      } else {
        foundCase = await Case.findById(caseIdParam);
      }
      const queryOr = [];
      if (mongoose.Types.ObjectId.isValid(targetCaseId)) {
        queryOr.push({ caseId: targetCaseId });
      }
      if (foundCase) {
        queryOr.push({ caseId: foundCase._id });
      }
      if (queryOr.length === 0) return [];
      const evidence = await Evidence.find({ $or: queryOr }).sort({ createdAt: -1 });
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

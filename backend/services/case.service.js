import fs from 'fs';
import path from 'path';
import Case from '../models/Case.js';
import auditService from './audit/audit.service.js';
import { findCaseByParam } from '../utils/ids.js';
import logger from '../utils/logger.js';

const generateCaseId = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `CASE-${year}-${random}`;
};

const caseService = {
  create: async (data, userId) => {
    try {
      const caseId = generateCaseId();
      const newCase = await Case.create({
        caseId,
        title: data.title,
        description: data.description,
        createdBy: userId,
        investigators: [userId]
      });

      // Audit logging
      await auditService.record({
        caseId: newCase._id,
        actor: userId,
        operation: 'CASE_CREATED',
        target: `Case ${caseId}`,
        details: { title: data.title, description: data.description }
      });

      logger.info(`Case created: ${caseId}`);
      return newCase;
    } catch (error) {
      logger.error(`Error creating case: ${error.message}`);
      throw error;
    }
  },

  list: async (userId) => {
    try {
      // Auto-sync any recovered case directories on disk
      try {
        const recoveredBase = path.resolve(process.cwd(), 'backend/storage/recovered');
        if (fs.existsSync(recoveredBase)) {
          const caseDirs = fs.readdirSync(recoveredBase, { withFileTypes: true })
            .filter(d => d.isDirectory() && d.name.startsWith('CASE-'))
            .map(d => d.name);

          for (const cId of caseDirs) {
            const exists = await Case.findOne({ caseId: cId });
            if (!exists) {
              await Case.create({
                caseId: cId,
                title: `Forensic Investigation ${cId}`,
                description: 'Physical bitstream acquisition, inode carving, and cryptographic integrity analysis.',
                status: 'COMPLETED',
                createdBy: userId || undefined,
                investigators: userId ? [userId] : []
              }).catch(() => null);
            }
          }
        }
      } catch (e) {
        logger.warn(`Failed to auto-sync cases from disk: ${e.message}`);
      }

      // Return all cases
      const cases = await Case.find().sort({ createdAt: -1 });
      return cases;
    } catch (error) {
      logger.error(`Error listing cases: ${error.message}`);
      throw error;
    }
  },

  getById: async (caseId, userId) => {
    try {
      const caseDoc = await findCaseByParam(Case, caseId);
      if (!caseDoc) return null;
      const allowed =
        caseDoc.createdBy?.toString() === String(userId) ||
        caseDoc.investigators?.some((inv) => inv.toString() === String(userId));
      return allowed ? caseDoc : null;
    } catch (error) {
      logger.error(`Error getting case: ${error.message}`);
      throw error;
    }
  },

  update: async (caseId, data, userId) => {
    try {
      const existing = await findCaseByParam(Case, caseId);
      if (!existing) return null;
      const allowed =
        existing.createdBy?.toString() === String(userId) ||
        existing.investigators?.some((inv) => inv.toString() === String(userId));
      if (!allowed) return null;

      const updatedCase = await Case.findByIdAndUpdate(existing._id, data, {
        new: true,
        runValidators: true
      });

      if (updatedCase) {
        await auditService.record({
          caseId: updatedCase._id,
          actor: userId,
          operation: 'CASE_UPDATED',
          target: `Case ${updatedCase.caseId}`,
          details: data
        });
      }

      logger.info(`Case updated: ${caseId}`);
      return updatedCase;
    } catch (error) {
      logger.error(`Error updating case: ${error.message}`);
      throw error;
    }
  }
};

export default caseService;

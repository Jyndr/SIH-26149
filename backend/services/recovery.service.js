import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Evidence from '../models/Evidence.js';
import Case from '../models/Case.js';
import Job from '../models/Job.js';
import RecoveredFile from '../models/RecoveredFile.js';
import jobService from './job.service.js';
import pythonClient from './python/pythonClient.js';
import storageService from './storage/storage.service.js';
import auditService from './audit/audit.service.js';
import { findEvidenceByParam } from '../utils/ids.js';
import logger from '../utils/logger.js';

const generateRecoveredFileId = () => {
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `REC-${random}`;
};

const evidenceAbsolutePath = (evidence) => {
  if (evidence.storagePath && path.isAbsolute(evidence.storagePath) && fs.existsSync(evidence.storagePath)) {
    return evidence.storagePath;
  }
  const inEvidenceDir = path.join(storageService.getEvidenceStoragePath(), evidence.storedFilename);
  if (fs.existsSync(inEvidenceDir)) return inEvidenceDir;
  const inStorageBase = path.join(storageService.getStorageBasePath(), evidence.storagePath || '');
  if (fs.existsSync(inStorageBase)) return inStorageBase;
  return inEvidenceDir;
};

const failJob = async (jobId, evidence, message) => {
  if (evidence) {
    evidence.analysisStatus = 'FAILED';
    await evidence.save();
  }
  if (jobId) {
    await jobService.updateStatus(jobId, 'FAILED', {
      error: { code: 'ENGINE_ERROR', message }
    });
  }
};

const recoveryService = {
  startAnalysis: async (evidenceId, userId) => {
    const evidence = await findEvidenceByParam(Evidence, evidenceId);
    if (!evidence) throw new Error('Evidence not found');
    const caseRecord = await Case.findById(evidence.caseId);
    if (!caseRecord) throw new Error('Case not found');

    const job = await jobService.create({
      caseId: evidence.caseId,
      evidenceId: evidence._id,
      type: 'ANALYSIS'
    }, userId);

    evidence.analysisStatus = 'ANALYZING';
    await evidence.save();

    setImmediate(() => {
      recoveryService.runAnalysis(job.jobId, evidence.evidenceId, userId).catch((error) => {
        logger.error(`Background analysis failed: ${error.message}`);
      });
    });

    return { job };
  },

  runAnalysis: async (jobId, evidenceId, userId) => {
    let evidence;
    try {
      evidence = await findEvidenceByParam(Evidence, evidenceId);
      const caseRecord = await Case.findById(evidence.caseId);
      await jobService.updateStatus(jobId, 'RUNNING', { startedAt: new Date(), progress: 5, stage: 'starting' });
      await jobService.updateProgress(jobId, 15, 'scanning image');

      const outputPath = storageService.getRecoveredStoragePath();
      const result = await pythonClient.analyze(
        evidenceAbsolutePath(evidence),
        outputPath,
        caseRecord.caseId,
        { chunkSize: 4 * 1024 * 1024, maxCarveSize: 100 * 1024 * 1024 }
      );

      const report = result.report;
      evidence.filesystem = report.filesystem_analysis;
      evidence.analysisStatus = 'ANALYZED';
      await evidence.save();

      await auditService.record({
        caseId: evidence.caseId,
        evidenceId: evidence._id,
        actor: userId,
        operation: 'ANALYZE',
        target: `Evidence ${evidence.evidenceId}`,
        details: { analysisStatus: 'ANALYZED' }
      });

      await jobService.updateStatus(jobId, 'COMPLETED', {
        progress: 100,
        stage: 'completed',
        result: report
      });
      logger.info(`Evidence analysis completed: ${evidenceId}`);
    } catch (error) {
      logger.error(`Error analyzing evidence: ${error.message}`);
      await failJob(jobId, evidence, error.message);
      throw error;
    }
  },

  startRecovery: async (evidenceId, userId) => {
    const evidence = await findEvidenceByParam(Evidence, evidenceId);
    if (!evidence) throw new Error('Evidence not found');
    const caseRecord = await Case.findById(evidence.caseId);
    if (!caseRecord) throw new Error('Case not found');

    const job = await jobService.create({
      caseId: evidence.caseId,
      evidenceId: evidence._id,
      type: 'RECOVERY'
    }, userId);

    evidence.analysisStatus = 'ANALYZING';
    await evidence.save();

    setImmediate(() => {
      recoveryService.runRecovery(job.jobId, evidence.evidenceId, userId).catch((error) => {
        logger.error(`Background recovery failed: ${error.message}`);
      });
    });

    return { job };
  },

  runRecovery: async (jobId, evidenceId, userId) => {
    let evidence;
    try {
      evidence = await findEvidenceByParam(Evidence, evidenceId);
      const caseRecord = await Case.findById(evidence.caseId);
      const job = await jobService.getById(jobId);
      await jobService.updateStatus(jobId, 'RUNNING', { startedAt: new Date(), progress: 5, stage: 'starting' });
      await jobService.updateProgress(jobId, 20, 'carving files');

      const outputPath = storageService.getRecoveredStoragePath();
      const result = await pythonClient.recover(
        evidenceAbsolutePath(evidence),
        outputPath,
        caseRecord.caseId,
        { chunkSize: 4 * 1024 * 1024, maxCarveSize: 100 * 1024 * 1024 }
      );

      const report = result.report;
      const artifacts = report.artifacts || [];
      const recoveredFiles = [];

      // Clear previous recovered files for this evidence to ensure fresh real data
      await RecoveredFile.deleteMany({ evidenceId: evidence._id });

      for (const artifact of artifacts) {
        const recoveredFileId = generateRecoveredFileId();
        const originalName = artifact.metadata?.original_name || path.basename(artifact.output_path);
        const originalPath = artifact.metadata?.original_path || artifact.output_path;
        const confidence = typeof artifact.confidence_score === 'number'
          ? Math.round(artifact.confidence_score * 100)
          : 100;

        const recoveredDoc = await RecoveredFile.create({
          recoveredFileId,
          jobId: job._id,
          evidenceId: evidence._id,
          caseId: evidence.caseId,
          filename: originalName,
          originalPath: originalPath,
          recoveredPath: artifact.output_path,
          size: artifact.size,
          hash: artifact.sha256,
          fileType: artifact.format || 'dat',
          confidence: confidence,
          recoveryStatus: artifact.is_complete ? 'SUCCESS' : 'PARTIAL',
          metadata: {
            artifactId: artifact.artifact_id,
            category: artifact.category,
            mimeType: artifact.mime_type,
            offset: artifact.offset,
            recoveryMethod: artifact.recovery_method || 'filesystem',
            confidence: confidence,
            isFragmented: artifact.is_fragmented,
            validationDetails: artifact.validation_details,
            originalName: originalName,
            originalPath: originalPath,
            rawMetadata: artifact.metadata || {}
          }
        });
        recoveredFiles.push(recoveredDoc);
      }

      evidence.analysisStatus = 'ANALYZED';
      if (report.filesystem_analysis) evidence.filesystem = report.filesystem_analysis;
      await evidence.save();

      await auditService.record({
        caseId: evidence.caseId,
        evidenceId: evidence._id,
        actor: userId,
        operation: 'RECOVER',
        target: `Evidence ${evidence.evidenceId}`,
        details: {
          recoveredFilesCount: recoveredFiles.length,
          statistics: report.statistics
        }
      });

      await jobService.updateStatus(jobId, 'COMPLETED', {
        progress: 100,
        stage: 'completed',
        result: {
          statistics: report.statistics,
          recoveredFilesCount: recoveredFiles.length,
          recoveredFiles
        }
      });
      logger.info(`File recovery completed: ${evidenceId}`);
    } catch (error) {
      logger.error(`Error recovering files: ${error.message}`);
      await failJob(jobId, evidence, error.message);
      throw error;
    }
  },

  getRecoveredFiles: async (evidenceId) => {
    const evidence = await findEvidenceByParam(Evidence, evidenceId);
    if (!evidence) throw new Error('Evidence not found');

    const queryOr = [{ evidenceId: evidence._id }];
    if (evidence.evidenceId) queryOr.push({ evidenceId: evidence.evidenceId });
    if (evidence.caseId) queryOr.push({ caseId: evidence.caseId });

    let files = await RecoveredFile.find({ $or: queryOr }).sort({ createdAt: -1 });
    if (files && files.length > 0) {
      return files;
    }

    // If MongoDB has no files yet, check for report.json on disk and auto-sync
    try {
      const recBase = storageService.getRecoveredStoragePath();
      let reportPath = null;

      // Check evidence's case
      if (evidence.caseId) {
        let caseIdStr = String(evidence.caseId);
        const caseRecord = await Case.findById(evidence.caseId);
        if (caseRecord && caseRecord.caseId) caseIdStr = caseRecord.caseId;
        const p1 = path.join(recBase, caseIdStr, 'report.json');
        if (fs.existsSync(p1)) reportPath = p1;
      }

      if (!reportPath && fs.existsSync(recBase)) {
        const subdirs = fs.readdirSync(recBase, { withFileTypes: true });
        for (const sub of subdirs) {
          if (sub.isDirectory()) {
            const p = path.join(recBase, sub.name, 'report.json');
            if (fs.existsSync(p)) {
              reportPath = p;
              break;
            }
          }
        }
      }

      if (reportPath && fs.existsSync(reportPath)) {
        logger.info(`Auto-syncing recovered artifacts from ${reportPath} for evidence ${evidence.evidenceId}...`);
        const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const artifacts = reportData.artifacts || [];

        let job = await Job.findOne({ evidenceId: evidence._id }).sort({ createdAt: -1 });
        if (!job && evidence.caseId) {
          try {
            job = await Job.create({
              jobId: `JOB-${Math.floor(10000 + Math.random() * 90000)}`,
              caseId: evidence.caseId,
              evidenceId: evidence._id,
              type: 'RECOVERY',
              status: 'COMPLETED',
              progress: 100,
              stage: 'completed'
            });
          } catch (jobErr) {
            logger.warn(`Could not create job for recovery auto-sync: ${jobErr.message}`);
          }
        }

        const docsToInsert = [];
        for (const a of artifacts) {
          const originalName = a.metadata?.original_name || (a.output_path ? path.basename(a.output_path) : 'artifact.dat');
          const originalPath = a.metadata?.original_path || a.output_path || '';
          const confidence = typeof a.confidence_score === 'number' ? Math.round(a.confidence_score * 100) : 100;
          docsToInsert.push({
            recoveredFileId: generateRecoveredFileId(),
            jobId: job?._id,
            evidenceId: evidence._id,
            caseId: evidence.caseId,
            filename: originalName,
            originalPath: originalPath,
            recoveredPath: a.output_path || '',
            size: a.size || 0,
            hash: a.sha256 || a.md5 || '',
            fileType: a.format || path.extname(originalName).replace('.', '') || 'unknown',
            confidence: confidence,
            recoveryStatus: a.is_complete ? 'SUCCESS' : 'PARTIAL',
            metadata: {
              artifactId: a.artifact_id,
              category: a.category,
              mimeType: a.mime_type,
              offset: a.offset,
              recoveryMethod: a.recovery_method || 'filesystem',
              confidence: confidence,
              isFragmented: a.is_fragmented,
              validationDetails: a.validation_details,
              originalName: originalName,
              originalPath: originalPath,
              rawMetadata: a.metadata || {}
            }
          });
        }

        if (docsToInsert.length > 0) {
          try {
            await RecoveredFile.insertMany(docsToInsert, { ordered: false });
            logger.info(`Auto-synced ${docsToInsert.length} recovered files into MongoDB.`);
          } catch (insErr) {
            logger.warn(`Bulk insert recovered files notice: ${insErr.message}`);
          }
          const freshlyFound = await RecoveredFile.find({ evidenceId: evidence._id }).sort({ createdAt: -1 });
          if (freshlyFound && freshlyFound.length > 0) {
            return freshlyFound;
          }
          // Fallback return memory-mapped docs if DB read lags
          return docsToInsert;
        }
      }
    } catch (syncErr) {
      logger.warn(`Could not auto-sync report.json files: ${syncErr.message}`);
    }

    return [];
  }
};

export default recoveryService;

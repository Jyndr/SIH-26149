import path from 'path';
import Evidence from '../models/Evidence.js';
import Case from '../models/Case.js';
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

const evidenceAbsolutePath = (evidence) =>
  path.join(storageService.getEvidenceStoragePath(), evidence.storedFilename);

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

      for (const artifact of artifacts) {
        const recoveredFileId = generateRecoveredFileId();
        const recoveredDoc = await RecoveredFile.create({
          recoveredFileId,
          jobId: job._id,
          evidenceId: evidence._id,
          caseId: evidence.caseId,
          originalPath: artifact.output_path,
          recoveredPath: artifact.output_path,
          size: artifact.size,
          hash: artifact.sha256,
          fileType: artifact.format,
          recoveryStatus: artifact.is_complete ? 'SUCCESS' : 'PARTIAL',
          metadata: {
            artifactId: artifact.artifact_id,
            category: artifact.category,
            mimeType: artifact.mime_type,
            offset: artifact.offset,
            recoveryMethod: artifact.recovery_method,
            confidence: (artifact.confidence_score || 0) * 100,
            isFragmented: artifact.is_fragmented,
            validationDetails: artifact.validation_details
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
    return RecoveredFile.find({ evidenceId: evidence._id }).sort({ createdAt: -1 });
  }
};

export default recoveryService;

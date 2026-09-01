import Job from '../models/Job.js';
import auditService from './audit/audit.service.js';
import logger from '../utils/logger.js';
import { EventEmitter } from 'events';

// Event emitter for SSE
const jobEvents = new EventEmitter();

const generateJobId = () => {
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `JOB-${random}`;
};

const jobService = {
  create: async (data, userId) => {
    try {
      const jobId = generateJobId();
      const job = await Job.create({
        jobId,
        caseId: data.caseId,
        evidenceId: data.evidenceId,
        type: data.type,
        createdBy: userId,
        options: data.options
      });
      await auditService.record({
        caseId: job.caseId,
        evidenceId: job.evidenceId,
        jobId: job._id,
        actor: userId,
        operation: 'JOB_CREATED',
        target: `Job ${jobId}`,
        details: { type: job.type, options: job.options ?? {} }
      });
      
      logger.info(`Job created: ${jobId} (${data.type})`);
      return job;
    } catch (error) {
      logger.error(`Error creating job: ${error.message}`);
      throw error;
    }
  },

  getById: async (jobId) => {
    try {
      const job = await Job.findOne({ jobId });
      return job;
    } catch (error) {
      logger.error(`Error getting job: ${error.message}`);
      throw error;
    }
  },

  updateStatus: async (jobId, status, data = {}) => {
    try {
      const updateData = { status };
      
      if (status === 'RUNNING' && !data.startedAt) {
        updateData.startedAt = new Date();
      }
      
      if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
        updateData.completedAt = new Date();
      }
      
      if (data.progress !== undefined) {
        updateData.progress = data.progress;
      }
      
      if (data.stage) {
        updateData.stage = data.stage;
      }
      
      if (data.result) {
        updateData.result = data.result;
      }
      
      if (data.error) {
        updateData.error = data.error;
      }
      
      if (data.pythonJobId) {
        updateData.pythonJobId = data.pythonJobId;
      }
      
      const job = await Job.findOneAndUpdate(
        { jobId },
        updateData,
        { new: true }
      );
      if (!job) throw new Error('Job not found');
      await auditService.record({
        caseId: job.caseId,
        evidenceId: job.evidenceId,
        jobId: job._id,
        actor: job.createdBy,
        operation: `JOB_${status}`,
        target: `Job ${jobId}`,
        result: status === 'FAILED' ? 'FAILURE' : 'SUCCESS',
        details: updateData
      });
      
      // Emit event for SSE
      jobEvents.emit(`job:${jobId}`, job);
      
      logger.info(`Job status updated: ${jobId} -> ${status}`);
      return job;
    } catch (error) {
      logger.error(`Error updating job status: ${error.message}`);
      throw error;
    }
  },

  updateProgress: async (jobId, progress, stage) => {
    try {
      const job = await Job.findOneAndUpdate(
        { jobId },
        { progress, stage },
        { new: true }
      );
      if (!job) throw new Error('Job not found');
      
      // Emit event for SSE
      jobEvents.emit(`job:${jobId}`, job);
      
      return job;
    } catch (error) {
      logger.error(`Error updating job progress: ${error.message}`);
      throw error;
    }
  },

  listByCase: async (caseId) => {
    try {
      const jobs = await Job.find({ caseId }).sort({ createdAt: -1 });
      return jobs;
    } catch (error) {
      logger.error(`Error listing jobs: ${error.message}`);
      throw error;
    }
  },

  getEventEmitter: () => {
    return jobEvents;
  }
};

export default jobService;

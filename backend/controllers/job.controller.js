import jobService from '../services/job.service.js';
import { createJobSchema, jobIdSchema } from '../validators/job.validators.js';

const jobController = {
  create: async (req, res, next) => {
    try {
      const validatedData = createJobSchema.parse(req.body);
      const userId = req.user.id;
      
      const job = await jobService.create(validatedData, userId);
      
      res.status(201).json({
        success: true,
        data: job
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        });
      }
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const { jobId } = jobIdSchema.parse(req.params);
      
      const job = await jobService.getById(jobId);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Job not found'
          }
        });
      }
      
      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors
          }
        });
      }
      next(error);
    }
  },

  listByCase: async (req, res, next) => {
    try {
      const jobs = await jobService.listByCase(req.case?._id || req.params.caseId);
      
      res.json({
        success: true,
        data: jobs
      });
    } catch (error) {
      next(error);
    }
  },

  events: async (req, res) => {
    const { jobId } = req.params;
    const serialize = (job) => (typeof job?.toJSON === 'function' ? job.toJSON() : job);
    const writeEvent = (name, payload) => {
      if (name) res.write(`event: ${name}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const job = await jobService.getById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: { message: 'Job not found' } });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    writeEvent('progress', serialize(job));

    const listener = (updatedJob) => {
      const payload = serialize(updatedJob);
      const status = payload?.status;
      const eventName = status === 'COMPLETED' ? 'completed' : status === 'FAILED' ? 'failed' : 'progress';
      writeEvent(eventName, payload);
    };

    const jobEvents = jobService.getEventEmitter();
    jobEvents.on(`job:${jobId}`, listener);

    req.on('close', () => {
      jobEvents.off(`job:${jobId}`, listener);
    });
  }
};

export default jobController;

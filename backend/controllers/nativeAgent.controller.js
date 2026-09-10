import { z } from 'zod';
import nativeAgent from '../services/nativeAgent.service.js';
import acquisitionService from '../services/acquisition.service.js';
import auditService from '../services/audit/audit.service.js';

const acquisitionSchema = z.object({
  deviceId: z.string().min(8).max(128),
  imageFormat: z.enum(['RAW', 'IMG', 'E01']).default('RAW')
});

const sanitizationSchema = z.object({
  deviceId: z.string().min(8).max(128),
  method: z.enum(['CLEAR', 'PURGE', 'CRYPTOGRAPHIC_ERASE', 'DESTROY']).optional(),
  targetScope: z.enum(['FILE', 'DEVICE']).default('DEVICE'),
  artifactId: z.string().min(1).max(256).optional(),
  execute: z.boolean().default(false),
  confirmation: z.string().min(1).max(256).optional()
}).superRefine((value, context) => {
  if (value.targetScope === 'FILE' && !value.artifactId) {
    context.addIssue({ code: 'custom', path: ['artifactId'], message: 'File scope requires an artifact ID' });
  }
  if (value.execute && !value.confirmation) {
    context.addIssue({ code: 'custom', path: ['confirmation'], message: 'Live erasure requires confirmation text' });
  }
});

export default {
  health: async (req, res, next) => {
    try { res.json({ success: true, data: await nativeAgent.health() }); } catch (error) { next(error); }
  },
  devices: async (req, res, next) => {
    try { res.json({ success: true, data: await nativeAgent.listDevices() }); } catch (error) { next(error); }
  },
  device: async (req, res, next) => {
    try { res.json({ success: true, data: await nativeAgent.getDevice(req.params.deviceId) }); } catch (error) { next(error); }
  },
  startAcquisition: async (req, res, next) => {
    try {
      const input = acquisitionSchema.parse(req.body);
      const data = await acquisitionService.start({ caseDoc: req.case, userId: req.user.id, ...input });
      res.status(202).json({ success: true, data });
    } catch (error) { next(error); }
  },
  acquisition: async (req, res, next) => {
    try { res.json({ success: true, data: await acquisitionService.get(req.params.jobId) }); } catch (error) { next(error); }
  },
  prepareSanitization: async (req, res, next) => {
    try {
      const input = sanitizationSchema.parse(req.body);
      const data = await nativeAgent.prepareSanitization({ ...input, caseId: req.case.caseId });
      await auditService.record({
        caseId: req.case._id, actor: req.user.id, operation: 'SANITIZATION_PREPARED', target: input.deviceId,
        details: { ...data, method: input.method || data.recommendedMethod }
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  },
  startSanitization: async (req, res, next) => {
    try {
      const input = sanitizationSchema.parse(req.body);
      const data = await nativeAgent.startSanitization({ ...input, caseId: req.case.caseId });
      await auditService.record({
        caseId: req.case._id, actor: req.user.id, operation: data.executed ? 'SANITIZATION_EXECUTED' : 'SANITIZATION_DRY_RUN',
        target: input.deviceId, details: data
      });
      res.status(data.executed ? 200 : 202).json({ success: true, data });
    } catch (error) { next(error); }
  }
};

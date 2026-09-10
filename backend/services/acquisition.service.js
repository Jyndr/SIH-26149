import path from 'path';
import fs from 'fs';
import nativeAgent from './nativeAgent.service.js';
import evidenceService from './evidence.service.js';
import auditService from './audit/audit.service.js';
import { fileURLToPath } from 'url';

const acquisitions = new Map();
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const agentImageRoot = path.resolve(process.env.CYPHORA_AGENT_IMAGE_ROOT
  || path.join(moduleDir, '..', '..', 'native-agent', 'data', 'images'));

const acquisitionService = {
  async start({ caseDoc, userId, deviceId, imageFormat = 'RAW' }) {
    const payload = { deviceId, caseId: caseDoc.caseId, imageFormat };
    const plan = await nativeAgent.prepareAcquisition(payload);
    await auditService.record({
      caseId: caseDoc._id, actor: userId, operation: 'ACQUISITION_PREPARED', target: deviceId,
      details: { imageFormat, sourceSize: plan.sourceSize, readOnly: true, status: 'READY' }
    });
    const job = await nativeAgent.startAcquisition(payload);
    acquisitions.set(job.jobId, { caseId: String(caseDoc._id), userId: String(userId), evidenceId: null });
    await auditService.record({
      caseId: caseDoc._id, actor: userId, operation: 'ACQUISITION_STARTED', target: deviceId,
      details: { acquisitionId: job.acquisitionId, imageFormat, mode: 'READ_ONLY', status: job.status }
    });
    return job;
  },

  async get(jobId) {
    const context = acquisitions.get(jobId);
    if (!context) throw new Error('Unknown acquisition job');
    const job = await nativeAgent.getAcquisition(jobId);
    if (job.status === 'COMPLETED' && !context.evidenceId) {
      const sourcePath = path.resolve(job.imagePath);
      if (agentImageRoot !== sourcePath && !sourcePath.startsWith(`${agentImageRoot}${path.sep}`)) {
        throw new Error('Native agent returned an image outside its configured storage root');
      }
      await fs.promises.access(sourcePath, fs.constants.R_OK);
      const evidence = await evidenceService.registerAcquiredImage({
        sourcePath, caseId: context.caseId, userId: context.userId, acquisition: job
      });
      context.evidenceId = evidence.evidenceId;
      context.evidence = evidence;
    }
    return { ...job, evidence: context.evidence || null };
  }
};

export default acquisitionService;

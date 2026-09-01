import { z } from 'zod';

export const createJobSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  evidenceId: z.string().optional(),
  type: z.enum(['ANALYSIS', 'RECOVERY', 'CARVING', 'SANITIZATION', 'VERIFICATION', 'REPORT']),
  options: z.record(z.any()).optional()
});

export const jobIdSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required')
});

export const updateJobSchema = z.object({
  status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  progress: z.number().min(0).max(100).optional(),
  stage: z.string().optional()
});

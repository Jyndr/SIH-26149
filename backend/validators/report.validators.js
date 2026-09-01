import { z } from 'zod';

export const createReportSchema = z.object({
  type: z.enum(['CASE_SUMMARY', 'RECOVERY_REPORT', 'SANITIZATION_CERTIFICATE', 'AUDIT_REPORT'])
});

export const reportIdSchema = z.object({
  reportId: z.string().min(1, 'Report ID is required')
});

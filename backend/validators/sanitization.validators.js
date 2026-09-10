import { z } from 'zod';

export const sanitizeSchema = z.object({
  target: z.string().min(1, 'Target is required'),
  targetType: z.enum(['FILE', 'DRIVE']),
  targetReference: z.string().min(1).max(256).optional(),
  method: z.enum(['CLEAR', 'PURGE', 'CRYPTOGRAPHIC_ERASE', 'DESTROY']).optional().default('CLEAR')
}).superRefine((value, context) => {
  if (value.targetType === 'FILE' && !value.targetReference) {
    context.addIssue({ code: 'custom', path: ['targetReference'], message: 'File scope requires an artifact or filesystem record ID' });
  }
  if (value.targetType === 'DRIVE' && value.targetReference) {
    context.addIssue({ code: 'custom', path: ['targetReference'], message: 'Drive scope cannot include a file reference' });
  }
});

export const verifySchema = z.object({
  target: z.string().min(1, 'Target is required')
});

export const sanitizationIdSchema = z.object({
  sanitizationId: z.string().min(1, 'Sanitization ID is required')
});

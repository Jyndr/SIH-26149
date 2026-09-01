import { z } from 'zod';

export const sanitizeSchema = z.object({
  target: z.string().min(1, 'Target is required'),
  targetType: z.enum(['FILE', 'FOLDER', 'DRIVE']),
  method: z.enum(['ZERO_FILL', 'RANDOM', 'CRYPTO_ERASE']).optional().default('ZERO_FILL')
});

export const verifySchema = z.object({
  target: z.string().min(1, 'Target is required')
});

export const sanitizationIdSchema = z.object({
  sanitizationId: z.string().min(1, 'Sanitization ID is required')
});

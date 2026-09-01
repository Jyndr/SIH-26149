import { z } from 'zod';

export const evidenceIdSchema = z.object({
  evidenceId: z.string().min(1, 'Evidence ID is required')
});

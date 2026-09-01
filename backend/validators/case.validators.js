import { z } from 'zod';

export const createCaseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional()
});

export const updateCaseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters').optional(),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED']).optional()
});

export const caseIdSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required')
});

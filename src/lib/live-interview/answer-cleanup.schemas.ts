import { z } from 'zod';

export const AnswerCleanupInputSchema = z.object({
  answerId: z.string().min(1).max(160),
  sessionId: z.string().min(1).max(160),
  version: z.number().int().nonnegative(),
  text: z.string().max(2000).refine(text => !!text.trim()),
}).strict();

/** The model can only select supplied spans; it cannot author replacement prose. */
export const AnswerCleanupSelectionSchema = z.object({
  remove: z.array(z.number().int().nonnegative()).max(100),
}).strict();

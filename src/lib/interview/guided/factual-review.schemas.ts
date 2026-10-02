import { z } from 'zod';

export const PodcastFactualReviewSchema = z.object({
  reason: z.string().min(1).max(600),
  valid: z.boolean(),
}).strict();

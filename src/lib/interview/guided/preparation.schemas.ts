import { z } from 'zod';

// Validate the existing generators' output at the guided boundary. Their old
// JSON parsers predate Zod; they are deliberately not expanded by this pilot.
export const PreparedCandidateSchema = z.object({
  id: z.string().min(1), text: z.string().min(1).max(2000),
  topic: z.string().optional(), type: z.string().optional(),
  products: z.array(z.string()).optional(), vendors: z.array(z.string()).optional(),
  linkedProductId: z.string().optional(),
});
export const GuidedKnownFactsSchema = z.object({
  client: z.string().max(220).optional(), scope: z.string().max(220).optional(),
  timeline: z.string().max(220).optional(), direction: z.string().max(220).optional(),
  corrections: z.string().max(220).optional(),
}).strict();

export const PreparedReviewSchema = z.object({ reviews: z.array(z.object({
  id: z.string().min(1), valid: z.boolean(), reason: z.string().min(1).max(600),
  evidence: z.array(z.object({ answerId: z.string().min(1), quote: z.string().min(3).max(600) }).strict()).max(8),
}).strict()).max(100) }).strict();
export const PreparedRepairSchema = z.object({ questions: z.array(z.object({
  id: z.string().min(1), text: z.string().min(4).max(600),
}).strict()).max(100) }).strict();

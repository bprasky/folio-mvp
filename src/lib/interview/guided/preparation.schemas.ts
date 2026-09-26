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

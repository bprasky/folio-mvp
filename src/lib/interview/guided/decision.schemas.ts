import { z } from 'zod';

export const GuidedDecisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('advance') }).strict(),
  z.object({
    kind: z.literal('followup'),
    purpose: z.enum(['room_decision', 'room_example', 'project_example', 'project_reason']),
    sourceAnswerIds: z.array(z.string().min(1)).length(1),
    // An exact span proves which accepted answer motivated the proposal. It
    // never becomes question text or silently fulfills another obligation.
    evidence: z.string().min(3).max(240),
  }).strict(),
]);

export type GuidedDecision = z.infer<typeof GuidedDecisionSchema>;

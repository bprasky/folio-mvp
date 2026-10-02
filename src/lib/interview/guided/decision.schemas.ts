import { z } from 'zod';

const EvidenceSchema = z.object({ answerId: z.string().min(1), quote: z.string().min(3).max(600) }).strict();
const wording = {
  text: z.string().min(4).max(600), reaction: z.string().min(1).max(280).optional(),
  purpose: z.string().min(8).max(300).describe('Assess the intended obligation before wording: state the known content and actual required gap, or explicitly say it is fully covered.'), sourceAnswerIds: z.array(z.string().min(1)).min(1).max(8),
  evidence: z.array(EvidenceSchema).min(1).max(8),
};
export const GuidedDecisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('advance'), purpose: wording.purpose.optional() }).strict(),
  z.object({ kind: z.literal('followup'), ...wording }).strict(),
  z.object({ kind: z.literal('clarification'), ...wording }).strict(),
  z.object({ kind: z.literal('ask_prepared'), questionId: z.string().min(1), ...wording,
    sourceAnswerIds: z.array(z.string().min(1)).max(8), evidence: z.array(EvidenceSchema).max(8),
  }).strict(),
  z.object({ kind: z.literal('confirm_coverage'), questionId: z.string().min(1), ...wording,
    sourceAnswerIds: z.array(z.string().min(1)).length(1), evidence: z.array(EvidenceSchema).length(1),
  }).strict(),
]).transform(proposal => proposal.kind === 'advance' ? { kind: 'advance' as const } : proposal);
export const GuidedReviewSchema = z.object({ valid: z.boolean(), reason: z.string().min(1).max(600) }).strict();
/** Evidence assessment precedes one final wording verdict; no competing objection list. */
export const PodcastReviewSchema = z.object({
  requestedInformation: z.string().min(1).max(240),
  evidence: z.array(EvidenceSchema).max(8),
  coverage: z.enum(['complete', 'partial', 'absent', 'not_applicable']),
  remainingGap: z.string().max(240),
  reason: z.string().min(1).max(600),
  valid: z.boolean(),
}).strict();
export type GuidedDecision = z.infer<typeof GuidedDecisionSchema>;

/** Provider grammar constrains legal actions; it cannot establish semantic safety. */
export function guidedDecisionOutputSchema(questionIds: string[], allowFollowup: boolean, allowPrepared = true) {
  const kinds = questionIds.length ? [...(allowPrepared ? ['ask_prepared'] : []), 'confirm_coverage'] : ['advance'];
  if (allowFollowup) kinds.push('followup', 'clarification');
  // The provider rejects a root anyOf with shared $defs. Keep its grammar flat;
  // the discriminated Zod union above still enforces each returned action shape.
  const evidence = z.array(EvidenceSchema).max(8);
  const sourceAnswerIds = z.array(z.string().min(1)).max(8);
  return z.object({
    purpose: questionIds.length ? wording.purpose : wording.purpose.optional(),
    evidence: questionIds.length ? evidence : evidence.optional(),
    sourceAnswerIds: questionIds.length ? sourceAnswerIds : sourceAnswerIds.optional(),
    kind: z.enum(kinds as [string, ...string[]]),
    ...(questionIds.length ? { questionId: z.enum(questionIds as [string, ...string[]]).optional() } : {}),
    reaction: wording.reaction, text: wording.text.optional(),
  }).strict();
}

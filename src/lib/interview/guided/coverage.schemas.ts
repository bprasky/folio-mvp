import { z } from 'zod';

/** Only canonical pending targets and available raw answers can be classified. */
export function podcastCoverageSchema(questionIds: string[], answerIds: string[]) {
  if (!questionIds.length || !answerIds.length) throw new Error('Coverage needs pending targets and accepted raw answers.');
  return z.object({ covered: z.array(z.object({
    questionId: z.enum(questionIds as [string, ...string[]]),
    answerId: z.enum(answerIds as [string, ...string[]]),
    quote: z.string().min(3).max(600),
  }).strict()).max(questionIds.length) }).strict();
}

export type PodcastCoverage = z.infer<ReturnType<typeof podcastCoverageSchema>>['covered'];

import { z } from 'zod';
import { isVerbatimSpan } from '@/lib/posting/quoteCandidates';
const quoteSchema = z.object({
  startMs: z.number().int().nonnegative(), endMs: z.number().int().positive(),
  quoteText: z.string().trim().min(1),
  useCase: z.enum(['EDITORIAL_PULLQUOTE', 'PRODUCT_PAGE_INSIGHT', 'SOCIAL_CLIP_HOOK']),
  score: z.number().min(0).max(1),
});
export type TranscriptSource = { startMs: number; endMs: number; text: string; order: number };
export function backedByTranscript(quote: { startMs: number; endMs: number; quoteText: string }, segments: TranscriptSource[]): boolean {
  if (quote.endMs <= quote.startMs) return false;
  const source = segments.filter(s => s.startMs >= quote.startMs && s.endMs <= quote.endMs).sort((a,b) => a.order-b.order);
  return source.length > 0 && source[0].startMs === quote.startMs && source[source.length-1].endMs === quote.endMs
    && source.every((s,i) => i === 0 || s.order === source[i-1].order + 1)
    && isVerbatimSpan(quote.quoteText, [source.map(s => s.text).join(' ')]);
}
export function validatedQuotes(raw: unknown[], segments: TranscriptSource[], useCases: string[]) {
  return raw.flatMap(value => {
    const parsed = quoteSchema.safeParse(value);
    return parsed.success && useCases.includes(parsed.data.useCase) && backedByTranscript(parsed.data, segments) ? [parsed.data] : [];
  }).slice(0,5);
}

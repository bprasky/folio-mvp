import { createHash } from 'crypto';
import { z } from 'zod';
import { backedByTranscript, validatedQuotes } from '@/lib/interviews/provenance';
import { MediaError } from './types';
import type { Capture, EditPlan, MediaRecord, AlignedSegment } from './types';

export const planInput = z.object({
  sessionId: z.string().min(1).max(100), title: z.string().trim().min(1).max(160), description: z.string().max(2000).default(''),
  credits: z.string().max(1000).default(''), format: z.enum(['short', 'episode', 'audio']), aspect: z.enum(['portrait', 'landscape']),
  scenes: z.array(z.object({ captureId: z.string().max(100), captureVersion: z.number().int().positive(), startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(), speakerId: z.string().max(100), imageId: z.string().max(100).optional(),
    focalX: z.number().min(0).max(1).default(0.5), focalY: z.number().min(0).max(1).default(0.5), transition: z.literal('cut').default('cut'),
    captionOrders: z.array(z.number().int().nonnegative()).max(1000), chapter: z.string().max(120).default(''),
  })).min(1).max(40),
});
/** Approval hashes exclude lifecycle metadata, but include every edit affecting the assembled piece. */
export function planDigest(plan: EditPlan) {
  const edit = { ...plan };
  delete edit.approval; delete edit.output; delete edit.publishedAt; delete edit.error;
  return createHash('sha256').update(JSON.stringify(edit)).digest('hex');
}
export function suggestedMoments(segments: AlignedSegment[]) {
  const candidates: unknown[] = [];
  for (let i = 0; i < segments.length && candidates.length < 5;) {
    const selected = [segments[i++]];
    while (i < segments.length && selected.at(-1)!.endMs - selected[0].startMs < 20000 && segments[i].endMs - selected[0].startMs <= 60000)
      selected.push(segments[i++]);
    candidates.push({ startMs: selected[0].startMs, endMs: selected.at(-1)!.endMs,
      quoteText: selected.map(s => s.text).join(' '), useCase: 'SOCIAL_CLIP_HOOK', score: 0.5 });
  }
  // Keep the same provenance validation as existing recorded-interview quotes.
  return validatedQuotes(candidates, segments, ['SOCIAL_CLIP_HOOK']).map(q => ({ ...q, useCase: 'SOCIAL_CLIP_HOOK' as const }));
}
export function validatePlanSources(plan: EditPlan, captures: MediaRecord<Capture>[], actor: string, imageIds: string[]) {
  let duration = 0;
  for (const scene of plan.scenes) {
    const run = captures.find(c => c.id === scene.captureId);
    if (!run || run.actorId !== actor || run.state !== 'ready' || run.version !== scene.captureVersion || !run.payload.key ||
      run.payload.source.sourceType !== plan.source.sourceType || run.payload.source.sourceId !== plan.source.sourceId ||
      scene.speakerId !== actor || run.payload.speakerId !== actor)
      throw new MediaError('A recording or its source changed. Select current recordings and approve again.', 409);
    if (scene.endMs <= scene.startMs || scene.endMs > run.payload.durationMs || scene.startMs < 0)
      throw new MediaError('A trim is outside the playable recording.');
    const transcript = run.payload.transcript || [];
    const spans = transcript.filter(s => scene.captionOrders.includes(s.order));
    if (!spans.length || spans.some(s => s.speaker !== 'creator' || s.speakerId !== actor) ||
      !backedByTranscript({ startMs: scene.startMs, endMs: scene.endMs, quoteText: spans.map(s => s.text).join(' ') }, transcript) ||
      spans.some(s => s.startMs < scene.startMs || s.endMs > scene.endMs) || new Set(scene.captionOrders).size !== spans.length)
      throw new MediaError('Choose exact recording-aligned transcript boundaries. Captions must match the spoken audio.');
    if (scene.imageId && !imageIds.includes(scene.imageId)) throw new MediaError('The selected photograph is no longer available.', 409);
    if (plan.format !== 'audio' && !scene.imageId && !run.payload.hasVideo) throw new MediaError('Choose an authorized photograph for this voice-only segment.');
    duration += scene.endMs - scene.startMs;
  }
  if (duration > 30 * 60 * 1000 || (plan.format === 'short' && duration > 90 * 1000)) throw new MediaError('Short clips are limited to 90 seconds; episodes to 30 minutes.');
  return duration;
}

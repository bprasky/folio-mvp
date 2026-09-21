import 'server-only';
import { checkRateLimit } from '@/lib/rateLimit';
import { Redis } from '@upstash/redis';
import { answerBlocker, evaluateCandidate, selectCandidates } from './engine';
import { evaluateSource } from './evaluator';
import { loadCandidateSources, readinessEnabled, sourceVersion } from './sources';
import { appendEvent, CandidateConflictError, listStoredCandidates, saveCandidate, type SecondaryCandidateEvent } from './store';
import { DISMISSAL_REASONS, READINESS_POLICY, type Candidate, type CandidateEventKind } from './types';

export class ReadinessError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function enabled() { if (!readinessEnabled()) throw new ReadinessError('Editorial readiness is not enabled.', 404); }

async function context(userId: string) {
  enabled();
  const data = await loadCandidateSources(userId);
  if (data.workspace.id && !data.workspace.canWriteCampaigns) throw new ReadinessError('Editing is not available in this workspace.', 403);
  const stored = await listStoredCandidates(userId, data.workspace.id);
  return { ...data, stored };
}

function currentHistory(data: Awaited<ReturnType<typeof context>>, sourceKey?: string) {
  return data.stored.filter(candidate => candidate.sourceKey !== sourceKey && candidate.policy === READINESS_POLICY &&
    data.sources.some(source => source.key === candidate.sourceKey && sourceVersion(source) === candidate.sourceVersion));
}

export async function listReadiness(userId: string) {
  const data = await context(userId);
  const current = data.stored.filter(candidate => candidate.policy === READINESS_POLICY && data.sources.some(source => source.key === candidate.sourceKey && sourceVersion(source) === candidate.sourceVersion));
  return { enabled: true as const, workspace: { id: data.workspace.id, name: data.workspace.name }, candidates: selectCandidates(current),
    developing: current.filter(candidate => candidate.readiness === 'developing' && !candidate.dismissed),
    dismissed: current.filter(candidate => candidate.dismissed),
    published: current.filter(candidate => candidate.confirmedPublishedAt),
    needsEvaluation: data.sources.some(source => !current.some(candidate => candidate.sourceKey === source.key)) };
}

export async function refreshReadiness(userId: string) {
  const startedAt = Date.now();
  const data = await context(userId);
  const budget = await checkRateLimit(`studio-readiness:${userId}:${data.workspace.id ?? 'personal'}`, { max: 1, windowMs: 60 * 60 * 1000 });
  if (!budget.success) throw new ReadinessError('Your work was recently reviewed. Try again later.', 429);
  if (process.env.NODE_ENV === 'production') {
    const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN!, retry: { retries: 0 } });
    if (!await redis.set(`studio-readiness:lease:${userId}:${data.workspace.id ?? 'personal'}`, 'running', { nx: true, ex: 360 })) throw new ReadinessError('A review is already running.', 429);
  }
  // Review a bounded batch explicitly. Browsing neither generates nor records impressions.
  const pending = data.sources.filter(source => !data.stored.some(candidate => candidate.sourceKey === source.key && candidate.sourceVersion === sourceVersion(source) && candidate.policy === READINESS_POLICY)).slice(0, 4);
  let evaluated = 0;
  const history = currentHistory(data);
  for (const source of pending) {
    // Leave room for bounded image reads and the evaluator's one retry inside
    // the route's 300-second budget; unfinished sources remain pending.
    if (Date.now() - startedAt > 150_000) break;
    const previous = data.stored.find(candidate => candidate.sourceKey === source.key);
    const otherStories = history.filter(item => item.sourceKey !== source.key);
    const candidate = await evaluateSource(source, userId, data.workspace.id, otherStories);
    const fresh = await loadCandidateSources(userId);
    if (fresh.workspace.id !== data.workspace.id || !fresh.sources.some(current => current.key === source.key && sourceVersion(current) === candidate.sourceVersion)) throw new CandidateConflictError();
    candidate.version = previous ? previous.version + 1 : 1;
    if (previous) {
      candidate.dismissed = previous.dismissed;
      candidate.confirmedPublishedAt = previous.confirmedPublishedAt;
      // Original contributions remain readable in every revision, never replaced by generated copy.
      candidate.evidence.push(...previous.evidence.filter(e => e.source === 'designer_answer'));
      if (previous.evidence.some(e => e.source === 'designer_answer')) {
        candidate.blockers.push({ id: 'source-review', kind: 'review', question: 'The published source changed. Review the new draft alongside your saved answers.', options: ['Reviewed'], evidenceIds: [] });
        Object.assign(candidate, evaluateCandidate(candidate, otherStories));
      }
    }
    const secondaryEvents: SecondaryCandidateEvent[] = [{ kind: 'scored', payload: { policy: READINESS_POLICY } }];
    if (candidate.readiness === 'suppressed') secondaryEvents.push({ kind: 'suppressed', payload: { reasons: candidate.reasons } });
    if (candidate.readiness === 'ready') secondaryEvents.push({ kind: 'ready' });
    const saved = await saveCandidate(candidate, previous?.version ?? null, 'generated', {}, secondaryEvents);
    history.push(saved); evaluated++;
  }
  return { evaluated, remaining: Math.max(0, data.sources.filter(source => !history.some(candidate => candidate.sourceKey === source.key && candidate.sourceVersion === sourceVersion(source))).length) };
}

export async function currentCandidate(userId: string, id: string, version?: number, expectedSource?: string): Promise<Candidate> {
  const data = await context(userId);
  const candidate = data.stored.find(item => item.id === id);
  if (!candidate) throw new ReadinessError('Story is not available in this workspace.', 404);
  if ((version !== undefined && candidate.version !== version) || (expectedSource !== undefined && candidate.sourceVersion !== expectedSource) || candidate.policy !== READINESS_POLICY ||
    !data.sources.some(source => source.key === candidate.sourceKey && sourceVersion(source) === candidate.sourceVersion)) throw new CandidateConflictError();
  return candidate;
}

export interface CandidateChange {
  version: number; sourceVersion: string; action: 'answer' | 'edit' | 'dismiss' | 'restore' | 'published';
  blockerId?: string; answer?: string; headline?: string; caption?: string; imageIds?: string[]; reason?: string;
}

export async function changeCandidate(userId: string, id: string, change: CandidateChange) {
  const original = await currentCandidate(userId, id, change.version, change.sourceVersion);
  const history = currentHistory(await context(userId), original.sourceKey);
  if (original.confirmedPublishedAt && change.action !== 'dismiss') throw new ReadinessError('This version is already confirmed published.');
  let next = structuredClone(original); let event: CandidateEventKind = 'configured';
  if (change.action === 'answer') {
    if (!change.blockerId || typeof change.answer !== 'string') throw new ReadinessError('Answer the current step.');
    next = evaluateCandidate(answerBlocker(original, change.blockerId, change.answer), history); event = 'answered';
  } else if (change.action === 'edit') {
    for (const [key, text] of [['headline', change.headline], ['caption', change.caption]] as const) {
      if (text === undefined) continue;
      if (!text.trim() || text.length > (key === 'headline' ? 180 : 2200)) throw new ReadinessError('Keep the headline or caption within the supported length.');
      const evidenceId = `designer-edit:${key}`;
      next.evidence = next.evidence.filter(e => e.id !== evidenceId);
      next.evidence.push({ id: evidenceId, projectId: next.projectIds[0], text: text.trim(), tier: 'direct', source: 'designer_answer' });
      next.draft[key] = text.trim();
      if (key === 'headline') next.thesis = text.trim();
      else next.claims = [{ text: text.trim(), evidenceIds: [evidenceId] }];
    }
    if (change.imageIds) {
      if (!change.imageIds.length || change.imageIds.length > 4 || new Set(change.imageIds).size !== change.imageIds.length || change.imageIds.some(id => !original.visuals.some(image => image.id === id))) throw new ReadinessError('Choose distinct reviewed images from this story.');
      next.visuals = change.imageIds.map(id => original.visuals.find(image => image.id === id)!);
      next.format = next.visuals.length > 1 ? 'carousel' : 'single_image';
      next.draft.slides = next.visuals.map(image => ({ imageId: image.id, purpose: image.reason }));
    }
    // User edits are attributed evidence, but do not automatically raise editorial quality.
    next = evaluateCandidate(next, history); event = 'edited';
  } else if (change.action === 'dismiss') {
    if (change.reason && !DISMISSAL_REASONS.includes(change.reason as typeof DISMISSAL_REASONS[number])) throw new ReadinessError('Choose a dismissal reason.');
    next.dismissed = true; event = 'dismissed';
  } else if (change.action === 'restore') { next.dismissed = false; next = evaluateCandidate(next, history); event = 'restored'; }
  else if (change.action === 'published') {
    next = evaluateCandidate(next, history);
    if (next.readiness !== 'ready' || next.dismissed) throw new ReadinessError('Finish and review this story before confirming publication.', 409);
    next.confirmedPublishedAt = new Date().toISOString(); event = 'published';
  } else throw new ReadinessError('Unsupported story action.');
  next.version = original.version + 1;
  const secondaryEvents: SecondaryCandidateEvent[] = next.readiness === 'ready' && original.readiness !== 'ready' ? [{ kind: 'ready' }] : [];
  const saved = await saveCandidate(next, original.version, event, { reason: change.reason ?? null, blockerId: change.blockerId ?? null }, secondaryEvents);
  return saved;
}

export async function recordCandidateView(userId: string, id: string, version: number, source: string, kind: 'shown' | 'opened', eventId: string) {
  const candidate = await currentCandidate(userId, id, version, source);
  if (kind === 'shown' && (candidate.dismissed || candidate.confirmedPublishedAt || !['ready', 'quick'].includes(candidate.readiness))) throw new ReadinessError('This story is not a recommendation.');
  await appendEvent(candidate, kind, {}, `view:${userId}:${eventId}`);
}

export async function getApprovedCampaignCandidates(userId: string, projectId: string) {
  const data = await listReadiness(userId);
  return data.candidates.filter(candidate => candidate.readiness === 'ready' && candidate.projectIds.length === 1 && candidate.projectIds[0] === projectId)
    .map(candidate => ({ id: candidate.id, version: candidate.version, sourceVersion: candidate.sourceVersion, projectIds: candidate.projectIds,
      title: candidate.draft.headline, caption: `${candidate.draft.caption}\n\nDesign: ${candidate.draft.credits.designer}\nPhotography: ${candidate.draft.credits.photographer}`, imageIds: candidate.visuals.map(image => image.id), imageUrls: candidate.visuals.map(image => image.url) }));
}

export async function recordCampaignCandidateEvent(userId: string, id: string, version: number, source: string, campaignId: string, kind: 'exported') {
  await appendEvent(await currentCandidate(userId, id, version, source), kind, { campaignId }, `campaign:${campaignId}:${id}:${version}`);
}

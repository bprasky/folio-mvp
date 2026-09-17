// Editorial Queue — corpus digest builder (docs/17_EDITORIAL_QUEUE.md).
// Component 1 of 4: code computes the facts, the model picks the story.

export { buildCorpusDigest } from './buildCorpusDigest';
export { fetchRawCorpusLayer } from './fetchRawCorpusLayer';
export { computeMaturity, EDITORIAL_QUEUE_MIN_STORIES } from './maturity';
export { validateAngles } from './validateAngles';
export { extractAngles, persistAngles, buildAngleUserPrompt, parseAngleResponse } from './extractAngles';
export { assignFormat } from './assignFormat';
export { generatePrompts, buildPromptGenUserPrompt, parsePromptResponse } from './generatePrompts';
export * from './types';

import { prisma } from '@/lib/prisma';
import { buildCorpusDigest } from './buildCorpusDigest';
import { fetchRawCorpusLayer } from './fetchRawCorpusLayer';
import type { EditorialCorpusScope } from './fetchRawCorpusLayer';
import { extractAngles, persistAngles } from './extractAngles';
import { assignFormat } from './assignFormat';
import { generatePrompts } from './generatePrompts';
import type { AngleType, CorpusDigest, ExtractedAngle, SignalEvidence } from './types';

export class EditorialCorpusChangedError extends Error {
  constructor() { super('Source projects changed during generation. Refresh your workspace and try again.'); }
}

// Model calls can take minutes. Recheck the entire input corpus before saving:
// even an uncited project may have influenced the model's editorial framing.
async function assertCurrentCorpus(designerId: string, scope: EditorialCorpusScope): Promise<void> {
  const count = await prisma.project.count({
    where: { id: { in: scope.projectIds }, designerId, designerOrgId: scope.organizationId,
      isPublic: true, post: { status: 'PUBLISHED' } },
  });
  if (count !== new Set(scope.projectIds).size) throw new EditorialCorpusChangedError();
}

// Fetch + assemble in one call. Returns null when the designer doesn't exist;
// callers check digest.maturity.eligibleSignalTypes.length (or the published
// story count) for the three-story gate.
export async function getCorpusDigestForDesigner(designerId: string, scope?: EditorialCorpusScope): Promise<CorpusDigest | null> {
  const raw = await fetchRawCorpusLayer(designerId, scope);
  if (!raw) return null;
  return buildCorpusDigest(raw);
}

export interface AngleExtractionRun {
  status: 'not_eligible' | 'no_signals' | 'llm_unavailable' | 'persisted';
  digest: CorpusDigest | null;
  persistedAngleIds: string[];
  rejectedCount: number;
}

/**
 * The Component 2 entry point: fetch the digest, apply the three-story gate,
 * extract angles, and persist the ones that pass the validation-reject rule.
 * The unlock hook (step 8) and the scheduled extraction both call this.
 *
 * organizationId is stamped onto persisted angles for org-posted designers so
 * the queue surface can scope to the brand; pass null for individual accounts.
 */
export async function runAngleExtraction(
  designerId: string,
  organizationId: string | null = null,
  scope?: EditorialCorpusScope,
): Promise<AngleExtractionRun> {
  const digest = await getCorpusDigestForDesigner(designerId, scope);
  const base = { digest, persistedAngleIds: [] as string[], rejectedCount: 0 };

  // Three-story gate: no eligible signal computations means the corpus hasn't
  // unlocked the queue yet.
  if (!digest || digest.maturity.eligibleSignalTypes.length === 0) {
    return { ...base, status: 'not_eligible' };
  }
  if (digest.signals.length === 0) {
    return { ...base, status: 'no_signals' };
  }

  if (scope) {
    // Both dismissed and active ideas consume their supporting signals. A
    // refresh must not charge for repeatedly proposing the same story.
    const prior = await prisma.designerAngle.findMany({
      where: { designerId, organizationId: scope.organizationId, queueItems: { some: { status: { not: 'expired' } } } },
      select: { signalIds: true },
    });
    const used = new Set(prior.flatMap((angle) => angle.signalIds));
    digest.signals = digest.signals.filter((signal) => !used.has(signal.id));
    if (!digest.signals.length) return { ...base, status: 'no_signals' };
  }

  const validated = await extractAngles(digest);
  if (validated === null) {
    return { ...base, status: 'llm_unavailable' };
  }

  let accepted = validated.accepted;
  if (scope) {
    const used = new Set<string>();
    accepted = accepted.filter((angle) => {
      if (angle.signalIds.some((id) => used.has(id))) return false;
      angle.signalIds.forEach((id) => used.add(id));
      return true;
    }).slice(0, DEFAULT_QUEUE_PIECES);
    await assertCurrentCorpus(designerId, scope);
  }
  const persistedAngleIds = await persistAngles(designerId, scope ? scope.organizationId : organizationId, accepted);
  return {
    status: 'persisted',
    digest,
    persistedAngleIds,
    rejectedCount: validated.rejected.length,
  };
}

// Default number of recommended pieces produced per queue-generation run. Each
// costs one prompt-generation call, so this is capped; remaining fresh angles
// stay available for later runs (angles compound).
const DEFAULT_QUEUE_PIECES = 3;

export interface QueueGenerationRun {
  extraction: AngleExtractionRun;
  createdQueueItemIds: string[];
}

// Convert a persisted DesignerAngle row back into the ExtractedAngle shape the
// prompt generator consumes. angleType was validated on the way in.
function toExtractedAngle(row: {
  angleType: string;
  summary: string;
  signalIds: string[];
  confidence: number;
  evidence: unknown;
  isFresh: boolean;
}): ExtractedAngle {
  return {
    angleType: row.angleType as AngleType,
    summary: row.summary,
    signalIds: row.signalIds,
    confidence: row.confidence,
    evidence: (row.evidence ?? {}) as SignalEvidence,
    isFresh: row.isFresh,
  };
}

/**
 * The full Component 2 + 3 flow: extract angles, then turn the strongest fresh
 * ones into recommended EditorialQueueItems (format assigned, prompts
 * generated, stored). Consuming an angle flips its isFresh to false. This is
 * what the unlock hook (step 8) calls on a designer's third publish.
 */
export async function generateQueueForDesigner(
  designerId: string,
  organizationId: string | null = null,
  maxPieces: number = DEFAULT_QUEUE_PIECES,
  scope?: EditorialCorpusScope,
): Promise<QueueGenerationRun> {
  const extraction = await runAngleExtraction(designerId, organizationId, scope);
  if (extraction.status !== 'persisted' || !extraction.digest) {
    return { extraction, createdQueueItemIds: [] };
  }

  // Strongest fresh angles first; cap the prompt-generation calls.
  const angles = await prisma.designerAngle.findMany({
    where: { id: { in: extraction.persistedAngleIds }, isFresh: true },
    orderBy: { confidence: 'desc' },
    take: maxPieces,
  });

  const publishedStoryCount = extraction.digest.maturity.publishedStoryCount;
  const createdQueueItemIds: string[] = [];

  for (const row of angles) {
    const angle = toExtractedAngle(row);
    const format = assignFormat(angle.angleType, publishedStoryCount);
    const prompts = await generatePrompts(angle, format);
    if (!prompts) continue; // model unavailable / unparseable — leave angle fresh for a retry
    if (scope) await assertCurrentCorpus(designerId, scope);

    const item = await prisma.editorialQueueItem.create({
      data: {
        designerId,
        angleId: row.id,
        format,
        prompts: prompts as object,
        status: 'recommended',
      },
      select: { id: true },
    });
    // The angle is now consumed by a queue item.
    await prisma.designerAngle.update({ where: { id: row.id }, data: { isFresh: false } });
    createdQueueItemIds.push(item.id);
  }

  return { extraction, createdQueueItemIds };
}

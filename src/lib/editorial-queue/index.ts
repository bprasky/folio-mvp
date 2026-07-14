// Editorial Queue — corpus digest builder (docs/17_EDITORIAL_QUEUE.md).
// Component 1 of 4: code computes the facts, the model picks the story.

export { buildCorpusDigest } from './buildCorpusDigest';
export { fetchRawCorpusLayer } from './fetchRawCorpusLayer';
export { computeMaturity, EDITORIAL_QUEUE_MIN_STORIES } from './maturity';
export { validateAngles } from './validateAngles';
export { extractAngles, persistAngles, buildAngleUserPrompt, parseAngleResponse } from './extractAngles';
export * from './types';

import { buildCorpusDigest } from './buildCorpusDigest';
import { fetchRawCorpusLayer } from './fetchRawCorpusLayer';
import { extractAngles, persistAngles } from './extractAngles';
import type { CorpusDigest } from './types';

// Fetch + assemble in one call. Returns null when the designer doesn't exist;
// callers check digest.maturity.eligibleSignalTypes.length (or the published
// story count) for the three-story gate.
export async function getCorpusDigestForDesigner(designerId: string): Promise<CorpusDigest | null> {
  const raw = await fetchRawCorpusLayer(designerId);
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
): Promise<AngleExtractionRun> {
  const digest = await getCorpusDigestForDesigner(designerId);
  const base = { digest, persistedAngleIds: [] as string[], rejectedCount: 0 };

  // Three-story gate: no eligible signal computations means the corpus hasn't
  // unlocked the queue yet.
  if (!digest || digest.maturity.eligibleSignalTypes.length === 0) {
    return { ...base, status: 'not_eligible' };
  }
  if (digest.signals.length === 0) {
    return { ...base, status: 'no_signals' };
  }

  const validated = await extractAngles(digest);
  if (validated === null) {
    return { ...base, status: 'llm_unavailable' };
  }

  const persistedAngleIds = await persistAngles(designerId, organizationId, validated.accepted);
  return {
    status: 'persisted',
    digest,
    persistedAngleIds,
    rejectedCount: validated.rejected.length,
  };
}

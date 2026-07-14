// Editorial Queue — corpus digest builder (docs/17_EDITORIAL_QUEUE.md).
// Component 1 of 4: code computes the facts, the model picks the story.

export { buildCorpusDigest } from './buildCorpusDigest';
export { fetchRawCorpusLayer } from './fetchRawCorpusLayer';
export { computeMaturity, EDITORIAL_QUEUE_MIN_STORIES } from './maturity';
export * from './types';

import { buildCorpusDigest } from './buildCorpusDigest';
import { fetchRawCorpusLayer } from './fetchRawCorpusLayer';
import type { CorpusDigest } from './types';

// Fetch + assemble in one call. Returns null when the designer doesn't exist;
// callers check digest.maturity.eligibleSignalTypes.length (or the published
// story count) for the three-story gate.
export async function getCorpusDigestForDesigner(designerId: string): Promise<CorpusDigest | null> {
  const raw = await fetchRawCorpusLayer(designerId);
  if (!raw) return null;
  return buildCorpusDigest(raw);
}

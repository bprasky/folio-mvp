// Editorial Queue — maturity ladder (docs/17_EDITORIAL_QUEUE.md).
// The ladder is mechanical: it defines which signal computations are eligible
// at each corpus depth. Angle types follow from eligible signals.

import type { CorpusMaturity, RawCorpusLayer, SignalType } from './types';

// The three-story unlock gate. Also consumed by the publish-time unlock hook
// (steps 6-8) — keep the constant here so gate and ladder can't drift apart.
export const EDITORIAL_QUEUE_MIN_STORIES = 3;

const SAVE_DELTA_MIN_STORIES = 5;
const SAVE_DELTA_MIN_TAGS = 100;
const EVOLUTION_MIN_STORIES = 8;

export function computeMaturity(raw: RawCorpusLayer): CorpusMaturity {
  const publishedStoryCount = raw.projects.filter((p) => p.publishedAt !== null).length;
  const tagCount = raw.tags.length;
  const hasEngagementData =
    Object.values(raw.productSaves).some((n) => n > 0) ||
    raw.projects.some((p) => p.saveCount > 0);

  const eligibleSignalTypes: SignalType[] = [];
  if (publishedStoryCount >= EDITORIAL_QUEUE_MIN_STORIES) {
    eligibleSignalTypes.push('repetition', 'distribution', 'claim_evidence', 'outlier');
  }
  if (
    publishedStoryCount >= SAVE_DELTA_MIN_STORIES &&
    tagCount >= SAVE_DELTA_MIN_TAGS &&
    hasEngagementData
  ) {
    eligibleSignalTypes.push('save_delta');
  }
  if (publishedStoryCount >= EVOLUTION_MIN_STORIES) {
    eligibleSignalTypes.push('evolution');
  }

  return { publishedStoryCount, tagCount, hasEngagementData, eligibleSignalTypes };
}

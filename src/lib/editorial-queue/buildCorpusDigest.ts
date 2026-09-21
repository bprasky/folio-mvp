// Editorial Queue — digest assembly (docs/17_EDITORIAL_QUEUE.md, Component 1).
// Pure orchestrator: maturity ladder decides which signal computations are
// eligible, each eligible computation runs over the raw layer, and the result
// is the single structured digest handed to angle extraction (Component 2).

import { computeMaturity } from './maturity';
import { SIGNAL_COMPUTATIONS } from './signals';
import { resolveSignalEvidence } from './evidence';
import type { CorpusDigest, RawCorpusLayer } from './types';

export function buildCorpusDigest(raw: RawCorpusLayer): CorpusDigest {
  const maturity = computeMaturity(raw);

  const signals = maturity.eligibleSignalTypes
    .flatMap((type) => SIGNAL_COMPUTATIONS[type](raw))
    .sort((a, b) => b.strength - a.strength);
  for (const signal of signals) resolveSignalEvidence(signal, raw);

  return {
    designerId: raw.designer.id,
    maturity,
    raw,
    signals,
  };
}

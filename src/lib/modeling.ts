/**
 * Lightweight modeling utilities for expected lift calculations
 */

export function expectedLift({
  base, // e.g., saves in segment
  conv, // baseline conversion (save->tag or tag->project)
  liftPct, // from rule or historical efficacy
  aov // average order value or project slice
}: {
  base: number;
  conv: number;
  liftPct: number;
  aov: number;
}) {
  return Math.round(base * conv * (liftPct / 100) * aov);
}

/**
 * Compute opportunity quadrant based on potential vs share
 */
export function getOpportunityQuadrant(
  potentialUsd: number,
  sharePct: number,
  medianPotential: number,
  medianShare: number
): 'Most Underserved'|'Build'|'Maintain'|'Watch' {
  if (potentialUsd >= medianPotential && sharePct < medianShare) {
    return 'Most Underserved';
  } else if (potentialUsd >= medianPotential && sharePct >= medianShare) {
    return 'Build';
  } else if (potentialUsd < medianPotential && sharePct >= medianShare) {
    return 'Maintain';
  } else {
    return 'Watch';
  }
}

/**
 * Calculate play item ranking score
 */
export function getPlayItemScore(item: {
  expectedLiftUsd: number;
  effortHrs: number;
  decayPctByDay: number;
  confidence: 'High'|'Medium'|'Test';
}): number {
  const efficiencyScore = item.expectedLiftUsd / Math.max(item.effortHrs, 1);
  const confidenceMultiplier = {
    'High': 1.0,
    'Medium': 0.7,
    'Test': 0.4
  }[item.confidence];
  
  // Higher decay means more urgency (positive factor)
  const urgencyFactor = 1 + (item.decayPctByDay / 100);
  
  return efficiencyScore * confidenceMultiplier * urgencyFactor;
}










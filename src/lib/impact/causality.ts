export const LIFT_TABLE = {
  spec_pack: { saveToTag: 8, tagToSpec: 3 },
  sample_kit: { saveToTag: 5, tagToSpec: 2 },
  review_meeting: { tagToSpec: 6 },
  vip_dinner: { relationship: 1, tagToSpec: 8 },         // aggressive play
  boost_post: { reach: 30, saveToTag: 6 },               // paid media on Folio
  capsule_collab: { reach: 45, saveToTag: 10, aov: 12 }  // co-created board
};

export interface CausalPlay {
  type: keyof typeof LIFT_TABLE;
  label: string;
  why: string;
  expectedLiftPts: number;
  historicalEvidence: string;
}

export function getCausalPlays(firmValueUsd: number, intentScore: number): CausalPlay[] {
  const plays: CausalPlay[] = [];
  
  if (firmValueUsd > 1000000 && intentScore > 70) {
    plays.push({
      type: 'vip_dinner',
      label: 'VIP Dinner',
      why: 'Past 8 vendor dinners → +7–10 pts tag→spec',
      expectedLiftPts: 8,
      historicalEvidence: '8 prior events, avg +8.2 pts'
    });
  }

  if (firmValueUsd > 500000) {
    plays.push({
      type: 'boost_post',
      label: 'Boost their post (paid)',
      why: 'Social proof amplification increases save→tag by +6 pts',
      expectedLiftPts: 6,
      historicalEvidence: '12 campaigns, avg +5.8 pts'
    });
  }

  plays.push({
    type: 'capsule_collab',
    label: 'Capsule collab board',
    why: 'Co-created boards drive +10 pts save→tag, +12% AOV',
    expectedLiftPts: 10,
    historicalEvidence: '5 collabs, avg +10.4 pts save→tag'
  });

  plays.push({
    type: 'review_meeting',
    label: 'Account review',
    why: 'Aligns sales to project timeline, +6 pts tag→spec',
    expectedLiftPts: 6,
    historicalEvidence: '34 reviews, avg +5.9 pts'
  });

  return plays;
}









import { Event, EventMetrics, EventWeight, SponsorshipTier } from '@prisma/client';

export function computePriorityScore(e: Event & { metrics?: EventMetrics }): number {
  // Base score from event configuration
  let score = e.baseScore ?? 0;
  
  // Weight multipliers
  const weightMultipliers = {
    ANCHOR: 3.0,
    FLEX: 1.5,
    BACKFILL: 0.8,
  };
  
  if (e.weight) {
    score *= weightMultipliers[e.weight] || 1.0;
  }
  
  // Sponsorship boost
  const sponsorshipMultipliers = {
    FREE: 1.0,
    SPONSORED: 1.3,
    PREMIUM: 2.0,
  };
  
  if (e.sponsorshipTier) {
    score *= sponsorshipMultipliers[e.sponsorshipTier] || 1.0;
  }
  
  // Engagement metrics boost
  if (e.metrics) {
    const { views, impressions, clicks, saves, rsvps, bookings } = e.metrics;
    
    // Engagement rate boost (clicks / impressions)
    if (impressions > 0) {
      const ctr = clicks / impressions;
      score += ctr * 100; // Boost by CTR percentage
    }
    
    // RSVP and booking boost
    score += rsvps * 2;
    score += bookings * 5;
    
    // Save boost
    score += saves * 1.5;
  }
  
  // Time-based decay for past events
  if (e.endDate < new Date()) {
    const daysSinceEnd = Math.floor((Date.now() - e.endDate.getTime()) / (1000 * 60 * 60 * 24));
    score *= Math.max(0.1, 1 - (daysSinceEnd / 365)); // Decay over a year
  }
  
  return Math.max(0, score);
}

export function suggestSizeToken(
  weight: EventWeight | null, 
  sponsorshipTier: SponsorshipTier | null, 
  score: number
): "XL" | "L" | "M" | "S" {
  // Base size by weight
  let baseSize: "XL" | "L" | "M" | "S" = "M";
  
  if (weight === "ANCHOR") {
    baseSize = "XL";
  } else if (weight === "FLEX") {
    baseSize = "L";
  } else if (weight === "BACKFILL") {
    baseSize = "S";
  }
  
  // Sponsorship can boost size
  if (sponsorshipTier === "PREMIUM" && baseSize !== "XL") {
    if (baseSize === "L") baseSize = "XL";
    else if (baseSize === "M") baseSize = "L";
    else if (baseSize === "S") baseSize = "M";
  } else if (sponsorshipTier === "SPONSORED" && baseSize === "S") {
    baseSize = "M";
  }
  
  // Score-based adjustments
  if (score > 1000 && baseSize !== "XL") {
    if (baseSize === "L") baseSize = "XL";
    else if (baseSize === "M") baseSize = "L";
    else if (baseSize === "S") baseSize = "M";
  } else if (score > 500 && baseSize === "S") {
    baseSize = "M";
  } else if (score < 50 && baseSize !== "S") {
    if (baseSize === "XL") baseSize = "L";
    else if (baseSize === "L") baseSize = "M";
    else if (baseSize === "M") baseSize = "S";
  }
  
  return baseSize;
}

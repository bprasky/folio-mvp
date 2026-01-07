import { getInitialDemoState } from './demoStore';

/**
 * AI Insights - Deterministic computation from demo inputs
 * Recomputes insights based on current demo state for live pitch demos
 */

export type AIInsights = {
  predictedTrendingSkus: Array<{ sku: string; liftPct: number }>;
  designerAffinity: Array<{ name: string; match: number }>;
  eventRoiAdvice: { shiftTo: string; expectedLiftPct: number };
  priceSensitivity: { sweetSpotUsd: [number, number] };
};

/**
 * Compute AI insights from current demo state
 * Simple deterministic transforms so controls feel responsive
 */
export function computeAIInsights(): AIInsights {
  const st = getInitialDemoState();
  const totalSaves = st.events.portfolioTotals.productsSaved ?? 0;
  const totalRsvps = st.events.portfolioTotals.totalRsvps ?? 0;
  const conversionPct = st.events.bridge.conversionPct ?? 0;

  // Find top performing event
  const topEvent = [...st.events.summaries].sort(
    (a, b) => (b.saves ?? 0) - (a.saves ?? 0)
  )[0];

  // Get top designer affinity candidates
  const topDesigners = st.designers.affinityCandidates.slice(0, 3);

  // Simple deterministic transforms
  // Base lift scales with saves (5-30% range)
  const baseLift = Math.max(5, Math.min(30, Math.round((totalSaves / 1000) * 3)));
  
  // Price sensitivity sweet spot (scales with conversion rate)
  const sweetLow = Math.max(800, 1200 - (conversionPct * 10));
  const sweetHigh = Math.min(3000, 2200 + (conversionPct * 15));

  // Event ROI advice (recommend shifting budget to top performer)
  const expectedLiftPct = baseLift + Math.round((totalRsvps / 1000) * 2);

  return {
    predictedTrendingSkus: [
      { sku: 'TRV-12x24-Honed', liftPct: baseLift },
      { sku: 'OAK-Plank-8in', liftPct: Math.max(3, baseLift - 4) },
      { sku: 'SLT-Charcoal-6x6', liftPct: Math.max(2, baseLift - 6) },
    ],
    designerAffinity: topDesigners.map(d => ({
      name: d.name,
      match: Math.round(d.match * 100) / 100,
    })),
    eventRoiAdvice: {
      shiftTo: topEvent?.name ?? 'NYCxDesign 2026',
      expectedLiftPct: expectedLiftPct,
    },
    priceSensitivity: {
      sweetSpotUsd: [sweetLow, sweetHigh] as [number, number],
    },
  };
}



import type { DemoState } from '@/lib/vendor-data/demoState';

/**
 * AI Insight Engine - Deterministic computation from demo data
 * Swappable with real ML model later
 */

export type OpportunityNode = {
  id: string;
  label: string;
  type: 'event' | 'region' | 'designer' | 'sku';
  score: number; // 0-100
  meta?: Record<string, any>;
};

export type DesignerFunnel = {
  total: number;
  exploring: number;
  warming: number;
  highIntent: number;
  closedLast90d: number;
  hotDesigners: Array<{ name: string; stage: 'warming' | 'highIntent'; score: number }>;
};

export type RevenueProjection = {
  quarter: string;
  projectedInfluenceUsd: number;
  changePct: number;
  drivers: string[];
};

export type Benchmark = {
  category: string;
  you: number;
  peersAvg: number;
  topQuartile: number;
};

export type QBRPayload = {
  period: string;
  totals: {
    rsvps: number;
    saves: number;
    tags: number;
    influenceUsd: number;
  };
  revenueProjection: RevenueProjection;
  topInsights: string[];
  benchmarks: Benchmark[];
};

export type AIInsight = {
  id: string;
  title: string;
  summary: string;
  impact: 'low' | 'medium' | 'high';
  metrics: Record<string, number | string>;
  actions: Array<{
    id: string;
    label: string;
    kind: 'promote_event' | 'sponsor_editorial' | 'target_designers' | 'reallocate_budget' | 'create_waitlist';
    payload: Record<string, any>;
  }>;
};

export type AIBundle = {
  updatedAt: string;
  insights: AIInsight[];
  opportunityMap: OpportunityNode[];
  designerFunnel: DesignerFunnel;
  revenueProjection: RevenueProjection;
  benchmarks: Benchmark[];
  qbr: QBRPayload;
};

const pct = (x: number) => Math.round(x * 10) / 10;

/**
 * Compute AI insights bundle from demo state
 * Deterministic transforms for demo responsiveness
 */
export function computeAIBundle(state: DemoState): AIBundle {
  const st = state;
  const events = st.events.summaries;
  const totals = st.events.portfolioTotals;
  const bridge = st.events.bridge;
  const designers = st.designers.affinityCandidates;

  const topEvent = [...events].sort((a, b) => (b.saves ?? 0) - (a.saves ?? 0))[0];
  const upNext = events.find(e => e.status === 'upcoming') ?? topEvent;
  const topDesigners = designers.slice(0, 3);

  const baseLift = Math.max(5, Math.min(35, Math.round((totals.productsSaved ?? 0) / 90)));
  const expectedConv = bridge.conversionPct ?? 15;

  const insights: AIInsight[] = [
    {
      id: 'forecast-trending-sku',
      title: 'Forecast: Travertine & 8" Oak trending for Q+1',
      summary: `Save velocity suggests +${baseLift}% lift if promoted pre-${upNext?.name}.`,
      impact: 'high',
      metrics: { 
        projected_lift_pct: baseLift, 
        event: upNext?.name ?? 'Next Event',
        skus: 'TRV-12x24-Honed, OAK-Plank-8in'
      },
      actions: [
        {
          id: 'action-promote-event',
          label: `Promote at ${upNext?.name}`,
          kind: 'promote_event',
          payload: {
            eventId: upNext?.id,
            budgetUsd: 8000,
            focusSkus: ['TRV-12x24-Honed', 'OAK-Plank-8in']
          }
        },
        {
          id: 'action-create-waitlist',
          label: 'Create Waitlist for SKUs',
          kind: 'create_waitlist',
          payload: {
            skus: ['TRV-12x24-Honed', 'OAK-Plank-8in']
          }
        }
      ]
    },
    {
      id: 'designer-affinity',
      title: 'Designer Affinity: 3 studios likely to spec your next collection',
      summary: `Best matches: ${topDesigners.map(d => d.name).join(', ')}.`,
      impact: 'medium',
      metrics: Object.fromEntries(topDesigners.map(d => [d.name, pct(d.match * 100)])),
      actions: [
        {
          id: 'action-target-designers',
          label: 'Target These Designers',
          kind: 'target_designers',
          payload: {
            designers: topDesigners.map(d => ({ id: d.designerId, name: d.name }))
          }
        },
        {
          id: 'action-sponsor-editorial',
          label: 'Sponsor Editorial Feature',
          kind: 'sponsor_editorial',
          payload: {
            theme: 'Warm Minimal Projects',
            designers: topDesigners.map(d => d.name)
          }
        }
      ]
    },
    {
      id: 'budget-optimization',
      title: 'Budget Optimization: shift 15% from Miami DW → NYCxDesign',
      summary: `Reallocate to the higher-conversion event for ~+${expectedConv}% more tags.`,
      impact: 'medium',
      metrics: {
        suggested_shift_pct: 15,
        expected_tag_uplift_pct: pct(expectedConv)
      },
      actions: [
        {
          id: 'action-reallocate',
          label: 'Apply Reallocation Plan',
          kind: 'reallocate_budget',
          payload: {
            from: 'mdw2026',
            to: 'nycx2026',
            percent: 15
          }
        }
      ]
    }
  ];

  // 2) Opportunity Map
  const opportunityMap: OpportunityNode[] = [
    ...events.map(e => ({
      id: e.id,
      label: e.name,
      type: 'event' as const,
      score: Math.min(100, Math.round(((e.saves ?? 0) / (totals.productsSaved || 1)) * 100)),
      meta: { city: e.city, status: e.status }
    })),
    ...topDesigners.map(d => ({
      id: d.designerId,
      label: d.name,
      type: 'designer' as const,
      score: Math.round(d.match * 100),
    })),
    {
      id: 'TRV',
      label: 'Travertine TRV-12x24-Honed',
      type: 'sku' as const,
      score: 92,
    },
    {
      id: 'OAK',
      label: 'OAK-Plank-8in',
      type: 'sku' as const,
      score: 88,
    }
  ];

  // 3) Designer Funnel (mocked from totals)
  const totalDesigners = totals.activeDesigners ?? 1200;
  const exploring = Math.round(totalDesigners * 0.6);
  const warming = Math.round(totalDesigners * 0.25);
  const highIntent = Math.round(totalDesigners * 0.1);
  const closed = Math.round(totalDesigners * 0.05);
  const hotDesigners = topDesigners.map(d => ({
    name: d.name,
    stage: 'highIntent' as const,
    score: Math.round(d.match * 100)
  }));

  const designerFunnel: DesignerFunnel = {
    total: totalDesigners,
    exploring,
    warming,
    highIntent,
    closedLast90d: closed,
    hotDesigners,
  };

  // 4) Revenue Projection
  const influence = totals.estProjectValueUsd ?? 20_000_000;
  const revProjection: RevenueProjection = {
    quarter: 'Q3 2026',
    projectedInfluenceUsd: influence * 1.1,
    changePct: 10.4,
    drivers: ['Designer affinity', 'Event momentum', 'SKU save velocity'],
  };

  // 5) Benchmarks (mocked)
  const benchmarks: Benchmark[] = [
    { category: 'Product Saves', you: 2.7, peersAvg: 1.9, topQuartile: 3.4 },
    { category: 'Project Tags', you: 1.34, peersAvg: 0.9, topQuartile: 1.6 },
    { category: 'Active Designers', you: 1.2, peersAvg: 0.8, topQuartile: 1.5 },
  ];

  // 6) QBR payload
  const qbr: QBRPayload = {
    period: 'Last 90 days',
    totals: {
      rsvps: totals.totalRsvps ?? 7400,
      saves: totals.productsSaved ?? 2700,
      tags: 1340,
      influenceUsd: totals.estProjectValueUsd ?? 20_000_000,
    },
    revenueProjection: revProjection,
    topInsights: [
      insights[0].summary,
      insights[1].summary,
      insights[2].summary,
    ],
    benchmarks,
  };

  return {
    updatedAt: new Date().toISOString(),
    insights,
    opportunityMap,
    designerFunnel,
    revenueProjection: revProjection,
    benchmarks,
    qbr,
  };
}


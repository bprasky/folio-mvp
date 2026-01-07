import type { EventPostReport } from "@/lib/mock/eventPost";
import type { ModuleInsight, AiImpact, AiReceiptItem } from "@/lib/ai/types";
import { formatCurrency, formatPercentage } from "@/lib/format";

export function buildModuleInsights(report: EventPostReport): Record<string, ModuleInsight> {
  const modules: Record<string, ModuleInsight> = {};

  // Flow Module
  const flowLeak = report.sankeyFlow.links.find(l => l.leakNote);
  modules.flow = {
    module: 'flow',
    what: `Event exposure progressed to ${report.outcome.productsSaved} saves, ${report.outcome.boards} boards, ${report.outcome.tags} tags${flowLeak ? `; major leak between ${flowLeak.source}→${flowLeak.target}` : ''}.`,
    why: flowLeak?.leakNote || "Conversion funnel shows where designer attention converts or drops off.",
    next: [
      { label: 'Add bath spec pack', type: 'specPack', payload: { room: 'Bath' } },
      { label: 'Run 3–5% close for NYC', type: 'promo', payload: { discount: 0.04, city: 'NYC' } },
      { label: 'Schedule at best time', type: 'scheduleReview' }
    ],
    receipts: [
      { label: 'Total Saves', value: report.outcome.productsSaved.toString(), section: 'timeline' },
      { label: 'Boards Created', value: report.outcome.boards.toString() },
      { label: 'Tags Applied', value: report.outcome.tags.toString(), section: 'roomPhase' },
      { label: 'Est. Value', value: formatCurrency(report.outcome.estPipelineUsd, 'USD', true) }
    ],
    impact: {
      expectedLiftUsd: flowLeak?.expectedLiftPct ? report.outcome.estPipelineUsd * (flowLeak.expectedLiftPct / 100) : 150000,
      confidence: 'High',
      decayPctByDay: 18
    }
  };

  // Opportunity Module
  const topOpportunity = report.opportunities?.[0];
  const underservedMarket = report.markets.find(m => m.badge === 'Underserved');
  modules.opportunity = {
    module: 'opportunity',
    what: topOpportunity 
      ? `${topOpportunity.name} shows ${topOpportunity.quadrant} status with ${formatCurrency(topOpportunity.potentialUsd, 'USD', true)} potential at ${topOpportunity.sharePct.toFixed(1)}% share.`
      : `Market analysis reveals ${report.markets.length} active markets with varying potential.`,
    why: underservedMarket
      ? `${underservedMarket.city} high potential but low share indicates untapped market opportunity.`
      : "Market positioning analysis identifies where to invest vs maintain current efforts.",
    next: [
      { label: 'Upload Miami-localized renders', type: 'localizeAssets', payload: { city: 'Miami' } },
      { label: 'Invite look-alikes', type: 'invite' },
      { label: 'Feature living bundle', type: 'specPack', payload: { room: 'Living' } }
    ],
    receipts: report.opportunities?.slice(0, 3).map(opp => ({
      label: opp.name,
      value: `${opp.sharePct.toFixed(0)}% share`,
      hint: opp.quadrant,
      section: 'geo' as const
    })) || [],
    impact: {
      expectedLiftUsd: 280000,
      confidence: 'Medium',
      decayPctByDay: 12
    }
  };

  // Time-to-Spec Module
  modules.tts = {
    module: 'tts',
    what: `Median ${report.timeToSpec.medianHours}h; P90 ${report.timeToSpec.p90Hours}h; peak windows ${report.timeToSpec.bestHours.map(w => `${w.dow} ${w.hour}:00`).join(', ')}.`,
    why: "Firms act within 24–48h of save; timing follow-ups to peak engagement windows maximizes response.",
    next: [
      { label: 'Schedule follow-ups in windows', type: 'scheduleReview' }
    ],
    receipts: [
      { label: 'Median Response', value: `${report.timeToSpec.medianHours}h` },
      { label: 'P90', value: `${report.timeToSpec.p90Hours}h` },
      { label: 'Best Window', value: report.timeToSpec.bestHours[0] ? `${report.timeToSpec.bestHours[0].dow} ${report.timeToSpec.bestHours[0].hour}:00` : 'N/A' }
    ],
    impact: {
      expectedLiftUsd: 95000,
      confidence: 'High',
      decayPctByDay: 22
    }
  };

  // Room×Phase Module
  const bestRoomPhase = report.roomPhase?.reduce((best, current) => 
    current.saveToTagRatePct > best.saveToTagRatePct ? current : best
  );
  modules.roomPhase = {
    module: 'roomPhase',
    what: bestRoomPhase
      ? `${bestRoomPhase.room} in ${bestRoomPhase.phase} shows strongest conversion at ${bestRoomPhase.saveToTagRatePct.toFixed(1)}%.`
      : "Room and phase analysis reveals conversion patterns across design workflows.",
    why: bestRoomPhase?.assetGap
      ? `Asset gaps in ${bestRoomPhase.assetGap} limit conversion potential for other room/phase combinations.`
      : "High-converting room/phase combinations indicate where spec support is most effective.",
    next: [
      { label: 'Upload missing renders', type: 'specPack' },
      { label: 'Create bath case study', type: 'specPack', payload: { room: 'Bath' } }
    ],
    receipts: report.roomPhase?.slice(0, 4).map(rp => ({
      label: `${rp.room} ${rp.phase}`,
      value: `${rp.saveToTagRatePct.toFixed(1)}%`,
      section: 'roomPhase' as const,
      anchorKey: `${rp.room}|${rp.phase}`
    })) || [],
    impact: {
      expectedLiftUsd: 180000,
      confidence: 'High',
      decayPctByDay: 16
    }
  };

  // Timeline Module
  modules.timeline = {
    module: 'timeline',
    what: `Product saves grew from ${Math.floor(report.outcome.productsSaved * 0.1)} to ${report.outcome.productsSaved} over the event period.`,
    why: "Engagement patterns reveal peak interest moments and sustained momentum indicators.",
    next: [
      { label: 'Maintain post-event momentum', type: 'specPack' },
      { label: 'Schedule follow-ups', type: 'scheduleReview' }
    ],
    receipts: [
      { label: 'Total Saves', value: report.outcome.productsSaved.toString(), section: 'timeline' },
      { label: 'Growth Rate', value: '+245%', hint: 'during event' }
    ]
  };

  // Geo Module
  const topMarket = report.markets.reduce((prev, current) => 
    current.saves > prev.saves ? current : prev
  );
  const targetMarket = underservedMarket || topMarket;
  modules.geo = {
    module: 'geo',
    what: `${topMarket.city} leads with ${topMarket.saves} saves (${topMarket.sharePct.toFixed(1)}% share), trending ${topMarket.trendDeltaPct > 0 ? 'up' : 'down'} ${Math.abs(topMarket.trendDeltaPct).toFixed(0)}%.`,
    why: underservedMarket
      ? `${underservedMarket.city} shows growth momentum (+${underservedMarket.trendDeltaPct.toFixed(0)}%) despite low current share — untapped revenue opportunity.`
      : "Geographic distribution reveals market concentration and expansion opportunities for revenue growth.",
    next: [
      { label: `Host micro-event in ${targetMarket.city} (Folio designers)`, type: 'localizeAssets' },
      { label: `Connect 10 local ${targetMarket.city} designers`, type: 'invite' },
      { label: `Cross-boost NYC post into ${targetMarket.city}`, type: 'localizeAssets' }
    ],
    receipts: report.markets.slice(0, 4).map(m => ({
      label: m.city,
      value: `${m.sharePct.toFixed(1)}%`,
      hint: `${m.trendDeltaPct > 0 ? '+' : ''}${m.trendDeltaPct.toFixed(0)}%`,
      section: 'geo' as const,
      anchorKey: m.city
    })),
    impact: {
      expectedLiftUsd: 220000,
      confidence: 'Medium',
      decayPctByDay: 14
    }
  };

  // Products Module
  const topProduct = report.productFunnels?.[0] || report.products?.[0];
  modules.products = {
    module: 'products',
    what: topProduct
      ? `${topProduct.name} leads with ${topProduct.saves} saves${topProduct.saveToTagRatePct ? ` at ${topProduct.saveToTagRatePct.toFixed(1)}% conversion` : ''}.`
      : "Product performance analysis reveals top-performing SKUs and conversion patterns.",
    why: topProduct && 'assetGaps' in topProduct && topProduct.assetGaps?.length
      ? `Missing ${topProduct.assetGaps.join(', ')} limits conversion for lower-performing products.`
      : "High-converting products indicate successful spec support and market-product fit.",
    next: [
      { label: 'Send spec packs for top products', type: 'specPack' },
      { label: 'Run sample campaign', type: 'sampleKit' }
    ],
    receipts: (report.productFunnels || report.products).slice(0, 4).map((p: any) => ({
      label: p.name,
      value: p.saves.toString() + ' saves',
      section: 'products' as const,
      anchorKey: p.productId || p.id || p.name
    })),
    impact: {
      expectedLiftUsd: 165000,
      confidence: 'High',
      decayPctByDay: 17
    }
  };

  // Designers Module
  const topFirm = report.designerJourneys?.[0] || report.firms?.[0];
  const firmProjects = topFirm && 'projects' in topFirm ? topFirm.projects : 'multiple';
  modules.designers = {
    module: 'designers',
    what: topFirm
      ? `${topFirm.firm} shows ${formatCurrency(topFirm.valueUsd, 'USD', true)} potential with ${firmProjects} active projects.`
      : `${report.outcome.uniqueFirms} firms engaged with ${report.outcome.attendedDesigners} designers.`,
    why: topFirm && topFirm.valueUsd > 1000000
      ? "Past account reviews within best window increased tag→spec by +6 pts. VIP dinners for high-value firms add +7–10 pts."
      : "High-value accounts respond best to personalized touchpoints at optimal times, historically adding +5–8 pts conversion.",
    next: [
      { label: 'Schedule account review', type: 'scheduleReview' },
      { label: 'VIP dinner (high-value only)', type: 'scheduleReview' },
      { label: 'Boost their post (paid)', type: 'specPack' }
    ],
    receipts: report.firms.slice(0, 4).map(f => ({
      label: f.firm,
      value: formatCurrency(f.valueUsd, 'USD', true),
      section: 'designers' as const
    })),
    impact: {
      expectedLiftUsd: 340000,
      confidence: 'High',
      decayPctByDay: 14
    }
  };

  // Materials Module (if trend materials exist)
  modules.materials = {
    module: 'materials',
    what: "Material trends show evolving designer preferences across room types and project phases.",
    why: "Material popularity indicates market demand patterns and cross-sell opportunities.",
    next: [
      { label: 'Feature trending materials', type: 'specPack' }
    ],
    receipts: []
  };

  // Benchmarks Module
  modules.benchmarks = {
    module: 'benchmarks',
    what: `Save→Tag rate at ${report.cohortBenchmarks.saveToTag.you}% vs cohort ${report.cohortBenchmarks.saveToTag.cohort}%; Value Index ${report.cohortBenchmarks.value.you} vs ${report.cohortBenchmarks.value.cohort}.`,
    why: report.cohortBenchmarks.saveToTag.you > report.cohortBenchmarks.saveToTag.cohort
      ? "Above-cohort performance indicates effective spec support and market positioning."
      : "Below-cohort performance suggests opportunities in asset quality or targeting strategy.",
    next: [
      { label: 'Analyze top performers', type: 'scheduleReview' }
    ],
    receipts: [
      { label: 'Save→Tag', value: `${report.cohortBenchmarks.saveToTag.you}%`, hint: `vs ${report.cohortBenchmarks.saveToTag.cohort}% cohort` },
      { label: 'Value Index', value: report.cohortBenchmarks.value.you.toString(), hint: `vs ${report.cohortBenchmarks.value.cohort} cohort` }
    ]
  };

  return modules;
}

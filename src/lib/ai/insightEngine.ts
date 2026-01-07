import type { EventPostReport } from "@/lib/mock/eventPost";
import type { AiInsight, AiReceiptItem, AiImpact } from "@/lib/ai/types";
import { formatCurrency, formatPercentage } from "@/lib/format";

export function generateAiInsights(report: EventPostReport): AiInsight[] {
  const insights: AiInsight[] = [];

  // Market insights
  const topMarket = report.markets.reduce((prev, current) => 
    prev.saves > current.saves ? prev : current
  );
  const underservedMarket = report.markets.find(m => 
    m.badge === 'Underserved' && m.trendDeltaPct > 10
  );

  if (topMarket && topMarket.badge === 'Hot') {
    const impact: AiImpact = {
      expectedLiftUsd: Math.round(topMarket.saves * 0.15 * 2800),
      confidence: 'High',
      decayPctByDay: 15
    };

    const receipts: AiReceiptItem[] = [
      {
        label: `${topMarket.city} share`,
        value: `${topMarket.sharePct.toFixed(1)}%`,
        hint: `+${topMarket.trendDeltaPct.toFixed(0)}% WoW`,
        section: 'geo',
        anchorKey: topMarket.city
      },
      {
        label: 'Hot badge',
        value: 'Active',
        hint: 'high share + rising'
      },
      {
        label: 'Expected lift',
        value: `$${(impact.expectedLiftUsd / 1000).toFixed(0)}k`,
        hint: 'High confidence'
      },
      {
        label: 'Designers',
        value: Math.floor(topMarket.saves / 15).toString(),
        hint: 'engaged'
      }
    ];

    insights.push({
      id: 'market-hot-close',
      title: `Close now in ${topMarket.city}`,
      body: `${topMarket.city} shows high engagement (${topMarket.sharePct.toFixed(1)}% share) with rising trend (+${topMarket.trendDeltaPct.toFixed(0)}%). This is prime closing territory.`,
      impact,
      receipts,
      action: { 
        type: 'promo', 
        label: `Run 5% close discount`,
        payload: { discount: 0.05, duration: 7, city: topMarket.city }
      },
      guardrails: { margin: 'med' }
    });
  }

  if (underservedMarket) {
    const impact: AiImpact = {
      expectedLiftUsd: Math.round(underservedMarket.saves * 0.08 * 3200),
      confidence: 'Medium',
      decayPctByDay: 12
    };

    const receipts: AiReceiptItem[] = [
      {
        label: `${underservedMarket.city} share`,
        value: `${underservedMarket.sharePct.toFixed(1)}%`,
        hint: 'low current',
        section: 'geo',
        anchorKey: underservedMarket.city
      },
      {
        label: 'Growth trend',
        value: `+${underservedMarket.trendDeltaPct.toFixed(0)}%`,
        hint: 'strong momentum'
      },
      {
        label: 'Underserved',
        value: 'True',
        hint: 'opportunity'
      }
    ];

    insights.push({
      id: 'market-underserved-growth',
      title: `Grow ${underservedMarket.city} market`,
      body: `${underservedMarket.city} shows low current share (${underservedMarket.sharePct.toFixed(1)}%) but strong upward momentum (+${underservedMarket.trendDeltaPct.toFixed(0)}%). Time to invest.`,
      impact,
      receipts,
      action: {
        type: 'localizeAssets',
        label: 'Localize assets',
        payload: { city: underservedMarket.city }
      }
    });
  }

  // Product insights - using productFunnels if available, fallback to products
  const productData = report.productFunnels || report.products || [];
  const topProduct = productData.reduce((prev: any, current: any) => {
    const prevRate = prev.saveToTagRatePct || (prev.tags / prev.saves) * 100;
    const currentRate = current.saveToTagRatePct || (current.tags / current.saves) * 100;
    return currentRate > prevRate ? current : prev;
  });

  if (topProduct && (topProduct.saveToTagRatePct || (topProduct.tags / topProduct.saves) * 100) > 80) {
    const rate = topProduct.saveToTagRatePct || (topProduct.tags / topProduct.saves) * 100;
    const impact: AiImpact = {
      expectedLiftUsd: Math.round(topProduct.tags * 0.25 * 2500),
      confidence: 'High',
      decayPctByDay: 18
    };

    const receipts: AiReceiptItem[] = [
      {
        label: 'Save→Tag rate',
        value: `${rate.toFixed(1)}%`,
        hint: 'exceptional',
        section: 'products',
        anchorKey: topProduct.productId
      },
      {
        label: 'Total saves',
        value: topProduct.saves.toString(),
        hint: 'high volume'
      },
      {
        label: 'Projects',
        value: (topProduct.projects || Math.floor(topProduct.saves / 20)).toString(),
        hint: 'active'
      }
    ];

    insights.push({
      id: 'product-high-converter',
      title: `Scale ${topProduct.name} success`,
      body: `${topProduct.name} has exceptional conversion (${rate.toFixed(1)}% save→tag rate). This is your proof point.`,
      impact,
      receipts,
      action: {
        type: 'specPack',
        label: 'Boost marketing',
        payload: { productId: topProduct.productId }
      }
    });
  }

  // Asset gap insights
  const productWithGaps = report.productFunnels?.find((p: any) => 
    p.assetGaps && p.assetGaps.length > 0 && p.saveToTagRatePct < 60
  );

  if (productWithGaps && productWithGaps.assetGaps?.length > 0) {
    const gap = productWithGaps.assetGaps[0];
    const impact: AiImpact = {
      expectedLiftUsd: Math.round(productWithGaps.saves * 0.12 * 2200),
      confidence: 'High',
      decayPctByDay: 20
    };

    const receipts: AiReceiptItem[] = [
      {
        label: 'Conversion rate',
        value: `${productWithGaps.saveToTagRatePct.toFixed(1)}%`,
        hint: 'below avg',
        section: 'products',
        anchorKey: productWithGaps.productId
      },
      {
        label: 'Asset gap',
        value: gap,
        hint: 'blocking'
      },
      {
        label: 'Potential lift',
        value: '+12%',
        hint: 'typical'
      }
    ];

    insights.push({
      id: 'asset-gap-fix',
      title: `Fix ${gap} gap for ${productWithGaps.name}`,
      body: `${productWithGaps.name} has low conversion (${productWithGaps.saveToTagRatePct.toFixed(1)}%) due to missing ${gap}. Upload these assets to unlock growth.`,
      impact,
      receipts,
      action: {
        type: 'specPack',
        label: 'Upload assets',
        payload: { assetType: gap, productId: productWithGaps.productId }
      }
    });
  }

  // Room insights
  const bestRoomPhase = report.roomPhase?.reduce((prev, current) => 
    current.saveToTagRatePct > prev.saveToTagRatePct ? current : prev
  );

  if (bestRoomPhase && bestRoomPhase.saveToTagRatePct > 70) {
    const impact: AiImpact = {
      expectedLiftUsd: Math.round(bestRoomPhase.tags * 0.18 * 3000),
      confidence: 'Medium',
      decayPctByDay: 16
    };

    const receipts: AiReceiptItem[] = [
      {
        label: `${bestRoomPhase.room} ${bestRoomPhase.phase}`,
        value: `${bestRoomPhase.saveToTagRatePct.toFixed(1)}%`,
        hint: 'excellent',
        section: 'roomPhase',
        anchorKey: `${bestRoomPhase.room}|${bestRoomPhase.phase}`
      },
      {
        label: 'Saves',
        value: bestRoomPhase.saves.toString(),
        hint: 'solid volume'
      },
      {
        label: 'Tags',
        value: bestRoomPhase.tags.toString(),
        hint: 'high intent'
      }
    ];

    insights.push({
      id: 'room-phase-opportunity',
      title: `Scale ${bestRoomPhase.room} ${bestRoomPhase.phase} success`,
      body: `${bestRoomPhase.room} in ${bestRoomPhase.phase} phase shows excellent conversion (${bestRoomPhase.saveToTagRatePct.toFixed(1)}%). Create targeted case studies.`,
      impact,
      receipts,
      action: {
        type: 'specPack',
        label: 'Create case study',
        payload: { room: bestRoomPhase.room, phase: bestRoomPhase.phase }
      }
    });
  }

  // Time insights
  if (report.timeToSpec?.medianHours && report.timeToSpec.medianHours < 24) {
    const impact: AiImpact = {
      expectedLiftUsd: Math.round((report.outcome?.tags || 0) * 0.15 * 1800),
      confidence: 'High',
      decayPctByDay: 22
    };

    const receipts: AiReceiptItem[] = [
      {
        label: 'Median response',
        value: `${report.timeToSpec.medianHours}h`,
        hint: 'fast',
        section: 'timeline',
        anchorKey: 'fast-response'
      },
      {
        label: 'Best send time',
        value: `${report.timeToSpec.bestHours[0]?.dow} ${report.timeToSpec.bestHours[0]?.hour}:00`,
        hint: 'optimal'
      }
    ];

    insights.push({
      id: 'timing-fast-response',
      title: 'Capitalize on fast response time',
      body: `Designers respond quickly (${report.timeToSpec.medianHours}h median). Strike while interest is hot with immediate follow-ups.`,
      impact,
      receipts,
      action: {
        type: 'scheduleReview',
        label: 'Schedule follow-ups',
        payload: { 
          medianHours: report.timeToSpec.medianHours,
          bestHours: report.timeToSpec.bestHours 
        }
      }
    });
  }

  // Designer insights
  const topFirm = report.designerJourneys?.[0];
  if (topFirm && topFirm.valueUsd > 1000000) {
    const impact: AiImpact = {
      expectedLiftUsd: Math.round(topFirm.valueUsd * 0.2),
      confidence: 'High',
      decayPctByDay: 14
    };

    const receipts: AiReceiptItem[] = [
      {
        label: 'Firm value',
        value: `$${(topFirm.valueUsd / 1000000).toFixed(1)}M`,
        hint: 'high potential',
        section: 'designers',
        anchorKey: topFirm.firm.toLowerCase()
      },
      {
        label: 'Touchpoints',
        value: topFirm.steps?.length?.toString() || '5',
        hint: 'engaged'
      },
      {
        label: 'Best time',
        value: `${topFirm.nextTouch?.bestDow} ${topFirm.nextTouch?.bestHour}:00`,
        hint: 'optimal'
      }
    ];

    insights.push({
      id: 'high-value-firm-action',
      title: `Accelerate ${topFirm.firm} engagement`,
      body: `${topFirm.firm} shows high value potential ($${(topFirm.valueUsd / 1000000).toFixed(1)}M) and active engagement. Ready for next phase.`,
      impact,
      receipts,
      action: {
        type: 'scheduleReview',
        label: topFirm.nextTouch?.suggestion || 'Schedule review',
        payload: { firm: topFirm.firm, valueUsd: topFirm.valueUsd }
      }
    });
  }

  return insights.slice(0, 8); // Limit to max 8 insights
}

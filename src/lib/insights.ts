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
    insights.push({
      id: 'market-hot-close',
      title: `Close now in ${topMarket.city}`,
      insight: `${topMarket.city} shows high engagement (${topMarket.sharePct.toFixed(1)}% share) with rising trend (+${topMarket.trendDeltaPct.toFixed(0)}%). This is prime closing territory.`,
      action: `Run 5% close discount for ${topMarket.city} designers for 7 days`,
      expectedLiftUsd: Math.round(topMarket.saves * 0.15 * 2800),
      confidence: 'High',
      urgency: 'High',
      category: 'market',
      receipts: [
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
          value: formatCurrency(Math.round(topMarket.saves * 0.15 * 2800), 'USD', true),
          hint: 'High confidence'
        }
      ]
    });
  }

  if (underservedMarket) {
    insights.push({
      id: 'market-underserved-growth',
      title: `Grow ${underservedMarket.city} market`,
      insight: `${underservedMarket.city} shows low current share (${underservedMarket.sharePct.toFixed(1)}%) but strong upward momentum (+${underservedMarket.trendDeltaPct.toFixed(0)}%). Time to invest.`,
      action: `Localize marketing assets and invite look-alike designers in ${underservedMarket.city}`,
      expectedLiftUsd: Math.round(underservedMarket.saves * 0.08 * 3200),
      confidence: 'Medium',
      urgency: 'Medium',
      category: 'market',
      receipts: [
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
      ]
    });
  }

  // Product insights
  const topProduct = report.productFunnels.reduce((prev, current) => 
    current.saveToTagRatePct > prev.saveToTagRatePct ? current : prev
  );

  if (topProduct && topProduct.saveToTagRatePct > 80) {
    insights.push({
      id: 'product-high-converter',
      title: `Scale ${topProduct.name} success`,
      insight: `${topProduct.name} has exceptional conversion (${topProduct.saveToTagRatePct.toFixed(1)}% save→tag rate). This is your proof point.`,
      action: `Feature ${topProduct.name} in case studies and boost marketing budget`,
      expectedLiftUsd: Math.round(topProduct.tags * 0.25 * 2500),
      confidence: 'High',
      urgency: 'Medium',
      category: 'product',
      receipts: [
        {
          label: 'Save→Tag rate',
          value: `${topProduct.saveToTagRatePct.toFixed(1)}%`,
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
          value: topProduct.projects.toString(),
          hint: 'active'
        }
      ]
    });
  }

  // Asset gap insights
  const productWithGaps = report.productFunnels.find(p => 
    p.assetGaps.length > 0 && p.saveToTagRatePct < 60
  );

  if (productWithGaps) {
    const gap = productWithGaps.assetGaps[0];
    insights.push({
      id: 'asset-gap-fix',
      title: `Fix ${gap} gap for ${productWithGaps.name}`,
      insight: `${productWithGaps.name} has low conversion (${productWithGaps.saveToTagRatePct.toFixed(1)}%) due to missing ${gap}. Upload these assets to unlock growth.`,
      action: `Upload ${gap} for ${productWithGaps.name} within 3 days`,
      expectedLiftUsd: Math.round(productWithGaps.saves * 0.12 * 2200),
      confidence: 'High',
      urgency: 'High',
      category: 'asset',
      receipts: [
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
      ]
    });
  }

  // Room insights
  const bestRoomPhase = report.roomPhase.reduce((prev, current) => 
    current.saveToTagRatePct > prev.saveToTagRatePct ? current : prev
  );

  if (bestRoomPhase && bestRoomPhase.saveToTagRatePct > 70) {
    insights.push({
      id: 'room-phase-opportunity',
      title: `Scale ${bestRoomPhase.room} ${bestRoomPhase.phase} success`,
      insight: `${bestRoomPhase.room} in ${bestRoomPhase.phase} phase shows excellent conversion (${bestRoomPhase.saveToTagRatePct.toFixed(1)}%). Create targeted case studies.`,
      action: `Create ${bestRoomPhase.room} ${bestRoomPhase.phase} case study and share with similar projects`,
      expectedLiftUsd: Math.round(bestRoomPhase.tags * 0.18 * 3000),
      confidence: 'Medium',
      urgency: 'Low',
      category: 'product',
      receipts: [
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
      ]
    });
  }

  // Time insights
  if (report.timeToSpec.medianHours < 24) {
    insights.push({
      id: 'timing-fast-response',
      title: 'Capitalize on fast response time',
      insight: `Designers respond quickly (${report.timeToSpec.medianHours}h median). Strike while interest is hot with immediate follow-ups.`,
      action: `Schedule follow-ups within ${report.timeToSpec.medianHours}h of saves, especially on ${report.timeToSpec.bestHours[0]?.dow}s`,
      expectedLiftUsd: Math.round(report.outcome.tags * 0.15 * 1800),
      confidence: 'High',
      urgency: 'High',
      category: 'timing',
      receipts: [
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
        },
        {
          label: 'P90',
          value: `${report.timeToSpec.p90Hours}h`,
          hint: 'most respond by'
        }
      ]
    });
  }

  // Designer insights
  const topFirm = report.designerJourneys[0];
  if (topFirm && topFirm.valueUsd > 1000000) {
    insights.push({
      id: 'high-value-firm-action',
      title: `Accelerate ${topFirm.firm} engagement`,
      insight: `${topFirm.firm} shows high value potential (${formatCurrency(topFirm.valueUsd, 'USD', true)}) and active engagement. Ready for next phase.`,
      action: topFirm.nextTouch.suggestion,
      expectedLiftUsd: Math.round(topFirm.valueUsd * 0.2),
      confidence: 'High',
      urgency: 'Medium',
      category: 'designer',
      receipts: [
        {
          label: 'Firm value',
          value: formatCurrency(topFirm.valueUsd, 'USD', true),
          hint: 'high potential',
          section: 'designers',
          anchorKey: topFirm.firm.toLowerCase()
        },
        {
          label: 'Touchpoints',
          value: topFirm.steps.length.toString(),
          hint: 'engaged'
        },
        {
          label: 'Best time',
          value: `${topFirm.nextTouch.bestDow} ${topFirm.nextTouch.bestHour}:00`,
          hint: 'optimal'
        }
      ]
    });
  }

  return insights.slice(0, 8); // Limit to max 8 insights
}

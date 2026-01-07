import type { RoomPhaseCell, MarketRow, IntentDesigner } from "@/lib/mock/eventPost";

export interface PostSuggestion {
  id: string;
  title: string;
  reason: string;
  action: string;
  target?: string;
  impact: 'High' | 'Medium' | 'Low';
}

/**
 * Generate suggestions for room/phase matrix interactions
 */
export function getRoomPhaseSuggestions(cell: RoomPhaseCell): PostSuggestion[] {
  const suggestions: PostSuggestion[] = [];

  // Asset gap suggestions
  if (cell.assetGap) {
    const assetMap = {
      images: 'Upload high-res product images',
      renders: 'Provide 3D renders and lifestyle shots',
      specs: 'Create detailed specification sheets',
      samples: 'Offer material samples and swatches'
    };

    suggestions.push({
      id: `asset-gap-${cell.room}-${cell.phase}`,
      title: assetMap[cell.assetGap] || 'Add missing assets',
      reason: `${cell.room} ${cell.phase} phase has ${cell.assetGap} gap`,
      action: 'Upload Assets',
      impact: 'High'
    });
  }

  // High conversion rate suggestions
  if (cell.saveToTagRatePct >= 40) {
    if (cell.phase === 'FF&E' || cell.phase === 'Procurement') {
      suggestions.push({
        id: `close-${cell.room}-${cell.phase}`,
        title: 'Run 5% Close',
        reason: `High intent in ${cell.room} ${cell.phase} (${cell.saveToTagRatePct}% save-to-tag rate)`,
        action: 'Schedule Promo',
        impact: 'High'
      });
    } else {
      suggestions.push({
        id: `spec-pack-${cell.room}-${cell.phase}`,
        title: 'Send Spec Pack',
        reason: `Strong interest in ${cell.room} ${cell.phase} phase`,
        action: 'Send Spec Pack',
        impact: 'Medium'
      });
    }
  }

  // Boost case studies for high-save rooms
  if (cell.saves > 30) {
    suggestions.push({
      id: `case-study-${cell.room}`,
      title: 'Boost Case Study',
      reason: `${cell.room} driving ${cell.saves} saves - showcase success stories`,
      action: 'Promote Case Study',
      impact: 'Medium'
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for market interactions
 */
export function getMarketSuggestions(market: MarketRow): PostSuggestion[] {
  const suggestions: PostSuggestion[] = [];

  if (market.badge === 'Underserved') {
    suggestions.push(
      {
        id: `localize-${market.city}`,
        title: 'Localize Assets',
        reason: `${market.city} showing growth (+${market.trendDeltaPct}%) but low share (${market.sharePct}%)`,
        action: 'Upload Localized Shots',
        target: market.city,
        impact: 'High'
      },
      {
        id: `invite-${market.city}`,
        title: 'Invite Look-Alike Designers',
        reason: `Expand reach in ${market.city} market with similar profile designers`,
        action: 'Send Invitations',
        target: market.city,
        impact: 'Medium'
      }
    );
  }

  if (market.badge === 'Hot') {
    suggestions.push({
      id: `close-${market.city}`,
      title: 'Close Now',
      reason: `${market.city} is hot market (${market.sharePct}% share, +${market.trendDeltaPct}% trend)`,
      action: 'Run Closing Promo',
      target: market.city,
      impact: 'High'
    });
  }

  // High trend suggestions
  if (market.trendDeltaPct > 15) {
    suggestions.push({
      id: `followup-${market.city}`,
      title: 'Schedule Follow-ups',
      reason: `${market.city} trending up ${market.trendDeltaPct}% - capitalize on momentum`,
      action: 'Schedule Calls',
      target: market.city,
      impact: 'Medium'
    });
  }

  return suggestions;
}

/**
 * Generate suggestions for intent segment actions
 */
export function getIntentSegmentSuggestions(segment: string, designers: IntentDesigner[]): PostSuggestion[] {
  const suggestions: PostSuggestion[] = [];
  const segmentMap = {
    readyToClose: {
      title: 'Close Offer 5%',
      reason: `${designers.length} high-intent designers ready for closing`,
      action: 'Schedule Close Offer'
    },
    warmEvaluators: {
      title: 'Send Sample Kit',
      reason: `${designers.length} warm prospects evaluating specs`,
      action: 'Send Sample Kit'
    },
    earlyExplorers: {
      title: 'Share Moodboard Images',
      reason: `${designers.length} early-stage designers exploring`,
      action: 'Share Moodboards'
    }
  };

  const config = segmentMap[segment as keyof typeof segmentMap];
  if (config) {
    suggestions.push({
      id: `segment-${segment}`,
      title: config.title,
      reason: config.reason,
      action: config.action,
      impact: segment === 'readyToClose' ? 'High' : 'Medium'
    });
  }

  return suggestions;
}

/**
 * Generate product-focused suggestions
 */
export function getProductSuggestions(product: any): PostSuggestion[] {
  const suggestions: PostSuggestion[] = [];

  // High save-to-tag rate
  if (product.saveToTagRatePct > 60) {
    suggestions.push({
      id: `feature-${product.id}`,
      title: 'Feature Product',
      reason: `High conversion rate (${product.saveToTagRatePct}%) - feature prominently`,
      action: 'Feature on Homepage',
      impact: 'High'
    });
  }

  // Trending products
  if (product.saves > 50) {
    suggestions.push({
      id: `badge-${product.id}`,
      title: 'Add Trending Badge',
      reason: `${product.saves} saves - add "Trending at [Event]" badge`,
      action: 'Add Badge',
      impact: 'Medium'
    });
  }

  // Spec pack for high saves
  if (product.saves > 30) {
    suggestions.push({
      id: `spec-pack-${product.id}`,
      title: 'Send Spec Pack',
      reason: `${product.saves} saves indicate strong interest`,
      action: 'Send Spec Pack',
      impact: 'Medium'
    });
  }

  return suggestions;
}










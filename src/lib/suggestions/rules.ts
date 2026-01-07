import { Suggestion, FocusContext } from './types';
import { EventAnalytics, RoomType, ProjectPhase } from '@/lib/mock/eventAnalytics';

export function suggestionsForRoom(ctx: FocusContext, analytics: EventAnalytics): Suggestion[] {
  const roomData = analytics.roomSharePct?.find(r => r.room === ctx.key);
  const roomSaves = analytics.savesByRoom.find(r => r.room === ctx.key);
  
  if (!roomData || !roomSaves) return [];

  const suggestions: Suggestion[] = [];
  
  if (roomData.pct < 10) {
    // Low engagement - focus on assets
    suggestions.push({
      id: `room-low-${ctx.key}`,
      title: `Submit 2–3 styled ${ctx.key} photos/renders`,
      reason: `${ctx.key} = ${roomData.pct}% of saves${roomData.trendDeltaPct ? ` (${roomData.trendDeltaPct > 0 ? '+' : ''}${roomData.trendDeltaPct}% WoW)` : ''}`,
      impact: 'Medium',
      actionLabel: 'Upload Assets',
      actionType: 'upload',
      payload: { room: ctx.key, count: 3 }
    });
    
    suggestions.push({
      id: `room-editorial-${ctx.key}`,
      title: `Create ${ctx.key} use-case taglines for product pages`,
      reason: `Low ${ctx.key} engagement needs better positioning`,
      impact: 'Test',
      actionLabel: 'Write Content',
      actionType: 'editorial',
      payload: { room: ctx.key }
    });
  } else if (roomData.pct >= 30) {
    // High engagement - capitalize on momentum
    suggestions.push({
      id: `room-promo-${ctx.key}`,
      title: `Schedule 5% flash promo for ${ctx.key} designers this week`,
      reason: `${ctx.key} = ${roomData.pct}% of saves${roomData.trendDeltaPct ? ` (+${roomData.trendDeltaPct}% WoW)` : ''}`,
      impact: 'High',
      actionLabel: 'Schedule Promo',
      actionType: 'promo',
      payload: { room: ctx.key, discount: 5, duration: 7 }
    });
    
    suggestions.push({
      id: `room-message-${ctx.key}`,
      title: `Message top 3 designers saving ${ctx.key} items`,
      reason: `High-value ${ctx.key} segment driving ${roomData.pct}% engagement`,
      impact: 'High',
      actionLabel: 'Send Messages',
      actionType: 'message',
      payload: { room: ctx.key, count: 3 }
    });
  }

  return suggestions.slice(0, 2); // Limit to top 2
}

export function suggestionsForTime(ctx: FocusContext, analytics: EventAnalytics): Suggestion[] {
  const date = ctx.key;
  const point = analytics.timeSeries.find(p => p.date === date);
  
  if (!point) return [];

  // Find if this was a spike day
  const avg = analytics.timeSeries.reduce((sum, p) => sum + p.saves, 0) / analytics.timeSeries.length;
  const isSpike = point.saves > avg * 1.3;

  const suggestions: Suggestion[] = [];

  if (isSpike) {
    suggestions.push({
      id: `time-spike-${date}`,
      title: `Engagement spike on ${new Date(date).toLocaleDateString()} — publish recap post + featured product set`,
      reason: `${point.saves} saves vs ${Math.round(avg)} average`,
      impact: 'High',
      actionLabel: 'Create Editorial',
      actionType: 'editorial',
      payload: { date, saves: point.saves }
    });
    
    suggestions.push({
      id: `time-retarget-${date}`,
      title: `Retarget all savers from ${new Date(date).toLocaleDateString()} with follow-up spec sheet`,
      reason: `Capitalize on ${point.saves}-save momentum`,
      impact: 'Medium',
      actionLabel: 'Send Specs',
      actionType: 'message',
      payload: { date, saves: point.saves }
    });
  }

  return suggestions;
}

export function suggestionsForPhase(ctx: FocusContext, analytics: EventAnalytics): Suggestion[] {
  const phaseData = analytics.phaseIntent?.find(p => p.phase === ctx.key as ProjectPhase);
  
  if (!phaseData) return [];

  const suggestions: Suggestion[] = [];

  if (ctx.key === 'Concept' && phaseData.assetGap === 'renders') {
    suggestions.push({
      id: `phase-concept-${ctx.key}`,
      title: `Provide moodboard-ready hero images`,
      reason: `Concept phase = ${phaseData.pct}% of intent, needs ${phaseData.assetGap}`,
      impact: 'High',
      actionLabel: 'Upload Renders',
      actionType: 'upload',
      payload: { phase: ctx.key, assetType: 'renders' }
    });
  } else if (ctx.key === 'Procurement' && phaseData.pct > 8) {
    suggestions.push({
      id: `phase-procurement-${ctx.key}`,
      title: `Offer closing incentive to active savers`,
      reason: `Procurement phase emerging at ${phaseData.pct}%`,
      impact: 'High',
      actionLabel: 'Create Offer',
      actionType: 'promo',
      payload: { phase: ctx.key, discount: 3 }
    });
  }

  return suggestions;
}

export function suggestionsForCity(ctx: FocusContext, analytics: EventAnalytics): Suggestion[] {
  // Handle the new context data structure from GeoPopularity
  const cityContextData = ctx.data;
  
  if (cityContextData && cityContextData.citySharePct !== undefined) {
    const {
      city,
      citySharePct,
      cityTrendDeltaPct,
      portfolioMedianSharePct = 20
    } = cityContextData;

    const suggestions: Suggestion[] = [];
    
    // Underrepresented High-Potential Markets rule
    const isUnderserved = citySharePct < portfolioMedianSharePct && cityTrendDeltaPct >= 0;
    
    if (isUnderserved) {
      suggestions.push({
        id: `city-upload-${city}`,
        title: `Localize assets for ${city}`,
        reason: `Low share (${citySharePct}%), positive trend (+${cityTrendDeltaPct}%).`,
        impact: 'High',
        actionLabel: 'Upload renders/photos',
        actionType: 'upload',
        payload: { city, type: 'localized-assets' }
      });
    }

    // High trend cities - suggest closing actions
    if (cityTrendDeltaPct > 5) {
      suggestions.push({
        id: `city-close-${city}`,
        title: `Run 5% close in ${city}`,
        reason: `High intent: saves trending +${cityTrendDeltaPct}%.`,
        impact: 'High',
        actionLabel: 'Schedule promo',
        actionType: 'promo',
        payload: { city, discountPct: 5 }
      });
    }

    // High share cities - suggest closing actions
    if (citySharePct > portfolioMedianSharePct * 1.5) {
      suggestions.push({
        id: `city-message-${city}`,
        title: `Message ${city} savers with spec sheet bundle`,
        reason: `${city} driving ${citySharePct}% of saves - high engagement market.`,
        impact: 'Medium',
        actionLabel: 'Send Spec Bundle',
        actionType: 'message',
        payload: { city, type: 'spec-sheet-bundle' }
      });
    }

    return suggestions;
  }

  // Fallback to original logic if new context structure not available
  const cityData = analytics.cityShareTrend?.find(c => c.city === ctx.key);
  const cityCount = analytics.geo.find(c => c.city === ctx.key);
  
  if (!cityData || !cityCount) return [];

  const suggestions: Suggestion[] = [];

  if (cityCount.count > 200) {
    suggestions.push({
      id: `city-high-${ctx.key}`,
      title: `Co-host micro-event for ${ctx.key} designers next month`,
      reason: `${ctx.key} = ${cityData.pct}% of engagement${cityData.trendDeltaPct ? ` (+${cityData.trendDeltaPct}% WoW)` : ''}`,
      impact: 'High',
      actionLabel: 'Plan Event',
      actionType: 'invite',
      payload: { city: ctx.key, count: cityCount.count }
    });
  } else if (cityCount.count < 100) {
    suggestions.push({
      id: `city-low-${ctx.key}`,
      title: `Localize product shots for ${ctx.key} projects`,
      reason: `${ctx.key} underperforming at ${cityCount.count} saves`,
      impact: 'Medium',
      actionLabel: 'Create Assets',
      actionType: 'upload',
      payload: { city: ctx.key }
    });
  }

  return suggestions;
}

export function suggestionsForNode(ctx: FocusContext, analytics: EventAnalytics): Suggestion[] {
  const flowCounts = analytics.flowCounts;
  if (!flowCounts) return [];

  const suggestions: Suggestion[] = [];

  switch (ctx.key) {
    case 'event':
      suggestions.push({
        id: 'node-event',
        title: 'Promote event page; invite look-alike designers',
        reason: `${flowCounts.event} attendees registered`,
        impact: 'Medium',
        actionLabel: 'Invite Designers',
        actionType: 'invite',
        payload: { count: flowCounts.event }
      });
      break;
      
    case 'saves':
      suggestions.push({
        id: 'node-saves',
        title: 'Email savers with spec sheet bundle',
        reason: `${flowCounts.saves} products saved`,
        impact: 'High',
        actionLabel: 'Send Specs',
        actionType: 'message',
        payload: { count: flowCounts.saves }
      });
      break;
      
    case 'boards':
      suggestions.push({
        id: 'node-boards',
        title: 'Request user photos/renders to deepen intent',
        reason: `${flowCounts.boards} boards created`,
        impact: 'Medium',
        actionLabel: 'Request Content',
        actionType: 'upload',
        payload: { count: flowCounts.boards }
      });
      break;
      
    case 'tags':
      suggestions.push({
        id: 'node-tags',
        title: 'Bundle tagged products into "Project Kit"',
        reason: `${flowCounts.tags} project tags applied`,
        impact: 'High',
        actionLabel: 'Create Bundle',
        actionType: 'promo',
        payload: { count: flowCounts.tags }
      });
      break;
      
    case 'value':
      suggestions.push({
        id: 'node-value',
        title: 'Schedule closing offer (3–5%) to top-intent firms',
        reason: `$${(flowCounts.valueUsd / 1000000).toFixed(1)}M estimated value`,
        impact: 'High',
        actionLabel: 'Schedule Offer',
        actionType: 'promo',
        payload: { value: flowCounts.valueUsd, discount: 4 }
      });
      break;
  }

  return suggestions;
}

export function suggestionsForDesigner(ctx: FocusContext, analytics: EventAnalytics): Suggestion[] {
  const designer = analytics.topDesigners.find(d => d.id === ctx.key);
  const influenceScore = analytics.influenceScoreByDesigner?.[ctx.key] || 0;
  
  if (!designer || influenceScore < 70) return [];

  const suggestions: Suggestion[] = [
    {
      id: `designer-${ctx.key}`,
      title: `Invite ${designer.name} to micro-collab board`,
      reason: `${influenceScore}% influence score, ${designer.saves} saves`,
      impact: influenceScore > 90 ? 'High' : 'Medium',
      actionLabel: 'Send Invite',
      actionType: 'invite',
      payload: { designerId: ctx.key, name: designer.name }
    }
  ];

  if (designer.estProjectValueUsd > 800000) {
    suggestions.push({
      id: `designer-specs-${ctx.key}`,
      title: `Send one-click spec pack`,
      reason: `High-value client: $${(designer.estProjectValueUsd / 1000000).toFixed(1)}M projects`,
      impact: 'High',
      actionLabel: 'Send Specs',
      actionType: 'message',
      payload: { designerId: ctx.key, name: designer.name }
    });
  }

  return suggestions;
}

export function suggestionsForProduct(ctx: FocusContext, analytics: EventAnalytics): Suggestion[] {
  const product = analytics.topProducts.find(p => p.id === ctx.key);
  
  if (!product) return [];

  const suggestions: Suggestion[] = [
    {
      id: `product-feature-${ctx.key}`,
      title: `Feature on Event page hero`,
      reason: `${product.saves} saves, trending placement`,
      impact: product.saves > 80 ? 'High' : 'Medium',
      actionLabel: 'Feature Product',
      actionType: 'promo',
      payload: { productId: ctx.key, name: product.name }
    }
  ];

  if (product.saves > 60) {
    suggestions.push({
      id: `product-badge-${ctx.key}`,
      title: `Add "Trending at ${analytics.eventName}" badge`,
      reason: `${product.saves} saves qualifies for trending badge`,
      impact: 'Test',
      actionLabel: 'Add Badge',
      actionType: 'promo',
      payload: { productId: ctx.key, name: product.name }
    });
  }

  return suggestions;
}

import { VendorAnalyticsData } from "./vendorAnalyticsMock";

export interface DemoControls {
  eventImpactMultiplier: number;     // 0.5 - 1.5
  productMomentumMultiplier: number; // 0.5 - 1.5
  pipelineMultiplier: number;        // 0.5 - 1.5
  saveToTagConversionBoost: number;  // 0 - 0.5 (adds to conversion rate)
}

// Provide a default set of controls
export const defaultDemoControls: DemoControls = {
  eventImpactMultiplier: 1,
  productMomentumMultiplier: 1,
  pipelineMultiplier: 1,
  saveToTagConversionBoost: 0,
};

export function applyDemoControls(
  data: VendorAnalyticsData,
  controls: DemoControls
): VendorAnalyticsData {
  // Return a shallow-cloned object with adjusted numeric fields
  return {
    ...data,
    eventStats: data.eventStats.map(stat => ({
      ...stat,
      influencedPipelineBudget: Math.round(stat.influencedPipelineBudget * controls.eventImpactMultiplier),
    })),
    productStats: data.productStats.map(stat => ({
      ...stat,
      last30DaysTrendScore: Math.max(-1, Math.min(1, stat.last30DaysTrendScore * controls.productMomentumMultiplier)),
      saves: Math.round(stat.saves * (1 + controls.productMomentumMultiplier * 0.1)),
      tags: Math.round(stat.tags * (1 + controls.saveToTagConversionBoost)),
    })),
    projectInfluenceStats: data.projectInfluenceStats.map(stat => ({
      ...stat,
      vendorInfluenceValue: Math.round(stat.vendorInfluenceValue * controls.pipelineMultiplier),
    })),
    designerEngagement: data.designerEngagement.map(eng => ({
      ...eng,
      influencedProjectBudget: Math.round(eng.influencedProjectBudget * controls.pipelineMultiplier),
      totalTags: Math.round(eng.totalTags * (1 + controls.saveToTagConversionBoost)),
    })),
  };
}



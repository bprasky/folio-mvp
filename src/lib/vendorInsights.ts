import { VendorAnalyticsData } from "./vendorAnalyticsMock";
import { VisualizationType } from "./vendorAnalyticsVisualization";

export interface QuickInsight {
  id: string;
  question: string;
  summary: string;
  // simple data structure for mini visual
  metricLabel: string;
  metricValue: string | number;
  metricDelta?: number; // for up/down arrows
}

export interface PinnedInsight {
  id: string;
  question: string;
  visualizationTypeHint?: VisualizationType;
  pinnedAt: string;
}

export function getQuickInsights(data: VendorAnalyticsData): QuickInsight[] {
  // 1. Which designers are most engaged with my products?
  const topDesigners = [...data.designerEngagement]
    .sort((a, b) => {
      const scoreA = a.totalSaves + a.totalTags * 2 + a.totalSpecIntentEvents * 3;
      const scoreB = b.totalSaves + b.totalTags * 2 + b.totalSpecIntentEvents * 3;
      return scoreB - scoreA;
    })
    .slice(0, 5);

  const highBudgetDesigners = topDesigners.filter(d => d.influencedProjectBudget > 500000).length;
  const designerInsight: QuickInsight = {
    id: "insight-designers",
    question: "Which designers are most engaged with my products?",
    summary: `${topDesigners.length} designers are driving most of your engagement this month. ${highBudgetDesigners} of them are working on projects over $500k.`,
    metricLabel: "Top designers",
    metricValue: topDesigners.length,
    metricDelta: highBudgetDesigners,
  };

  // 2. Which events actually produced real demand?
  const eventsByImpact = [...data.eventStats]
    .sort((a, b) => b.influencedPipelineBudget - a.influencedPipelineBudget);
  
  const topEvent = eventsByImpact[0];
  const eventName = data.events.find(e => e.eventId === topEvent.eventId)?.name || "Top event";
  const totalPipeline = eventsByImpact.reduce((sum, e) => sum + e.influencedPipelineBudget, 0);
  
  const eventInsight: QuickInsight = {
    id: "insight-events",
    question: "Which events actually produced real demand?",
    summary: `${eventName} generated the strongest pipeline impact, with $${(topEvent.influencedPipelineBudget / 1000000).toFixed(1)}M in influenced budget across ${topEvent.designerCheckins} designer check-ins.`,
    metricLabel: "Total pipeline",
    metricValue: `$${(totalPipeline / 1000000).toFixed(1)}M`,
    metricDelta: eventsByImpact.length > 1 ? 
      Math.round(((topEvent.influencedPipelineBudget - eventsByImpact[1].influencedPipelineBudget) / eventsByImpact[1].influencedPipelineBudget) * 100) : undefined,
  };

  // 3. Which SKUs are trending up or down?
  const trendingProducts = data.productStats
    .filter(stat => stat.last30DaysTrendScore > 0.5)
    .sort((a, b) => b.last30DaysTrendScore - a.last30DaysTrendScore);
  
  const laggingProducts = data.productStats
    .filter(stat => stat.last30DaysTrendScore < -0.2)
    .sort((a, b) => a.last30DaysTrendScore - b.last30DaysTrendScore);

  const topTrending = trendingProducts[0];
  const topTrendingProduct = data.products.find(p => p.productId === topTrending?.productId);
  
  const trendInsight: QuickInsight = {
    id: "insight-trends",
    question: "Which SKUs are trending up or down?",
    summary: `${trendingProducts.length} products show strong upward momentum, led by ${topTrendingProduct?.name || "top performer"}. ${laggingProducts.length} products are lagging and may need attention.`,
    metricLabel: "Trending up",
    metricValue: trendingProducts.length,
    metricDelta: laggingProducts.length > 0 ? -laggingProducts.length : undefined,
  };

  // 4. What is my current influence value across active projects?
  const activeProjects = data.projects.filter(p => p.status === "active");
  const totalInfluence = data.projectInfluenceStats
    .filter(stat => activeProjects.some(p => p.projectId === stat.projectId))
    .reduce((sum, stat) => sum + stat.vendorInfluenceValue, 0);
  
  const totalBudget = activeProjects.reduce((sum, p) => sum + p.estimatedBudgetTotal, 0);
  const influencePercentage = totalBudget > 0 ? (totalInfluence / totalBudget) * 100 : 0;
  
  const influenceInsight: QuickInsight = {
    id: "insight-influence",
    question: "What is my current influence value across active projects?",
    summary: `Your products are influencing $${(totalInfluence / 1000000).toFixed(2)}M across ${activeProjects.length} active projects, representing ${influencePercentage.toFixed(1)}% of total project budgets.`,
    metricLabel: "Influence value",
    metricValue: `$${(totalInfluence / 1000000).toFixed(2)}M`,
    metricDelta: Math.round(influencePercentage),
  };

  return [designerInsight, eventInsight, trendInsight, influenceInsight];
}

export function generateDynamicInsight(
  question: string,
  data: VendorAnalyticsData
): { summary: string; details?: string } {
  const lowerQuestion = question.toLowerCase();

  // Designer engagement questions
  if (lowerQuestion.includes("designer") && (lowerQuestion.includes("engage") || lowerQuestion.includes("relationship") || lowerQuestion.includes("build"))) {
    const topDesigners = [...data.designerEngagement]
      .sort((a, b) => b.alignmentScore - a.alignmentScore)
      .slice(0, 3);
    
    const designerNames = topDesigners.map(d => {
      const designer = data.designers.find(des => des.designerId === d.designerId);
      return designer?.name || "Unknown";
    }).join(", ");

    return {
      summary: `Based on current behavior, ${topDesigners.length} designers show the strongest alignment with your products. ${designerNames} have high engagement scores and are actively working on projects where your products are being specified.`,
      details: `These designers have an average alignment score of ${(topDesigners.reduce((sum, d) => sum + d.alignmentScore, 0) / topDesigners.length).toFixed(2)}, with combined influenced project budgets of $${(topDesigners.reduce((sum, d) => sum + d.influencedProjectBudget, 0) / 1000000).toFixed(2)}M.`,
    };
  }

  // Event impact questions
  if (lowerQuestion.includes("event") && (lowerQuestion.includes("demand") || lowerQuestion.includes("produce") || lowerQuestion.includes("impact"))) {
    const eventsByImpact = [...data.eventStats]
      .sort((a, b) => b.influencedPipelineBudget - a.influencedPipelineBudget);
    
    const topEvent = eventsByImpact[0];
    const event = data.events.find(e => e.eventId === topEvent.eventId);
    
    return {
      summary: `Early signals suggest ${event?.name || "your top event"} generated the most meaningful pipeline impact this year, with $${(topEvent.influencedPipelineBudget / 1000000).toFixed(1)}M in influenced budget.`,
      details: `The event saw ${topEvent.designerCheckins} designer check-ins, ${topEvent.productSavesAtEvent} product saves, and ${topEvent.productTagsAttributedToEvent} product tags that can be attributed to the event.`,
    };
  }

  // Product/SKU questions
  if (lowerQuestion.includes("sku") || (lowerQuestion.includes("product") && (lowerQuestion.includes("trend") || lowerQuestion.includes("double") || lowerQuestion.includes("focus")))) {
    const trendingProducts = data.productStats
      .filter(stat => stat.last30DaysTrendScore > 0.5)
      .sort((a, b) => b.last30DaysTrendScore - a.last30DaysTrendScore)
      .slice(0, 3);
    
    const productNames = trendingProducts.map(stat => {
      const product = data.products.find(p => p.productId === stat.productId);
      return product?.name || "Unknown";
    }).join(", ");

    return {
      summary: `Based on current behavior, it looks like ${trendingProducts.length} products are showing strong momentum: ${productNames}. These SKUs have seen increasing saves, tags, and spec intent over the last 30 days.`,
      details: `The top trending product has a momentum score of ${trendingProducts[0]?.last30DaysTrendScore.toFixed(2)}, with ${trendingProducts[0]?.saves} saves and ${trendingProducts[0]?.tags} tags in the last period.`,
    };
  }

  // Influence value questions
  if (lowerQuestion.includes("influence") || (lowerQuestion.includes("value") && lowerQuestion.includes("project"))) {
    const activeProjects = data.projects.filter(p => p.status === "active");
    const totalInfluence = data.projectInfluenceStats
      .filter(stat => activeProjects.some(p => p.projectId === stat.projectId))
      .reduce((sum, stat) => sum + stat.vendorInfluenceValue, 0);
    
    const totalBudget = activeProjects.reduce((sum, p) => sum + p.estimatedBudgetTotal, 0);
    const influencePercentage = totalBudget > 0 ? (totalInfluence / totalBudget) * 100 : 0;

    return {
      summary: `Your current influence value across active projects is $${(totalInfluence / 1000000).toFixed(2)}M, representing ${influencePercentage.toFixed(1)}% of total project budgets.`,
      details: `This spans ${activeProjects.length} active projects, with an average influence value of $${(totalInfluence / activeProjects.length / 1000).toFixed(0)}k per project.`,
    };
  }

  // Default fallback
  return {
    summary: "Based on current behavior, your analytics show steady engagement across products, designers, and events. Explore specific questions to dive deeper into any area.",
  };
}


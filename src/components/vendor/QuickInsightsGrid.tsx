"use client";

import { VendorAnalyticsData } from "@/lib/vendorAnalyticsMock";
import { QuickInsight, getQuickInsights } from "@/lib/vendorInsights";

interface QuickInsightsGridProps {
  data: VendorAnalyticsData;
  onSelectInsight?: (insightId: string) => void;
}

export default function QuickInsightsGrid({ data, onSelectInsight }: QuickInsightsGridProps) {
  const insights = getQuickInsights(data);

  const renderMiniVisual = (insight: QuickInsight) => {
    if (insight.id === "insight-events") {
      // Simple bar representation for events
      const maxValue = 100;
      const barHeight = 60;
      return (
        <div className="flex items-end gap-1 h-16 mt-2">
          {[80, 45, 65].map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-[var(--text-tertiary)] rounded-t"
              style={{ height: `${(height / maxValue) * barHeight}px` }}
            />
          ))}
        </div>
      );
    }

    if (insight.id === "insight-trends") {
      // Sparkline-like row of blocks
      const trendData = [3, 5, 4, 7, 6, 9, 8];
      const maxTrend = Math.max(...trendData);
      return (
        <div className="flex items-end gap-0.5 h-12 mt-2">
          {trendData.map((value, i) => (
            <div
              key={i}
              className="flex-1 bg-[var(--text-secondary)] rounded-t"
              style={{ height: `${(value / maxTrend) * 40}px` }}
            />
          ))}
        </div>
      );
    }

    if (insight.id === "insight-influence") {
      // Simple number with delta
      return (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-folio-text-primary">{insight.metricValue}</span>
          {insight.metricDelta !== undefined && (
            <span className="text-sm text-folio-text-secondary">
              {insight.metricDelta > 0 ? "↑" : "↓"} {Math.abs(insight.metricDelta)}%
            </span>
          )}
        </div>
      );
    }

    // Default: simple metric display
    return (
      <div className="mt-2">
        <div className="text-2xl font-semibold text-folio-text-primary">{insight.metricValue}</div>
        {insight.metricDelta !== undefined && (
          <div className="text-sm text-folio-text-secondary mt-1">
            {insight.metricDelta > 0 ? "↑" : "↓"} {Math.abs(insight.metricDelta)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {insights.map((insight) => (
        <button
          key={insight.id}
          onClick={() => onSelectInsight?.(insight.id)}
          className="text-left ridge-card p-6 hover:shadow-md transition-all duration-200"
        >
          <h3 className="folio-ui font-semibold text-folio-text-primary mb-2 line-clamp-2">
            {insight.question}
          </h3>
          <p className="folio-ui text-folio-text-secondary mb-4 line-clamp-2">
            {insight.summary}
          </p>
          {renderMiniVisual(insight)}
        </button>
      ))}
    </div>
  );
}



"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import type { Benchmarks } from "@/lib/mock/eventPost";
import type { DriverDelta } from "@/lib/benchmarks/driverDelta";
import { useAnalyticsDrawer } from "@/components/vendor/events/ai/useAnalyticsDrawer";

interface BenchmarksEnhancedProps {
  benchmarks: Benchmarks;
  drivers: DriverDelta[];
}

export function BenchmarksEnhanced({ benchmarks, drivers }: BenchmarksEnhancedProps) {
  const { openDrawer } = useAnalyticsDrawer();

  const metrics = [
    { 
      label: 'Save → Tag', 
      you: benchmarks.vsPrior.saveToTagPct || 52, 
      prev3: 45, 
      cohort: 42 
    },
    { 
      label: 'Tag → Spec', 
      you: benchmarks.vsPrior.saveToTagPct ? benchmarks.vsPrior.saveToTagPct * 0.54 : 28, 
      prev3: 23, 
      cohort: 19 
    },
    { 
      label: 'Value Index', 
      you: benchmarks.vsPrior.valuePct || 68, 
      prev3: 51, 
      cohort: 47 
    }
  ];

  const getBarWidth = (value: number, max: number) => {
    return (value / max) * 100;
  };

  const maxValue = Math.max(...metrics.flatMap(m => [m.you, m.prev3, m.cohort]));

  return (
    <div className="col-span-7 space-y-6">
      {/* Visual bars for each metric */}
      {metrics.map((metric, index) => {
        const gap = metric.you - metric.cohort;
        const isAhead = gap > 0;

        return (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--ink)]">
                {metric.label}
              </span>
              <div className="flex items-center gap-2">
                {isAhead ? (
                  <TrendingUp className="w-4 h-4 text-[var(--emerald)]" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-[var(--rose)]" />
                )}
                <Badge className={isAhead ? 'bg-[var(--emerald)]/10 text-[var(--emerald)]' : 'bg-[var(--rose)]/10 text-[var(--rose)]'}>
                  {isAhead ? '+' : ''}{gap.toFixed(0)} pts vs cohort
                </Badge>
              </div>
            </div>

            {/* Dual bar comparison */}
            <div className="space-y-1">
              {/* You */}
              <div className="flex items-center gap-3">
                <span className="w-16 text-xs text-[var(--slate)] text-right">You</span>
                <div className="flex-1 relative h-8 bg-[var(--grid)] rounded overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-[var(--teal)] transition-all duration-500"
                    style={{ width: `${getBarWidth(metric.you, maxValue)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-3">
                    <span className="text-xs font-semibold h-num text-white mix-blend-difference">
                      {metric.you}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Prev 3 */}
              <div className="flex items-center gap-3">
                <span className="w-16 text-xs text-[var(--slate)] text-right">Prev 3</span>
                <div className="flex-1 relative h-6 bg-[var(--grid)] rounded overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-[var(--slate)]/40 transition-all duration-500"
                    style={{ width: `${getBarWidth(metric.prev3, maxValue)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-3">
                    <span className="text-xs font-medium h-num text-[var(--ink)]">
                      {metric.prev3}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Cohort */}
              <div className="flex items-center gap-3">
                <span className="w-16 text-xs text-[var(--slate)] text-right">Cohort</span>
                <div className="flex-1 relative h-6 bg-[var(--grid)] rounded overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-[var(--slate)]/20 transition-all duration-500"
                    style={{ width: `${getBarWidth(metric.cohort, maxValue)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-3">
                    <span className="text-xs font-medium h-num text-[var(--ink)]">
                      {metric.cohort}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Driver Delta Bullets */}
      <div className="pt-4 border-t border-[var(--grid)]">
        <div className="text-sm font-semibold text-[var(--ink)] mb-3">
          Performance Drivers
        </div>
        <div className="space-y-2">
          {drivers.map((driver, index) => {
            const isPositive = driver.impact > 0;
            
            return (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-[var(--grid)]/20 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs h-num ${isPositive ? 'bg-[var(--emerald)]/10 text-[var(--emerald)]' : 'bg-[var(--rose)]/10 text-[var(--rose)]'}`}>
                    {isPositive ? '+' : ''}{driver.impact.toFixed(0)} pts
                  </Badge>
                  <span className="text-sm text-[var(--ink)]">{driver.driver}</span>
                </div>
                {driver.section && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => driver.section && openDrawer({ section: driver.section as any, anchorKey: driver.anchorKey })}
                    className="text-xs text-[var(--teal)]"
                  >
                    view <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      <div className="p-3 bg-[var(--grid)]/30 rounded-lg">
        <p className="text-xs h-key leading-relaxed">
          Performance gaps and gains traced to specific room/phase combinations, market share, and asset quality. 
          Click "view" to see the detailed data that drives each delta.
        </p>
      </div>
    </div>
  );
}









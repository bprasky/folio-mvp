'use client';

import { ArrowRight } from 'lucide-react';

interface FunnelStage {
  label: string;
  count: number;
  revenueCents?: number;
}

interface AttributionFlowChartProps {
  stages: FunnelStage[];
  className?: string;
}

/**
 * Horizontal funnel showing attribution stages with conversion rates.
 * Tagged → Saved → Specified → Quoted → Ordered
 */
export function AttributionFlowChart({ stages, className }: AttributionFlowChartProps) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className={`space-y-2 ${className || ''}`}>
      {/* Stage bars */}
      <div className="flex items-end gap-1">
        {stages.map((stage, i) => {
          const prevCount = i > 0 ? stages[i - 1].count : stage.count;
          const conversionRate = prevCount > 0 ? (stage.count / prevCount) * 100 : 0;
          const barWidth = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 8) : 8;

          return (
            <div key={stage.label} className="flex items-center flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                {/* Count badge */}
                <div className="text-center mb-1">
                  <span className="text-lg font-semibold text-[#2C2825]">
                    {stage.count.toLocaleString()}
                  </span>
                  {stage.revenueCents != null && stage.revenueCents > 0 && (
                    <div className="text-xs text-[#8C8278]">
                      ${(stage.revenueCents / 100).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Bar */}
                <div className="w-full bg-[#F5F0EB] rounded-lg overflow-hidden" style={{ height: 40 }}>
                  <div
                    className="h-full rounded-lg transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      background: `linear-gradient(135deg, ${getStageColor(i, stages.length)})`,
                    }}
                  />
                </div>

                {/* Label */}
                <div className="text-center mt-1">
                  <span className="text-xs font-medium text-[#8C8278] uppercase tracking-wider">
                    {stage.label}
                  </span>
                </div>
              </div>

              {/* Arrow + conversion rate between stages */}
              {i < stages.length - 1 && (
                <div className="flex flex-col items-center px-1 shrink-0">
                  <span className="text-[10px] font-medium text-[#8C8278] mb-0.5">
                    {conversionRate > 0 ? `${conversionRate.toFixed(0)}%` : '—'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-[#DAD2CA]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStageColor(index: number, total: number): string {
  const colors = [
    '#DAD2CA, #C9B99A',  // warm beige (tagged)
    '#C9B99A, #B8A580',  // warm tan (saved)
    '#B8A580, #A89060',  // warm gold (specified)
    '#A89060, #c9a96e',  // gold (quoted)
    '#c9a96e, #b8965e',  // deep gold (ordered)
  ];
  return colors[Math.min(index, colors.length - 1)];
}

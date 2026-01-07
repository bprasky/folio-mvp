"use client";

import { Badge } from "@/components/ui/badge";
import type { OpportunityPoint } from "@/lib/mock/eventPost";
import { formatCurrency } from "@/lib/format";

interface OpportunityMiniProps {
  opportunities: OpportunityPoint[];
}

export function OpportunityMini({ opportunities }: OpportunityMiniProps) {
  const topOpportunities = opportunities.slice(0, 4);

  const getQuadrantColor = (quadrant: string) => {
    switch (quadrant) {
      case 'Most Underserved': return 'bg-[var(--rose)]/10 text-[var(--rose)] border-[var(--rose)]/20';
      case 'Build': return 'bg-[var(--emerald)]/10 text-[var(--emerald)] border-[var(--emerald)]/20';
      case 'Maintain': return 'bg-[var(--teal)]/10 text-[var(--teal)] border-[var(--teal)]/20';
      case 'Watch': return 'bg-[var(--slate)]/10 text-[var(--slate)] border-[var(--slate)]/20';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="chart-card p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[var(--ink)] mb-1">
          Where the money is hiding
        </h3>
        <p className="text-xs h-sub">Potential vs Share analysis</p>
      </div>

      <div className="space-y-2">
        {topOpportunities.map((opp, index) => (
          <div
            key={index}
            className="p-3 bg-[var(--grid)]/20 hover:bg-[var(--grid)]/40 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-[var(--teal)]"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-[var(--ink)]">
                {opp.name}
              </span>
              <Badge className={`text-xs ${getQuadrantColor(opp.quadrant)}`}>
                {opp.sharePct.toFixed(0)}%
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--slate)]">{opp.quadrant}</span>
              <span className="h-num text-[var(--ink)] font-medium">
                {formatCurrency(opp.potentialUsd, 'USD', true)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs h-key">
        Click any item to filter insights & actions
      </div>
    </div>
  );
}









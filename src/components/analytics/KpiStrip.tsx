"use client";

import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/format";
import type { Outcome } from "@/lib/mock/eventPost";

interface KpiStripProps {
  outcome: Outcome;
}

export function KpiStrip({ outcome }: KpiStripProps) {
  const savesPerDesigner = outcome.attendedDesigners > 0 
    ? (outcome.productsSaved / outcome.attendedDesigners).toFixed(1)
    : "0";
  
  const saveToTagRate = outcome.productsSaved > 0
    ? ((outcome.tags / outcome.productsSaved) * 100).toFixed(1)
    : "0";

  const kpis = [
    {
      label: "Pipeline Value",
      value: formatCurrency(outcome.estPipelineUsd, 'USD', true),
      delta: outcome.deltas.vsPriorPct,
      format: "currency"
    },
    {
      label: "Designers",
      value: outcome.attendedDesigners.toString(),
      delta: outcome.deltas.vsPriorPct,
      format: "number"
    },
    {
      label: "Saves/Designer",
      value: savesPerDesigner,
      delta: outcome.deltas.vsPriorPct,
      format: "number"
    },
    {
      label: "Save→Tag Rate",
      value: `${saveToTagRate}%`,
      delta: outcome.deltas.vsPortfolioPct,
      format: "percent"
    }
  ];

  return (
    <Card className="chart-card p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => (
          <div key={index} className="text-center">
            <div className="text-xs h-sub mb-2">{kpi.label}</div>
            <div className="text-2xl font-semibold h-kpi h-num mb-1">
              {kpi.value}
            </div>
            <div className="flex items-center justify-center gap-1">
              {kpi.delta > 0 ? (
                <TrendingUp className="w-3 h-3 text-[var(--emerald)]" />
              ) : kpi.delta < 0 ? (
                <TrendingDown className="w-3 h-3 text-[var(--rose)]" />
              ) : null}
              <span className={`text-xs font-medium ${
                kpi.delta > 0 ? 'text-[var(--emerald)]' : 
                kpi.delta < 0 ? 'text-[var(--rose)]' : 
                'text-[var(--slate)]'
              }`}>
                {kpi.delta > 0 ? '+' : ''}{kpi.delta}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}









'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building, Heart, FolderOpen, Tag, DollarSign } from "lucide-react";
import type { Outcome } from "@/lib/mock/eventPost";
import { formatCurrency, formatCompactNumber, formatPercentage } from "@/lib/format";

interface OutcomeSnapshotProps {
  outcome: Outcome;
}

export function OutcomeSnapshot({ outcome }: OutcomeSnapshotProps) {
  const getDeltaColor = (delta: number) => {
    if (delta > 0) return 'text-green-600 bg-green-50';
    if (delta < 0) return 'text-red-600 bg-red-50';
    return 'text-folio-text-secondary bg-surface-ground';
  };

  const getDeltaIcon = (delta: number) => {
    if (delta > 0) return '↗';
    if (delta < 0) return '↘';
    return '→';
  };
  const kpiItems = [
    {
      label: "Attended Designers",
      value: outcome.attendedDesigners,
      delta: outcome.deltas.vsPriorPct,
      icon: Users,
      formatter: formatCompactNumber
    },
    {
      label: "Unique Firms",
      value: outcome.uniqueFirms,
      delta: outcome.deltas.vsPriorPct * 0.8, // Slightly different delta for variety
      icon: Building,
      formatter: formatCompactNumber
    },
    {
      label: "Products Saved",
      value: outcome.productsSaved,
      delta: outcome.deltas.vsPriorPct,
      icon: Heart,
      formatter: formatCompactNumber
    },
    {
      label: "Boards Created",
      value: outcome.boards,
      delta: outcome.deltas.vsPriorPct * 1.2,
      icon: FolderOpen,
      formatter: formatCompactNumber
    },
    {
      label: "Tags Added",
      value: outcome.tags,
      delta: outcome.deltas.vsPortfolioPct,
      icon: Tag,
      formatter: formatCompactNumber
    },
    {
      label: "Est. Pipeline Value",
      value: outcome.estPipelineUsd,
      delta: outcome.deltas.vsPriorPct,
      icon: DollarSign,
      formatter: (value: number) => formatCurrency(value, 'USD', true)
    }
  ];

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <Card className="bg-surface-canvas border-folio-border-strong">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
            {kpiItems.map((item, index) => (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center w-10 h-10 bg-[#8C8278]/10 rounded-full mb-3 mx-auto">
                  <item.icon className="w-5 h-5 text-folio-text-secondary" />
                </div>
                <p className="text-sm text-folio-text-secondary mb-2">{item.label}</p>
                <p className="text-lg font-semibold text-folio-text-primary mb-2">
                  {item.formatter(item.value)}
                </p>
                <div className="flex items-center justify-center space-x-1">
                  <div className={`text-xs px-2 py-1 rounded ${getDeltaColor(item.delta)}`}>
                    {getDeltaIcon(item.delta)} {Math.abs(item.delta).toFixed(0)}% vs prior
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${getDeltaColor(item.delta * 0.7)}`}>
                    {getDeltaIcon(item.delta * 0.7)} {Math.abs(item.delta * 0.7).toFixed(0)}% vs portfolio
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Headline Insight */}
      <div className="bg-surface-elevated border-l-4 border-[#8C8278] pl-6 py-4">
        <p className="text-folio-text-primary font-medium">{outcome.headline}</p>
      </div>
    </div>
  );
}

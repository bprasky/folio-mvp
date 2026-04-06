'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Info } from "lucide-react";
import type { Outcome } from "@/lib/mock/eventPost";
import { formatCurrency } from "@/lib/format";

interface ExecutiveSummaryProps {
  outcome: Outcome;
}

export function ExecutiveSummary({ outcome }: ExecutiveSummaryProps) {
  // Determine overall performance
  const isPositive = outcome.deltas.vsPriorPct > 0 && outcome.deltas.vsPortfolioPct > 0;
  const isMixed = (outcome.deltas.vsPriorPct > 0) !== (outcome.deltas.vsPortfolioPct > 0);
  
  const getStatus = () => {
    if (isPositive) return { label: 'Good', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle };
    if (isMixed) return { label: 'Mixed', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertCircle };
    return { label: 'Needs Focus', color: 'bg-red-100 text-red-800 border-red-200', icon: TrendingDown };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <Card className="bg-white border-folio-border-strong">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <StatusIcon className="w-6 h-6 text-folio-text-secondary" />
            <div>
              <h2 className="text-xl font-serif text-folio-text-primary mb-1">
                Executive Summary
              </h2>
              <div className="flex items-center space-x-2">
                <Badge className={status.color}>
                  {status.label}
                </Badge>
                <span className="text-sm text-folio-text-secondary">
                  vs prior event • vs portfolio
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-6">
          <p className="text-lg text-folio-text-primary font-medium leading-relaxed mb-3">
            {outcome.headline}
          </p>
          <div className="flex items-start space-x-2 p-3 bg-surface-elevated rounded-lg border-l-4 border-[#8C8278]">
            <Info className="w-4 h-4 text-folio-text-secondary mt-0.5 flex-shrink-0" />
            <div className="text-sm text-folio-text-secondary leading-relaxed">
              <p className="font-medium mb-1">What this means:</p>
              <p>
                {isPositive 
                  ? "Your event exceeded both historical and industry benchmarks. This indicates strong market positioning and effective engagement strategies."
                  : isMixed 
                  ? "Mixed results suggest targeted optimization opportunities. Review top-performing segments while addressing conversion gaps in underperforming areas."
                  : "Performance below targets indicates immediate action needed. Focus on engagement improvements and conversion optimization to recover profitability."
                }
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-sm text-folio-text-secondary mb-1">Pipeline Value</div>
            <div className="text-xl font-semibold text-folio-text-primary">
              {formatCurrency(outcome.estPipelineUsd, 'USD', true)}
            </div>
            <div className="flex items-center justify-center space-x-1 mt-1">
              {outcome.deltas.vsPriorPct > 0 ? (
                <TrendingUp className="w-3 h-3 text-green-600" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-600" />
              )}
              <span className={`text-xs ${outcome.deltas.vsPriorPct > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(outcome.deltas.vsPriorPct).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-folio-text-secondary mb-1">Designers</div>
            <div className="text-xl font-semibold text-folio-text-primary">
              {outcome.attendedDesigners}
            </div>
            <div className="text-xs text-folio-text-secondary mt-1">
              {outcome.uniqueFirms} firms
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-folio-text-secondary mb-1">Engagement</div>
            <div className="text-xl font-semibold text-folio-text-primary">
              {Math.round((outcome.productsSaved / outcome.attendedDesigners) * 10) / 10}
            </div>
            <div className="text-xs text-folio-text-secondary mt-1">
              saves per designer
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-folio-text-secondary mb-1">Conversion</div>
            <div className="text-xl font-semibold text-folio-text-primary">
              {Math.round((outcome.tags / outcome.productsSaved) * 100)}%
            </div>
            <div className="text-xs text-folio-text-secondary mt-1">
              save → tag rate
            </div>
          </div>
        </div>

        {/* Quick insight */}
        <div className="mt-4 p-3 bg-surface-elevated rounded-lg border-l-4 border-[#8C8278]">
          <p className="text-sm text-folio-text-primary">
            {isPositive 
              ? "Event exceeded expectations. Focus on scaling successful tactics and expanding to new markets."
              : isMixed 
              ? "Mixed results suggest opportunity for optimization. Review top-performing segments and address conversion gaps."
              : "Performance below targets. Immediate action needed on engagement and conversion improvements."
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

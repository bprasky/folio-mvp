"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataReceipt } from "./DataReceipt";
import { useAnalyticsDrawer } from "./useAnalyticsDrawer";
import type { AiInsight } from "@/lib/ai/types";
import { cn } from "@/lib/utils";
import { Info, TrendingUp, Clock, AlertTriangle } from "lucide-react";

export function InsightCard({ insight }: { insight: AiInsight }) {
  const { openDrawer } = useAnalyticsDrawer();
  const { impact, guardrails } = insight;
  const [showExplanation, setShowExplanation] = useState(false);

  const confidenceTone = {
    High: "bg-emerald-100 text-emerald-900 border-emerald-200",
    Medium: "bg-amber-100 text-amber-900 border-amber-200",
    Test: "bg-slate-100 text-slate-900 border-slate-200"
  }[impact.confidence];

  const getExplanation = () => {
    const actionType = insight.action.type;
    switch (actionType) {
      case 'promo':
        return "Discount promotions work best when market demand is high and competitors haven't yet responded. This timing maximizes conversion while maintaining margin.";
      case 'specPack':
        return "Specification packages help designers move from consideration to specification phase by providing technical details needed for project documentation.";
      case 'sampleKit':
        return "Sample kits reduce friction in the specification process by providing physical materials designers can evaluate for texture, finish, and quality.";
      case 'invite':
        return "Targeted invitations to look-alike designers leverage social proof and expand reach into similar market segments with proven conversion patterns.";
      case 'scheduleReview':
        return "Account review meetings align your sales process with the designer's project timeline, ensuring you're present at key decision points.";
      case 'localizeAssets':
        return "Localized assets address regional preferences and regulations, increasing relevance and compliance in specific geographic markets.";
      default:
        return "This action leverages current market signals to drive specific business outcomes.";
    }
  };

  const getUrgencyIcon = () => {
    if (impact.decayPctByDay > 20) return <AlertTriangle className="w-3 h-3 text-red-500" />;
    if (impact.decayPctByDay > 15) return <Clock className="w-3 h-3 text-amber-500" />;
    return <TrendingUp className="w-3 h-3 text-green-500" />;
  };

  return (
    <Card className="p-5 bg-white border-folio-border-strong hover:shadow-md transition-all duration-200 hover:border-[#8C8278]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div className="text-[16px] font-semibold text-folio-text-primary leading-tight">{insight.title}</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-folio-text-secondary hover:text-folio-text-primary p-1 h-auto"
            >
              <Info className="w-4 h-4" />
            </Button>
          </div>
          
          <p className="text-sm text-folio-text-secondary leading-relaxed mb-3">{insight.body}</p>
          
          {/* Dynamic explanation */}
          {showExplanation && (
            <div className="mb-3 p-3 bg-surface-elevated rounded-lg border-l-3 border-[#8C8278]">
              <div className="text-xs font-medium text-folio-text-secondary mb-1">Why this works:</div>
              <p className="text-sm text-folio-text-secondary leading-relaxed">{getExplanation()}</p>
            </div>
          )}

          {/* Receipts */}
          <DataReceipt
            items={insight.receipts}
            onOpen={(r) => r.section && openDrawer({ section: r.section, anchorKey: r.anchorKey })}
          />
          
          {/* Guardrails */}
          {guardrails && (guardrails.inventory === 'tight' || guardrails.margin === 'low') && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              ⚠️ Strategy adjusted for {guardrails.inventory === 'tight' ? "inventory constraints" : "margin protection"}
            </div>
          )}
        </div>

        {/* Impact block */}
        <div className="shrink-0 text-right">
          <div className="text-xs text-folio-text-secondary mb-1">Expected lift</div>
          <div className="text-xl font-bold text-folio-text-primary mb-2">${(impact.expectedLiftUsd/1000).toFixed(0)}k</div>
          
          <div className="space-y-2 mb-3">
            <Badge className={cn("text-[11px] px-2 py-1 border", confidenceTone)}>
              {impact.confidence} confidence
            </Badge>
            <div className="flex items-center justify-end gap-1 text-[11px] text-folio-text-secondary">
              {getUrgencyIcon()}
              <span>Urgency: -{impact.decayPctByDay}%/day</span>
            </div>
          </div>
          
          <Button 
            size="sm" 
            className="bg-[#2B2B2B] hover:bg-[#8C8278] text-white text-xs px-3 py-2"
          >
            {insight.action.label}
          </Button>
        </div>
      </div>
    </Card>
  );
}
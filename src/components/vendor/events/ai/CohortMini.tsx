"use client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function CohortMini({ data }: {
  data: { 
    saveToTag: { you: number; prev3: number; cohort: number };
    value: { you: number; prev3: number; cohort: number };
    tagToSpec?: { you: number; prev3: number; cohort: number };
  }
}) {
  const Row = ({ label, v, description }: { 
    label: string; 
    v: { you: number; prev3: number; cohort: number };
    description: string;
  }) => {
    const getTrendIcon = (you: number, benchmark: number) => {
      if (you > benchmark + 5) return <TrendingUp className="w-3 h-3 text-green-600" />;
      if (you < benchmark - 5) return <TrendingDown className="w-3 h-3 text-red-600" />;
      return <Minus className="w-3 h-3 text-folio-text-tertiary" />;
    };

    const getStatus = (you: number, prev3: number, cohort: number) => {
      if (you > Math.max(prev3, cohort) + 5) return "bg-green-100 text-green-800";
      if (you < Math.min(prev3, cohort) - 5) return "bg-red-100 text-red-800";
      return "bg-surface-ground text-folio-text-primary";
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-medium text-folio-text-primary">{label}</div>
          <div className="flex items-center gap-1">
            {getTrendIcon(v.you, Math.max(v.prev3, v.cohort))}
            <Badge className={`text-[10px] px-2 py-0.5 ${getStatus(v.you, v.prev3, v.cohort)}`}>
              {v.you > Math.max(v.prev3, v.cohort) ? "Leading" : v.you < Math.min(v.prev3, v.cohort) ? "Behind" : "Average"}
            </Badge>
          </div>
        </div>
        <div className="text-[11px] text-folio-text-secondary mb-2">{description}</div>
        <div className="grid grid-cols-3 gap-2 text-[12px]">
          <div className="text-center p-2 bg-surface-elevated rounded">
            <div className="font-semibold text-folio-text-primary">{v.you}%</div>
            <div className="text-folio-text-secondary">You</div>
          </div>
          <div className="text-center p-2 bg-surface-elevated rounded">
            <div className="font-semibold text-folio-text-primary">{v.prev3}%</div>
            <div className="text-folio-text-secondary">Prev 3</div>
          </div>
          <div className="text-center p-2 bg-surface-elevated rounded">
            <div className="font-semibold text-folio-text-primary">{v.cohort}%</div>
            <div className="text-folio-text-secondary">Cohort</div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <Card className="p-4 bg-white border-folio-border-strong">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-folio-text-primary">Performance Benchmarks</div>
        <div className="text-xs text-folio-text-secondary">vs. your history & industry peers</div>
      </div>
      <div className="space-y-4">
        <Row 
          label="Save → Tag Conversion" 
          v={data.saveToTag}
          description="Percentage of saved products that designers tag for active projects"
        />
        {data.tagToSpec && (
          <Row 
            label="Tag → Spec Completion" 
            v={data.tagToSpec}
            description="How often tagged products progress to final specifications"
          />
        )}
        <Row 
          label="Value Index Score" 
          v={data.value}
          description="Overall performance weighted by deal size and conversion rates"
        />
      </div>
    </Card>
  );
}

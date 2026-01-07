"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, AlertCircle } from "lucide-react";
import type { SankeyNode, SankeyLink } from "@/lib/mock/eventPost";

interface InfluenceFlowProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export function InfluenceFlow({ nodes, links }: InfluenceFlowProps) {
  // Calculate total flow and percentages
  const totalFlow = nodes.find(n => n.id === 'event')?.value || 1000;
  
  // Create flow visualization using horizontal bars
  const flowStages = useMemo(() => {
    return nodes.filter(n => n.id !== 'event').map(node => {
      const percentage = (node.value / totalFlow) * 100;
      const incomingLink = links.find(l => l.target === node.id);
      const leak = incomingLink?.leakNote;
      
      return {
        id: node.id,
        label: node.label,
        value: node.value,
        percentage,
        leak,
        fix: incomingLink?.fix,
        expectedLiftPct: incomingLink?.expectedLiftPct
      };
    });
  }, [nodes, links, totalFlow]);

  return (
    <div className="col-span-7 space-y-4">
      {flowStages.map((stage, index) => {
        const prevStage = index > 0 ? flowStages[index - 1] : null;
        const conversionRate = prevStage ? (stage.value / prevStage.value) * 100 : 100;
        const isLeak = conversionRate < 60;

        return (
          <div key={stage.id} className="space-y-2">
            {/* Stage header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--ink)]">
                  {stage.label}
                </span>
                {index > 0 && (
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${isLeak ? 'bg-[var(--rose)]/10 text-[var(--rose)]' : 'bg-[var(--emerald)]/10 text-[var(--emerald)]'}`}
                  >
                    {conversionRate.toFixed(0)}% conversion
                  </Badge>
                )}
              </div>
              <span className="text-sm font-semibold h-num text-[var(--ink)]">
                {stage.value.toLocaleString()}
              </span>
            </div>

            {/* Progress bar */}
            <div className="relative h-12 bg-[var(--grid)] rounded-lg overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--teal)] to-[var(--teal)]/80 transition-all duration-500"
                style={{ width: `${stage.percentage}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-between px-4">
                <span className="text-xs font-medium text-white mix-blend-difference">
                  {stage.percentage.toFixed(1)}% of total
                </span>
              </div>
            </div>

            {/* Leak note */}
            {stage.leak && (
              <div className="flex items-start gap-2 p-3 bg-[var(--amber)]/5 border-l-2 border-[var(--amber)] rounded-r-lg">
                <AlertCircle className="w-4 h-4 text-[var(--amber)] mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-[var(--ink)] mb-2">{stage.leak}</p>
                  {stage.fix && stage.expectedLiftPct && (
                    <div className="flex items-center gap-2">
                      <Badge className="text-xs bg-[var(--emerald)]/10 text-[var(--emerald)] border-[var(--emerald)]/20">
                        Fix: {stage.fix}
                      </Badge>
                      <span className="text-xs text-[var(--slate)]">
                        Expected lift: +{stage.expectedLiftPct}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Arrow to next stage */}
            {index < flowStages.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowRight className="w-5 h-5 text-[var(--slate)]" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}









"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, AlertCircle, TrendingDown } from "lucide-react";
import type { SankeyNode, SankeyLink } from "@/lib/mock/eventPost";
import { FLOW_BASELINES, computeFlowBenchmark } from "@/lib/benchmarks/flow";

interface InfluenceFlowFullProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export function InfluenceFlowFull({ nodes, links }: InfluenceFlowFullProps) {
  const totalFlow = nodes.find(n => n.id === 'event')?.value || 1000;
  
  const flowStages = useMemo(() => {
    const stages = nodes.filter(n => n.id !== 'event').map((node, index) => {
      const percentage = (node.value / totalFlow) * 100;
      const incomingLink = links.find(l => l.target === node.id);
      const prevNode = index > 0 ? nodes[index] : nodes.find(n => n.id === 'event');
      
      // Compute benchmark
      let benchmark = null;
      if (prevNode) {
        const baselineKey = `${prevNode.id}_to_${node.id}` as keyof typeof FLOW_BASELINES;
        const baselineRate = FLOW_BASELINES[baselineKey] || 0.5;
        benchmark = computeFlowBenchmark(node.value, prevNode.value, baselineRate);
      }
      
      return {
        id: node.id,
        label: node.label,
        value: node.value,
        percentage,
        leak: incomingLink?.leakNote,
        fix: incomingLink?.fix,
        expectedLiftPct: incomingLink?.expectedLiftPct,
        benchmark
      };
    });
    
    return stages;
  }, [nodes, links, totalFlow]);

  return (
    <div className="space-y-6">
      {flowStages.map((stage, index) => {
        const prevStage = index > 0 ? flowStages[index - 1] : null;
        const conversionRate = prevStage ? (stage.value / prevStage.value) * 100 : 100;
        const isLeak = stage.benchmark && stage.benchmark.delta < 0;

        return (
          <div key={stage.id} className="space-y-2">
            {/* Stage header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--ink)]">
                  {stage.label}
                </span>
                {index > 0 && (
                  <>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs num ${isLeak ? 'bg-[var(--rose)]/10 text-[var(--rose)]' : 'bg-[var(--emerald)]/10 text-[var(--emerald)]'}`}
                    >
                      {conversionRate.toFixed(0)}% conversion
                    </Badge>
                    {stage.benchmark && (
                      <span className="text-xs text-[var(--slate)]">
                        (cohort {(stage.benchmark.baseline * 100).toFixed(0)}%)
                      </span>
                    )}
                  </>
                )}
              </div>
              <span className="text-sm font-semibold h-num text-[var(--ink)]">
                {stage.value.toLocaleString()}
              </span>
            </div>

            {/* Progress bar with gap shading */}
            <div className="relative h-14 bg-[var(--grid)] rounded-lg overflow-hidden">
              {/* Baseline expectation (faint background) */}
              {stage.benchmark && stage.benchmark.baseline > 0 && prevStage && (
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--slate)]/10 border-r-2 border-dashed border-[var(--slate)]/30"
                  style={{ width: `${(prevStage.value * stage.benchmark.baseline / totalFlow) * 100}%` }}
                />
              )}
              
              {/* Actual flow */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                  isLeak ? 'bg-gradient-to-r from-[var(--rose)]/80 to-[var(--rose)]/60' : 'bg-gradient-to-r from-[var(--teal)] to-[var(--teal)]/80'
                }`}
                style={{ width: `${stage.percentage}%` }}
              />
              
              {/* Gap shading (if below baseline) */}
              {isLeak && stage.benchmark && prevStage && (
                <div
                  className="absolute inset-y-0 bg-[var(--rose)]/20 border-l-2 border-dashed border-[var(--rose)]/40"
                  style={{
                    left: `${stage.percentage}%`,
                    width: `${Math.max(0, (prevStage.value * stage.benchmark.baseline / totalFlow * 100) - stage.percentage)}%`
                  }}
                  title="Expected leakage vs cohort"
                />
              )}
              
              <div className="absolute inset-0 flex items-center justify-between px-4">
                <span className="text-xs font-medium text-white mix-blend-difference">
                  {stage.percentage.toFixed(1)}% of total
                </span>
                {stage.benchmark && (
                  <span className={`text-xs font-medium ${isLeak ? 'text-[var(--rose)]' : 'text-[var(--emerald)]'} mix-blend-normal`}>
                    {stage.benchmark.deltaLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Benchmark note */}
            {isLeak && stage.benchmark && (
              <div className="flex items-start gap-2 p-3 bg-[var(--amber)]/5 border-l-2 border-[var(--amber)] rounded-r-lg text-xs">
                <TrendingDown className="w-4 h-4 text-[var(--amber)] mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[var(--ink)] mb-1">
                    {stage.label} {(conversionRate).toFixed(0)}% (cohort {(stage.benchmark.baseline * 100).toFixed(0)}%). 
                    Shaded gap shows {stage.benchmark.deltaLabel}.
                  </p>
                  {stage.fix && stage.expectedLiftPct && (
                    <div className="flex items-center gap-2">
                      <Badge className="text-xs bg-[var(--emerald)]/10 text-[var(--emerald)] border-[var(--emerald)]/20">
                        Fix: {stage.fix}
                      </Badge>
                      <span className="text-[var(--slate)]">
                        historically adds +{stage.expectedLiftPct.toFixed(0)} pts
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Leak note */}
            {stage.leak && !isLeak && (
              <div className="flex items-start gap-2 p-3 bg-[var(--amber)]/5 border-l-2 border-[var(--amber)] rounded-r-lg">
                <AlertCircle className="w-4 h-4 text-[var(--amber)] mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-[var(--ink)]">{stage.leak}</p>
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
      
      {/* Summary note */}
      <div className="p-4 bg-[var(--grid)]/30 rounded-lg">
        <p className="text-xs h-key leading-relaxed">
          Typical leakage points shown with shaded gaps. Baseline rates from vendor cohort median. 
          Historical fixes show estimated lift from similar interventions.
        </p>
      </div>
    </div>
  );
}









"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Step = "Saves"|"Boards"|"Tags"|"Value";
type Transition = "Saves→Boards"|"Boards→Tags"|"Tags→Value";
type FlowData = {
  steps: Record<Step, number>; // absolute counts
  conv: { // 0..1
    savesBoards: number;
    boardsTags: number;
    tagsValue: number;
  };
  cohort: {
    savesBoards: number;
    boardsTags: number;
    tagsValue: number;
  };
  fixes: {
    savesBoards?: { label: string; estLiftPts: number };
    boardsTags?: { label: string; estLiftPts: number };
    tagsValue?: { label: string; estLiftPts: number };
  };
};

function pct(v: number) { return `${Math.round((v ?? 0) * 100)}%`; }
function pts(v: number) { 
  const p = Math.round(v * 100); 
  return (p >= 0 ? `+${p}` : String(p)) + " pts"; 
}

export function CompactFunnel({ data, onFix }: {
  data: FlowData;
  onFix?: (t: Transition) => void;
}) {
  const rows = [
    { key: "savesBoards",  from: "Saves",  to: "Boards",  label: "Saves→Boards" as const },
    { key: "boardsTags",   from: "Boards", to: "Tags",    label: "Boards→Tags" as const },
    { key: "tagsValue",    from: "Tags",   to: "Value",   label: "Tags→Value" as const },
  ];
  
  const getFix = (k: keyof FlowData["fixes"]) => data.fixes[k];

  return (
    <TooltipProvider>
      <div className="chart-card p-4">
        <div className="mb-2 font-semibold text-[#1F2937]">Compact Funnel</div>
        <div className="h-key mb-3">Conversion by step (Actual • Cohort • Δ). Click a fix to queue an action.</div>

        <div className="grid grid-cols-[140px_1fr_1fr_1fr_120px] gap-y-2 items-center">
          <div className="h-key"></div>
          <div className="h-key text-right pr-2">Actual</div>
          <div className="h-key text-right pr-2">Cohort</div>
          <div className="h-key text-right pr-2">Δ</div>
          <div className="h-key">Fix</div>

          {rows.map(r => {
            const actual  = (data.conv as any)[r.key] as number;
            const cohort  = (data.cohort as any)[r.key] as number;
            const delta   = (actual - cohort);
            const fixKey  = r.key as keyof FlowData["fixes"];
            const fix     = getFix(fixKey);
            const danger  = delta < 0;

            return (
              <div key={r.key} className="contents">
                <div className="text-sm text-[#1F2937] font-medium">{r.label}</div>

                {/* Actual */}
                <div className="text-right">
                  <span className="num font-semibold text-[#111827]">{pct(actual)}</span>
                </div>

                {/* Cohort */}
                <div className="text-right text-[#6B7280]">
                  <span className="num">{pct(cohort)}</span>
                </div>

                {/* Δ pts with colored badge */}
                <div className="text-right">
                  <span className={cn(
                    "num px-2 py-0.5 rounded text-xs font-medium",
                    danger ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                  )}>
                    {pts(delta)}
                  </span>
                </div>

                {/* Fix button */}
                <div>
                  {fix ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs border-[var(--amber)] text-[var(--amber)] hover:bg-[var(--amber)] hover:text-white"
                          onClick={() => onFix?.(r.label as Transition)}
                        >
                          {fix.label}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          Adds approx. +{fix.estLiftPts} pts based on past events.
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-xs text-[#9CA3AF]">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stage totals row */}
        <div className="mt-4 pt-3 border-t border-[var(--grid)] flex items-center justify-between">
          <div className="h-key">Stage totals</div>
          <div className="num text-sm text-[#1F2937] space-x-4">
            <span>Saves <strong>{data.steps.Saves.toLocaleString()}</strong></span>
            <span>•</span>
            <span>Boards <strong>{data.steps.Boards.toLocaleString()}</strong></span>
            <span>•</span>
            <span>Tags <strong>{data.steps.Tags.toLocaleString()}</strong></span>
            <span>•</span>
            <span>Value <strong>{data.steps.Value.toLocaleString()}</strong></span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}









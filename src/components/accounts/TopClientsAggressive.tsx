"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { getCausalPlays, type CausalPlay } from "@/lib/impact/causality";

interface Firm {
  firm: string;
  valueUsd: number;
  projects: number;
  contacts: string[];
  isNew?: boolean;
  reactivated?: boolean;
}

interface TopClientsAggressiveProps {
  firms: Firm[];
}

export function TopClientsAggressive({ firms }: TopClientsAggressiveProps) {
  return (
    <div className="col-span-7 space-y-3">
      {firms.slice(0, 5).map((firm, index) => {
        const intentScore = firm.valueUsd > 2000000 ? 85 : firm.valueUsd > 1000000 ? 72 : 60;
        const plays = getCausalPlays(firm.valueUsd, intentScore);
        const bestWindow = index % 2 === 0 ? 'Tue 14:00' : 'Wed 10:00';

        return (
          <div
            key={firm.firm}
            className="p-4 border border-[var(--grid)] rounded-lg hover:border-[var(--teal)] hover:shadow-md transition-all bg-white"
          >
            {/* Firm header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-semibold text-[var(--ink)]">
                    {firm.firm}
                  </span>
                  {firm.isNew && (
                    <Badge className="bg-[var(--emerald)]/10 text-[var(--emerald)] text-xs">
                      New
                    </Badge>
                  )}
                  {firm.reactivated && (
                    <Badge className="bg-[var(--amber)]/10 text-[var(--amber)] text-xs">
                      Reactivated
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-[var(--slate)]">
                  <span className="h-num">{formatCurrency(firm.valueUsd, 'USD', true)} potential</span>
                  <span>•</span>
                  <span className="h-num">{firm.projects} projects</span>
                  <span>•</span>
                  <span>Best: {bestWindow}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--slate)]">Intent Score</div>
                <div className="text-xl font-bold h-kpi h-num text-[var(--ink)]">
                  {intentScore}
                </div>
              </div>
            </div>

            {/* Aggressive Plays */}
            <div>
              <div className="text-xs font-semibold text-[var(--slate)] uppercase tracking-wide mb-2">
                Aggressive Plays
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {plays.slice(0, 3).map((play, playIndex) => (
                  <button
                    key={playIndex}
                    className="group text-left p-3 bg-[var(--grid)]/20 hover:bg-[var(--ink)] rounded-lg border border-[var(--grid)] hover:border-[var(--ink)] transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--ink)] group-hover:text-white">
                        {play.label}
                      </span>
                      <Sparkles className="w-3 h-3 text-[var(--amber)] group-hover:text-white" />
                    </div>
                    <div className="text-xs text-[var(--slate)] group-hover:text-white/80 mb-2 leading-relaxed">
                      {play.why}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <TrendingUp className="w-3 h-3 text-[var(--emerald)] group-hover:text-white" />
                      <span className="text-[var(--emerald)] group-hover:text-white font-medium">
                        +{play.expectedLiftPts} pts
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Footer note */}
      <div className="p-3 bg-[var(--grid)]/30 rounded-lg">
        <p className="text-xs h-key leading-relaxed">
          Historical lift data from similar vendor plays. VIP dinners and collabs show highest ROI for firms &gt;$1M potential.
        </p>
      </div>
    </div>
  );
}









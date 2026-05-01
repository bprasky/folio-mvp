"use client";

import { Fragment } from "react";
import type { RoomPhaseCell } from "@/lib/mock/eventPost";

interface RoomPhaseHeatmapProps {
  data: RoomPhaseCell[];
  onHover?: (cell: RoomPhaseCell | null) => void;
}

const ROOMS = ["Kitchen", "Bath", "Living", "Bedroom", "Outdoor", "Other"];
const PHASES = ["Concept", "Schematic", "FF&E", "Procurement"];
const COHORT_BASELINE = 45; // cohort median save→tag %

type Cell = {
  room: string;
  phase: string;
  saves?: number | null;
  tags?: number | null;
  ratePct?: number | null;   // 0–100 if provided, else compute
  deltaPts?: number | null;  // vs cohort (can be 0)
  assetGap?: 'renders' | 'specs' | 'samples' | 'images' | null;
};

function safeInt(n: any, fallback = 0): number {
  return Number.isFinite(n) ? (n as number) : fallback;
}

function computeRate(saves: number, tags: number): number {
  if (saves <= 0) return 0;
  const r = Math.round((tags / saves) * 100);
  return Number.isFinite(r) ? r : 0;
}

function CellBox({ c }: { c: Cell }) {
  const saves = safeInt(c.saves);
  const tags = safeInt(c.tags);
  const rate = c.ratePct != null ? safeInt(c.ratePct) : computeRate(saves, tags);
  const delta = safeInt(c.deltaPts, rate - COHORT_BASELINE);

  const getHeatColor = (rate: number) => {
    if (rate >= 70) return 'border-[var(--emerald)] bg-[var(--emerald)]/10';
    if (rate >= 50) return 'border-[var(--teal)] bg-[var(--teal)]/10';
    if (rate >= 30) return 'border-[var(--amber)] bg-[var(--amber)]/10';
    if (rate > 0) return 'border-[var(--rose)] bg-[var(--rose)]/10';
    return 'border-[var(--grid)] bg-[var(--grid)]/20';
  };

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center
        h-20 rounded-lg border-2
        bg-white
        px-2 text-center
        transition-all duration-200
        hover:scale-105 hover:shadow-md
        ${getHeatColor(rate)}
      `}
      title={[
        `${c.room} · ${c.phase}`,
        `${saves} saves → ${tags} tags`,
        `Rate ${rate}% (${delta >= 0 ? '+' : ''}${delta} pts vs cohort)`,
        c.assetGap ? `Asset gap: ${c.assetGap}` : ''
      ].filter(Boolean).join('\n')}
    >
      {/* % value — NEVER hide 0 */}
      <div className="num text-[var(--type-h4)] font-bold text-[#111827]">
        {rate}%
      </div>

      {/* Subline: saves → tags (always visible; no opacity toggles) */}
      <div className="mt-1 text-[var(--type-eyebrow)] text-[#6B7280] whitespace-nowrap">
        {saves} → {tags}
      </div>

      {/* Asset gap chip (optional) */}
      {c.assetGap && (
        <div className="absolute top-1 right-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[var(--type-fine)] text-[#92400E] font-medium">
          {c.assetGap}
        </div>
      )}
    </div>
  );
}

function getAssetGapIcon(gap?: string) {
  switch (gap) {
    case 'renders': return '🎨';
    case 'specs': return '📋';
    case 'samples': return '📦';
    case 'images': return '🖼️';
    default: return null;
  }
}

export function RoomPhaseHeatmap({ data, onHover }: RoomPhaseHeatmapProps) {
  return (
    <div className="col-span-7">
      <div className="chart-card p-5">
        <div className="mb-2 font-semibold text-[var(--ink)]">Room × Phase Heatmap</div>
        <div className="h-key mb-4">Conversion patterns across design workflows</div>

        {/* Heatmap grid */}
        <div className="grid grid-cols-[120px_repeat(4,minmax(0,1fr))] gap-3">
          {/* Header row */}
          <div />
          {PHASES.map(p => (
            <div key={p} className="text-center h-key font-medium text-[var(--ink)] pb-2">
              {p}
            </div>
          ))}

          {/* Data rows */}
          {ROOMS.map(r => (
            <Fragment key={r}>
              <div className="h-key flex items-center font-medium text-[var(--ink)]">{r}</div>
              {PHASES.map(p => {
                const cellData = data.find(x => x.room === r && x.phase === p);
                const c: Cell = cellData 
                  ? {
                      room: r,
                      phase: p,
                      saves: cellData.saves,
                      tags: cellData.tags,
                      ratePct: cellData.saveToTagRatePct,
                      deltaPts: cellData.saveToTagRatePct - COHORT_BASELINE,
                      assetGap: cellData.assetGap as any
                    }
                  : {
                      room: r,
                      phase: p,
                      saves: 0,
                      tags: 0,
                      ratePct: 0,
                      deltaPts: -COHORT_BASELINE,
                      assetGap: null
                    };
                return <CellBox key={`${r}-${p}`} c={c} />;
              })}
            </Fragment>
          ))}
        </div>

        {/* Footer Legend */}
        <div className="mt-6 p-4 bg-[var(--grid)]/30 rounded-lg space-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-xs h-key font-medium">Conversion Rate:</span>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded bg-[var(--emerald)]/80" />
              <span>≥70%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded bg-[var(--teal)]/60" />
              <span>50-69%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded bg-[var(--amber)]/50" />
              <span>30-49%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded bg-[var(--rose)]/30" />
              <span>&lt;30%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded bg-[var(--grid)]/20" />
              <span>0% (no data)</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-xs h-key">
            <span>Asset gaps:</span>
            <span>{getAssetGapIcon('renders')} Renders</span>
            <span>{getAssetGapIcon('specs')} Specs</span>
            <span>{getAssetGapIcon('samples')} Samples</span>
            <span>{getAssetGapIcon('images')} Images</span>
          </div>
          
          <p className="text-xs h-legend leading-relaxed">
            Cell = Save→Tag rate (%). Line shows "Saves → Tags" count. Hover reveals full breakdown: Saves, Tags, Rate, Δ vs cohort baseline (45%), and any asset gaps.
          </p>
        </div>
      </div>
    </div>
  );
}
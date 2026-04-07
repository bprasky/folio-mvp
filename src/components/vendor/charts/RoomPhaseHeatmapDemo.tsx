"use client";
import { useMemo, Fragment } from "react";
import { useDemoDerived } from "@/lib/demo/demoDerived";
import { clamp } from "@/lib/demo/anim";

type Cell = { room: "Kitchen" | "Bath" | "Outdoor" | string; phase: string; saves: number; tags: number; saveToTagRatePct?: number; ratePct?: number; };
type Props = { matrix: Cell[]; rooms: string[]; phases: string[]; };

export function RoomPhaseHeatmapDemo({ matrix, rooms, phases }: Props) {
  const { demoMode, b } = useDemoDerived();

  const m = useMemo(() => {
    if (!demoMode) return matrix;
    return matrix.map(c => {
      const baseRate = (c.ratePct ?? c.saveToTagRatePct ?? (c.saves > 0 ? (c.tags / c.saves) * 100 : 0));
      const bias = c.room.toLowerCase().includes("kitchen") ? b.kitchen
        : c.room.toLowerCase().includes("bath") ? b.bath
          : c.room.toLowerCase().includes("outdoor") ? b.outdoor : 0;
      // Up to ±10 pts shift weighted by bias
      const shifted = clamp((baseRate + (bias - 0.33) * 30) / 100, 0, 1) * 100;
      return { ...c, ratePct: Math.round(shifted) };
    });
  }, [matrix, demoMode, b]);

  return (
    <div className="chart-card p-5">
      <div className="mb-2 font-semibold">Room × Phase</div>
      <div className="h-key mb-3">Cell = Save→Tag rate (%). Demo Mode biases rooms per control.</div>
      <div className="grid grid-cols-[120px_repeat(4,minmax(0,1fr))] gap-3">
        <div />
        {phases.map(p => <div key={p} className="text-center h-key">{p}</div>)}
        {rooms.map(r => (
          <Fragment key={r}>
            <div className="h-key flex items-center">{r}</div>
            {phases.map(p => {
              const c = m.find(x => x.room === r && x.phase === p) || { saves: 0, tags: 0, ratePct: 0 };
              return (
                <div key={`${r}-${p}`} className="relative flex h-16 items-center justify-center rounded-xl border bg-surface-canvas">
                  <div className="text-base font-semibold">{(c.ratePct ?? 0)}%</div>
                  <div className="absolute bottom-1 text-[11px] h-key">{c.saves} saves → {c.tags} tags</div>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

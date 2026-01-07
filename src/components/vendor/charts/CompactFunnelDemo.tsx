"use client";
import { useMemo } from "react";
import { useDemoDerived } from "@/lib/demo/demoDerived";
import { motion } from "framer-motion";
import { springSoft } from "@/lib/demo/anim";

type Flow = {
  steps: { Saves: number; Boards: number; Tags: number; Value: number };
  conv: { savesBoards: number; boardsTags: number; tagsValue: number }; // 0..1
  cohort: { savesBoards: number; boardsTags: number; tagsValue: number };
};

function pct(n: number) { return `${Math.round(n * 100)}%`; }
function pts(n: number) { const p = Math.round(n * 100); return (p >= 0 ? `+${p}` : String(p)) + " pts"; }

export function CompactFunnelDemo({ data }: { data: Flow }) {
  const { demoMode, saveTagTarget } = useDemoDerived();

  const conv = useMemo(() => {
    if (!demoMode || saveTagTarget == null) return data.conv;
    // Only adjust boards→tags; keep others intact
    return { ...data.conv, boardsTags: saveTagTarget / 100 };
  }, [data.conv, demoMode, saveTagTarget]);

  const rows = [
    { k: "savesBoards", label: "Saves→Boards" },
    { k: "boardsTags", label: "Boards→Tags" },
    { k: "tagsValue", label: "Tags→Value" },
  ] as const;

  return (
    <motion.div layout transition={springSoft as any} className="chart-card p-4">
      <div className="mb-2 font-semibold">Influence Funnel</div>
      <div className="h-key mb-3">Actual • Cohort • Δ (Demo Mode adjusts Boards→Tags)</div>
      <div className="grid grid-cols-[140px_1fr_1fr_1fr] gap-y-2 items-center">
        <div />
        <div className="h-key text-right pr-2">Actual</div>
        <div className="h-key text-right pr-2">Cohort</div>
        <div className="h-key text-right pr-2">Δ</div>
        {rows.map(r => {
          // @ts-ignore
          const actual = conv[r.k];  // 0..1
          // @ts-ignore
          const cohort = data.cohort[r.k];
          const delta = actual - cohort;
          const danger = delta < 0;
          return (
            <div key={r.k} className="contents">
              <div className="text-sm text-[#111827]">{r.label}</div>
              <div className="text-right num font-medium">{pct(actual)}</div>
              <div className="text-right num text-[#6B7280]">{pct(cohort)}</div>
              <div className="text-right">
                <span className={`num px-2 py-0.5 rounded ${danger ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{pts(delta)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 num text-sm text-[#111827]">
        Saves {data.steps.Saves} • Boards {data.steps.Boards} • Tags {data.steps.Tags} • Value {data.steps.Value}
      </div>
    </motion.div>
  );
}

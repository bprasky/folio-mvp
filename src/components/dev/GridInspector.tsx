"use client";
import { useEffect, useRef } from "react";

export default function GridInspector({
  label = "festival-grid",
}: { label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.closest('[data-debug="festival-grid"]') as HTMLElement | null;
    if (!el) { console.warn("[GridInspector] container not found"); return; }
    const cs = getComputedStyle(el);
    const kids = Array.from(el.children) as HTMLElement[];
    console.group(`[GridInspector:${label}]`);
    console.log("display:", cs.display);
    console.log("gridTemplateColumns:", cs.gridTemplateColumns);
    console.log("gap:", cs.gap, "columnGap:", cs.columnGap, "rowGap:", cs.rowGap);
    console.log("children count:", kids.length);
    kids.slice(0, 6).forEach((k, i) => {
      const s = getComputedStyle(k);
      console.log(`child[${i}]`, {
        position: s.position,
        gridColumn: `${s.gridColumnStart} / ${s.gridColumnEnd}`,
        gridRow: `${s.gridRowStart} / ${s.gridRowEnd}`,
        zIndex: s.zIndex,
        display: s.display,
      });
    });
    console.groupEnd();
  }, []);
  return <div data-debug-probe="grid-inspector" ref={ref} />;
} 
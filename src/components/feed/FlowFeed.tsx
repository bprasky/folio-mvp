"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeEvent } from "@/lib/normalizeEvent";
import { bucketByPercentiles } from "@/lib/flow/score";
import { composeFlow } from "@/lib/flow/engine";
import EventCard from "@/components/feed/EventCard";

const clamp = (n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export default function FlowFeed({ events, canEdit=false }:{
  events: any[]; canEdit?: boolean;
}) {
  const items = useMemo(() => (events ?? []).map(normalizeEvent), [events]);
  const sized  = useMemo(() => bucketByPercentiles(items), [items]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(12);
  const [rowH, setRowH] = useState(64);

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width || el.clientWidth || 1200;
      // aim for ~120–140px base column width for good density
      const target = 128;
      const computed = clamp(Math.round(w / target), 2, 24);
      setCols(computed);
      const unit = w / computed;
      setRowH(Math.round(unit * 0.66)); // rhythm
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const placed = useMemo(() => composeFlow(sized, cols), [sized, cols]);

  const style: React.CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridAutoRows: `${rowH}px`,
    gridAutoFlow: "dense", // <-- let the browser backfill small items
  };

  return (
    <div ref={wrapRef} className="w-full">
      <div className="grid gap-2 sm:gap-3 lg:gap-4" style={style}>
        {placed.map(p => {
          const it = items.find(i => i.id === p.id);
          if (!it) return null;
          return (
            <div
              key={p.id}
              style={{
                gridColumn: `${p.col + 1} / span ${p.w}`,
                gridRow: `${p.row + 1} / span ${p.h}`,
              }}
            >
              <EventCard item={it} size={p.size} canEdit={canEdit} />
            </div>
          );
        })}
      </div>
    </div>
  );
} 
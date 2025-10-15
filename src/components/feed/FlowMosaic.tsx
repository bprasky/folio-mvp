"use client";
import Link from "next/link";
import { useMemo } from "react";
import clsx from "clsx";
import SafeImage from "@/components/SafeImage";

type UIEvent = {
  id: string;
  title: string;
  imageUrl?: string | null;
  heroImageUrl?: string | null;
  coverImageUrl?: string | null;
  rsvpCount?: number | null;
  viewCount?: number | null;
  isSponsored?: boolean | null;
  eventTypes?: string[] | null;
  startsAt?: string | null;   // ISO string ok
  startDate?: string | null;  // for alt shapes
};

export type FlowMosaicProps = {
  events: UIEvent[];
  canEdit?: boolean;
};

type Size = "L" | "M" | "S";

function pickImage(e: UIEvent) {
  return e.heroImageUrl || e.coverImageUrl || e.imageUrl || "/images/event-placeholder.jpg";
}

function score(e: UIEvent) {
  const rsvps = Number(e.rsvpCount ?? 0);
  const views = Number(e.viewCount ?? 0);
  const party = (e.eventTypes ?? []).some(t => String(t).toUpperCase().includes("PARTY")) ? 1 : 0;
  const promo = e.isSponsored ? 1 : 0;
  // Tunable weights
  return rsvps * 3 + views * 0.5 + party * 50 + promo * 80;
}

function assignSizes(events: UIEvent[]): { item: UIEvent; size: Size }[] {
  const ranked = [...events].sort((a,b) => score(b) - score(a));
  const n = ranked.length;

  const largeCount  = Math.max(2, Math.floor(n * 0.08));  // slightly fewer L
  const mediumCount = Math.max(6, Math.floor(n * 0.40));  // a bit more M
  const Ls = ranked.slice(0, largeCount).map(item => ({ item, size: "L" as const }));
  const Ms = ranked.slice(largeCount, largeCount + mediumCount).map(item => ({ item, size: "M" as const }));
  const Ss = ranked.slice(largeCount + mediumCount).map(item => ({ item, size: "S" as const }));

  const out: { item: UIEvent; size: Size }[] = [];
  // Interleave pattern so smalls appear throughout.
  const take = (arr: typeof Ls | typeof Ms | typeof Ss) => arr.length ? out.push(arr.shift()!) : null;

  while (Ls.length || Ms.length || Ss.length) {
    // Pattern: L, M, S, M, S, M
    take(Ls);
    take(Ms);
    take(Ss);
    take(Ms);
    take(Ss);
    take(Ms);
    // loop continues until all arrays empty
  }
  return out;
}

// Row units: 8px; these spans produce nice rectangles with dense packing.
// We compute rowSpan directly, do NOT rely on content height.
const rowUnit = 8;

function spanFor(size: Size, cols: number) {
  // cols is dynamic; we limit max colSpan based on container columns.
  // Bias to horizontal flow on large screens; vertical on tight screens.
  if (size === "L") {
    const col = cols >= 6 ? 4 : cols >= 4 ? 3 : 2;
    const row = cols >= 6 ? 34 : cols >= 4 ? 32 : 30; // ~272–256px
    return { colSpan: Math.min(col, cols), rowSpan: row };
  }
  if (size === "M") {
    const col = 2;
    const row = cols >= 4 ? 26 : 24; // ~208–192px
    return { colSpan: Math.min(col, cols), rowSpan: row };
  }
  // SMALL
  return { colSpan: 1, rowSpan: 18 }; // ~144px
}

// Quick hook to read an estimated columns value from responsive breakpoints
function useEstimatedCols() {
  // CSS-driven estimate: we don't measure; we align to our class breakpoints.
  if (typeof window === "undefined") return 4;
  const w = window.innerWidth;
  if (w >= 1280) return 6; // xl
  if (w >= 1024) return 4; // lg
  if (w >= 640)  return 2; // sm
  return 1;
}

function fmtDateTime(e: UIEvent) {
  const iso = e.startsAt || e.startDate;
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);
    const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
    return `${day} • ${time}`;
  } catch {
    return null;
  }
}

function hasRSVP(e: UIEvent) {
  const n = Number(e.rsvpCount ?? 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function FlowMosaic({ events, canEdit = false }: FlowMosaicProps) {
  const cols = useEstimatedCols();

  const sized = useMemo(() => assignSizes(events), [events]);
  return (
    <div
      className={clsx(
        "grid grid-flow-dense gap-3",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6",
        // force consistent row units so rowSpan works reliably
        "auto-rows-[8px]"
      )}
    >
      {sized.map(({ item, size }) => {
        const { colSpan, rowSpan } = spanFor(size, cols);
        const href = (item as any).href || `/events/${item.id}`;
        const img = pickImage(item);

        return (
          <article
            key={item.id}
            className={clsx(
              "group relative rounded-xl border border-folio-border shadow-sm bg-white overflow-hidden",
              // Tailwind supports col-span-1..12, dynamic via template string
              `col-span-${colSpan}`
            )}
            style={{ gridRowEnd: `span ${rowSpan}` }}
          >
            <Link href={href} className="absolute inset-0 z-30 block" aria-label={item.title ?? "View event"} data-testid="mosaic-card-link" />
            <div className="relative h-full">
              {/* image box: fill, cover */}
              <div className="absolute inset-0 pointer-events-none">
                <SafeImage
                  src={img}
                  alt={item.title ?? "Event"}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              </div>

              {/* content overlay */}
              <div className="relative z-20 pointer-events-none flex h-full items-end p-3">
                <div className="text-white w-full">
                  <div className={clsx("font-semibold leading-tight",
                    size === "L" ? "text-xl" : size === "M" ? "text-lg" : "text-sm"
                  )}>
                    {item.title}
                  </div>
                  {/* Meta row */}
                  {(() => {
                    const dt = fmtDateTime(item);
                    const rsvps = hasRSVP(item);
                    return (
                      <div className="mt-1 flex items-center gap-2 text-white/85 text-[11px]">
                        {dt && (
                          <span className="inline-flex items-center gap-1 rounded bg-black/45 px-1.5 py-0.5 backdrop-blur-sm">
                            {/* calendar icon (inline svg, no new deps) */}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                              <path d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 2 0v1Zm11 6H3v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z"/>
                            </svg>
                            <span>{dt}</span>
                          </span>
                        )}
                        {rsvps && (
                          <span className="inline-flex items-center gap-1 rounded bg-black/45 px-1.5 py-0.5 backdrop-blur-sm">
                            {/* users icon (inline svg) */}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                              <path d="M13 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-9 9a5 5 0 0 1 10 0v1H4v-1Z"/>
                            </svg>
                            <span>{rsvps} RSVPs</span>
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* edit affordance */}
              {canEdit && (
                <div className="absolute top-2 right-2 z-40 pointer-events-auto">
                  <Link
                    href={`/admin/events/${item.id}`}
                    className="pointer-events-auto rounded bg-black/60 text-white text-[11px] px-2 py-1 hover:bg-black/80"
                    onClick={(e)=>e.stopPropagation()}
                  >
                    ✎ Edit
                  </Link>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
} 
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
  href?: string;
};

export type FlowMosaicProps = {
  events: UIEvent[];
  canEdit?: boolean;
  preserveOrder?: boolean;
};

type Size = "L" | "M" | "S";

function pickImage(e: UIEvent) {
  return e.heroImageUrl || e.coverImageUrl || e.imageUrl || null;
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

function assignSizesInOrder(events: UIEvent[]): { item: UIEvent; size: Size }[] {
  const largeCount = Math.min(events.length, Math.max(2, Math.floor(events.length * 0.08)));
  const mediumCount = Math.min(events.length - largeCount, Math.max(6, Math.floor(events.length * 0.4)));
  const remaining = { L: largeCount, M: mediumCount, S: events.length - largeCount - mediumCount };
  const pattern: Size[] = ['L', 'M', 'S', 'M', 'S', 'M'];
  let patternIndex = 0;

  return events.map(item => {
    let size = pattern[patternIndex % pattern.length];
    while (remaining[size] === 0) {
      patternIndex += 1;
      size = pattern[patternIndex % pattern.length];
    }
    remaining[size] -= 1;
    patternIndex += 1;
    return { item, size };
  });
}

// Keep spans in static classes so Tailwind can emit them and the server/client
// render stays identical. The grid itself owns the responsive behavior.
const tileLayout: Record<Size, { className: string; rowSpan: number }> = {
  L: {
    className: "col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4",
    rowSpan: 34,
  },
  M: {
    className: "col-span-1 sm:col-span-2 lg:col-span-2 xl:col-span-2",
    rowSpan: 26,
  },
  S: { className: "col-span-1", rowSpan: 18 },
};

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

export default function FlowMosaic({ events, canEdit = false, preserveOrder = false }: FlowMosaicProps) {
  const sized = useMemo(
    () => preserveOrder ? assignSizesInOrder(events) : assignSizes(events),
    [events, preserveOrder]
  );
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
        const { className, rowSpan } = tileLayout[size];
        const href = item.href || `/events/${item.id}`;
        const img = pickImage(item);

        return (
          <article
            key={item.id}
            className={clsx(
              "group relative rounded-[20px] overflow-hidden",
              className
            )}
            style={{ gridRowEnd: `span ${rowSpan}` }}
          >
            <Link href={href} className="absolute inset-0 z-30 block" aria-label={item.title ?? "View event"} data-testid="mosaic-card-link" />
            <div className="relative h-full">
              {/* image box: fill, cover */}
              <div className="absolute inset-0 pointer-events-none">
                {img ? (
                  <SafeImage
                    src={img}
                    alt={item.title ?? "Event"}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-stone-200 text-xs uppercase tracking-[0.2em] text-stone-500">
                    Folio
                  </div>
                )}
                <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              </div>

              {/* content overlay */}
              <div className="relative z-20 pointer-events-none flex h-full items-end p-3">
                <div className="text-white w-full">
                  <h3 className={clsx("font-semibold leading-tight",
                    size === "L" ? "text-xl" : size === "M" ? "text-lg" : "text-sm"
                  )}>
                    {item.title}
                  </h3>
                  {/* Meta row */}
                  {(() => {
                    const dt = fmtDateTime(item);
                    const rsvps = hasRSVP(item);
                    return (
                      <div className="mt-1 flex items-center gap-2 text-white/85 text-[var(--type-eyebrow)]">
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
                    className="pointer-events-auto rounded bg-black/60 text-white text-[var(--type-eyebrow)] px-2 py-1 hover:bg-black/80"
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

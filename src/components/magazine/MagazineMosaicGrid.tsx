"use client";

// src/components/magazine/MagazineMosaicGrid.tsx
//
// Mosaic Grid Component - Editorial + Mosaic Standards
//
// Uses FlowMosaic-style grid with:
// - Varied tile sizes creating visual hierarchy
// - Card styling with 20px border-radius
// - Fills left-to-right naturally
// - Tight spacing matching festivals page

import Image from '@/components/FolioImage';
import Link from "next/link";
import { useMemo } from "react";
import clsx from "clsx";
import { type MagazineMosaicItem } from "@/lib/magazine/getMagazineData";

interface Props {
  items: MagazineMosaicItem[];
}

type Size = "L" | "M" | "S";

// Score items for size assignment (editorial items get priority)
function score(item: MagazineMosaicItem): number {
  const editorial = item.isEditorial ? 50 : 0;
  const recent = item.publishedAt ? 20 : 0;
  return editorial + recent;
}

// Assign sizes to items (similar to FlowMosaic)
function assignSizes(items: MagazineMosaicItem[]): { item: MagazineMosaicItem; size: Size }[] {
  const ranked = [...items].sort((a, b) => score(b) - score(a));
  const n = ranked.length;

  const largeCount = Math.max(1, Math.floor(n * 0.1));
  const mediumCount = Math.max(3, Math.floor(n * 0.3));
  const Ls = ranked.slice(0, largeCount).map(item => ({ item, size: "L" as const }));
  const Ms = ranked.slice(largeCount, largeCount + mediumCount).map(item => ({ item, size: "M" as const }));
  const Ss = ranked.slice(largeCount + mediumCount).map(item => ({ item, size: "S" as const }));

  const out: { item: MagazineMosaicItem; size: Size }[] = [];
  const take = (arr: typeof Ls | typeof Ms | typeof Ss) => arr.length ? out.push(arr.shift()!) : null;

  // Interleave pattern for visual variety
  while (Ls.length || Ms.length || Ss.length) {
    take(Ls);
    take(Ms);
    take(Ss);
    take(Ms);
    take(Ss);
    take(Ms);
  }
  return out;
}

// Row units: 8px (matching FlowMosaic)
const rowUnit = 8;

function spanFor(size: Size, cols: number) {
  if (size === "L") {
    const col = cols >= 6 ? 4 : cols >= 4 ? 3 : 2;
    const row = cols >= 6 ? 34 : cols >= 4 ? 32 : 30;
    return { colSpan: Math.min(col, cols), rowSpan: row };
  }
  if (size === "M") {
    const col = 2;
    const row = cols >= 4 ? 26 : 24;
    return { colSpan: Math.min(col, cols), rowSpan: row };
  }
  return { colSpan: 1, rowSpan: 18 };
}

// Estimate columns from window width
function useEstimatedCols() {
  if (typeof window === "undefined") return 4;
  const w = window.innerWidth;
  if (w >= 1280) return 6; // xl
  if (w >= 1024) return 4; // lg
  if (w >= 640) return 2; // sm
  return 1;
}

function formatTimeAgo(date: Date | string): string {
  // Coerce string → Date so this is safe for both server-component initial
  // render (RSC preserves Date) and JSON fetch responses where Date already
  // got serialized to ISO string.
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    return "Just now";
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } else {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
}

export default function MagazineMosaicGrid({ items }: Props) {
  const cols = useEstimatedCols();
  const sized = useMemo(() => assignSizes(items), [items]);
  
  if (!items.length) return null;

  return (
    <div
      className={clsx(
        "grid grid-flow-dense gap-3",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6",
        "auto-rows-[8px]"
      )}
    >
      {sized.map(({ item, size }) => {
        const { colSpan, rowSpan } = spanFor(size, cols);

        // Route based on content type
        // Collaborations go to /magazine/collaborations/[slug]
        // Published projects go to public editorial view (/p/[slug])
        // Unpublished projects go to /project/[id]
        let href: string;
        if (item.type === "collaboration" && item.collaborationSlug) {
          href = `/magazine/collaborations/${item.collaborationSlug}`;
        } else if (item.postSlug) {
          href = `/p/${item.postSlug}`;
        } else {
          href = `/project/${item.id}`;
        }

        const timeDisplay = item.publishedAt ? formatTimeAgo(item.publishedAt) : null;

        return (
          <article
            key={item.id}
            className={clsx(
              "group relative rounded-[20px] overflow-hidden transition-transform duration-300 hover:scale-[1.01]",
              `col-span-${colSpan}`
            )}
            style={{ gridRowEnd: `span ${rowSpan}` }}
          >
            <Link href={href} className="absolute inset-0 z-30 block" aria-label={item.title} />
            <div className="relative h-full">
              {/* Image */}
              <div className="absolute inset-0 pointer-events-none">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-surface-ground" />
                )}
                <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              </div>

              {/* Collaboration Badge */}
              {item.isCollaboration && (
                <div className="absolute top-3 left-3 z-20 pointer-events-none">
                  <span className="inline-flex items-center gap-1 bg-[rgb(74,44,59)] text-white text-[var(--type-fine)] font-semibold px-2 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Collaboration
                  </span>
                </div>
              )}

              {/* Content overlay */}
              <div className="relative z-20 pointer-events-none flex h-full items-end p-3">
                <div className="text-white w-full">
                  <div className={clsx(
                    "folio-h3 font-semibold leading-tight line-clamp-2 !text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]",
                    size === "L" ? "text-xl" : size === "M" ? "text-lg" : "text-sm"
                  )}>
                    {item.title}
                  </div>
                  {/* Meta row */}
                  <div className="mt-1.5 flex items-center gap-2 text-white/85 text-[var(--type-eyebrow)]">
                    {item.isCollaboration && item.vendorName && item.designerName && (
                      <span className="folio-meta inline-flex items-center gap-1 rounded bg-black/45 px-1.5 py-0.5 backdrop-blur-sm capitalize">
                        {item.vendorName} × {item.designerName}
                      </span>
                    )}
                    {timeDisplay && !item.isCollaboration && (
                      <span className="folio-meta inline-flex items-center gap-1 rounded bg-black/45 px-1.5 py-0.5 backdrop-blur-sm">
                        {timeDisplay}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}


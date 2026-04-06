"use client";

import { useState } from "react";

import { StoryViewer } from "./stories/StoryViewer";
import type { UpdatesCarouselItem } from "@/lib/feed/getUpdatesCarousel";

function CarouselSkeleton() {
  return (
    <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
      {Array.from({ length: 8 }).map((_, idx) => (
        <div
          key={idx}
          className="relative flex flex-1 min-w-0 flex-col items-center gap-2"
        >
          <div className="block h-[120px] w-full aspect-square overflow-hidden rounded-lg ring-2 ring-[var(--ridge-outer)] bg-surface-ground animate-pulse" />
          <div className="h-3 w-full max-w-[100px] bg-surface-ground rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function UpdatesCarousel({ groups }: { groups: UpdatesCarouselItem[] }) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  
  // Show skeleton if no groups
  if (!groups?.length) {
    return <CarouselSkeleton />;
  }

  return (
    <>
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {groups.map((g, idx) => (
          <button
            key={g.key}
            onClick={() => setOpenAt(idx)}
            className="group relative flex flex-1 min-w-0 flex-col items-center gap-2"
            aria-label={`Open updates: ${(g.designer.studioName || g.designer.name || "Designer")} — ${g.project.title || "Project"}`}
          >
            <span className="block h-[120px] w-full aspect-square overflow-hidden rounded-lg ring-2 ring-[var(--text-primary)]/60 ring-offset-2 ring-offset-[var(--bg-base)] shadow-sm">
              {g.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.cover} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              ) : (
                <span className="h-full w-full bg-surface-ground block" />
              )}
            </span>
            <span className="text-[11px] text-folio-text-secondary line-clamp-2 text-center w-full max-w-[120px]">
              {g.designer.studioName || g.designer.name || "Designer"}
            </span>
          </button>
        ))}
      </div>

      {openAt !== null ? (
        <StoryViewer groups={groups} index={openAt} onClose={() => setOpenAt(null)} />
      ) : null}
    </>
  );
}


"use client";

import React from "react";

export function StoriesRail({ modules }: { modules: any[] }) {
  if (!modules.length) return null;
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {modules.map((m) => {
        const media = Array.isArray(m.media) ? m.media[0] : m.media;
        const thumb = media?.thumbnailUrl || media?.poster || media?.url || null;
        return (
          <a
            key={m.id}
            href={`#module-${m.id}`} // can link to detail later
            className="min-w-[180px] max-w-[220px] rounded-2xl bg-neutral-50 ring-1 ring-black/5 overflow-hidden flex-shrink-0"
          >
            <div className="relative h-[140px] bg-neutral-200">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt={m.title || ""} className="h-full w-full object-cover" />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-2 left-2 text-[11px] text-white font-medium line-clamp-2">
                {m.title || "Project update"}
              </div>
            </div>
            {m.description ? (
              <p className="p-3 text-[12px] text-neutral-600 line-clamp-3">{m.description}</p>
            ) : null}
          </a>
        );
      })}
    </div>
  );
}



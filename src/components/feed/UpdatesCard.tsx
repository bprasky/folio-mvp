"use client";

import React from "react";
import Link from "next/link";

export function UpdatesCard({ module }: { module: any }) {
  const media = Array.isArray(module.media) ? module.media[0] : module.media;
  const thumb =
    media?.thumbnailUrl || media?.poster || media?.url || module.project?.images?.[0]?.url || null;
  const designer = module.project?.designer;
  const name = designer?.studio || designer?.name || "Designer";
  const slug = module.project?.post?.slug || null;
  const projectSlug = slug ? `/p/${slug}` : "#";

  const labelByType: Record<string, string> = {
    STORY: "Story update",
    SHORT_VIDEO: "Short clip",
    LONG_VIDEO: "Project film",
    GALLERY: "Gallery",
    BOARD: "Board",
  };

  const typeLabel = labelByType[module.type] || "Update";

  return (
    <Link
      href={`${projectSlug}#module-${module.id}`}
      className="group rounded-[20px] ring-1 ring-black/5 bg-surface-canvas overflow-hidden flex flex-col"
    >
      <div className="relative h-[220px] bg-surface-ground">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={module.title || ""}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex justify-between items-end p-3">
          <span className="rounded-full bg-black/70 text-[11px] text-white px-2 py-0.5">
            {typeLabel}
          </span>
          <span className="rounded-full bg-white/80 text-[11px] text-folio-text-primary px-2 py-0.5">
            {module.project.title}
          </span>
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1">
        <div className="text-[14px] font-semibold text-folio-text-primary line-clamp-2">
          {module.title || `Update on ${module.project.title}`}
        </div>
        {module.description && (
          <p className="text-[12px] text-folio-text-secondary line-clamp-3">
            {module.description}
          </p>
        )}
        <p className="mt-auto pt-2 text-[11px] text-folio-text-secondary">
          by {name}
        </p>
      </div>
    </Link>
  );
}



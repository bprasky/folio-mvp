"use client";

import React from "react";

type M = {
  id: string;
  title?: string | null;
  description?: string | null;
  media: any;
};

export function LongVideoModule({ module }: { module: M }) {
  const video = Array.isArray(module.media)
    ? module.media.find((m: any) => m.kind === "video" || m.type === "video")
    : module.media;

  if (!video?.url) return null;

  // Simple responsive embed: can later branch by provider (Vimeo, YouTube, mp4, etc.)
  return (
    <div className="rounded-3xl overflow-hidden border border-[var(--ridge-outer)] bg-black/90">
      <div className="relative pb-[56.25%]">
        <video
          src={video.url}
          controls
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      {(module.title || module.description) && (
        <div className="p-4 folio-ui text-neutral-100">
          {module.title && <h3 className="font-medium mb-1">{module.title}</h3>}
          {module.description && <p className="text-neutral-200">{module.description}</p>}
        </div>
      )}
    </div>
  );
}



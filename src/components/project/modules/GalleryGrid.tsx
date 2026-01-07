"use client";

import React from "react";

export function GalleryGrid({ modules }: { modules: any[] }) {
  const images: { url: string; caption?: string | null }[] = [];
  modules.forEach((m) => {
    (Array.isArray(m.media) ? m.media : [m.media]).forEach((item: any) => {
      if (!item?.url) return;
      images.push({ url: item.url, caption: item.caption });
    });
  });
  if (!images.length) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {images.map((im, i) => (
        <figure key={i} className="rounded-2xl overflow-hidden ring-1 ring-black/5 bg-neutral-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={im.url} alt={im.caption || ""} className="h-[200px] w-full object-cover" />
          {im.caption && (
            <figcaption className="p-2 text-[12px] text-neutral-600">
              {im.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}



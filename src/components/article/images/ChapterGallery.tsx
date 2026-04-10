"use client";

import { useState } from "react";
import Lightbox from "./Lightbox";
import { ImageLike } from "./utils";
import { TaggedImage } from "@/components/project/interaction/TaggedImage";

export default function ChapterGallery({ images }: { images: ImageLike[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const list = images?.length ? images : [];
  const unique = list.filter(Boolean); // already deduped by normImages upstream
  if (!unique.length) return null;

  return (
    <section className="mt-8">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {unique.map((im, i) => (
          <figure
            key={i}
            className="relative rounded-2xl overflow-hidden ring-1 ring-black/5 cursor-zoom-in bg-surface-ground"
            onClick={() => setOpen(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={im.url!}
              alt={im.alt || ""}
              className="w-full h-auto"
            />
            {im.tags && im.tags.length > 0 && (
              <TaggedImage image={im} interactionLevel="explore" surface="super_article" />
            )}
            {im.caption ? (
              <figcaption className="p-2 folio-meta text-folio-text-secondary">
                {im.caption}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
      {open !== null ? (
        <Lightbox
          images={unique as any}
          openIndex={open}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}


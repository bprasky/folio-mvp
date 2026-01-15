"use client";

import { useState } from "react";
import Lightbox from "./Lightbox";
import { ImageLike } from "./utils";

export default function MaterialPair({
  context,
  detail,
  caption,
}: {
  context?: ImageLike | null;
  detail?: ImageLike | null;
  caption?: string | null;
}) {
  const imgs: ImageLike[] = [context, detail].filter(Boolean) as ImageLike[];
  const [open, setOpen] = useState<number | null>(null);
  if (!imgs.length) return null;

  return (
    <section className="mt-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {context ? (
          <figure
            className="rounded-2xl overflow-hidden ring-1 ring-black/5 cursor-zoom-in"
            onClick={() => setOpen(0)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={context.url!}
              alt={context.alt || ""}
              className="w-full h-[320px] object-cover"
            />
            {caption ? (
              <figcaption className="p-2 folio-meta text-[var(--text-secondary)]">
                {caption}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
        {detail ? (
          <figure
            className="rounded-2xl overflow-hidden ring-1 ring-black/5 cursor-zoom-in"
            onClick={() => setOpen(context ? 1 : 0)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={detail.url!}
              alt={detail.alt || ""}
              className="w-full h-[320px] object-cover"
            />
            {detail.caption ? (
              <figcaption className="p-2 folio-meta text-[var(--text-secondary)]">
                {detail.caption}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
      </div>
      {open !== null ? (
        <Lightbox
          images={imgs as any}
          openIndex={open}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}



"use client";

import { useState } from "react";
import Lightbox from "./Lightbox";
import { ImageLike } from "./utils";

export default function FeatureDiptych({ images }: { images: ImageLike[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const list = images?.length ? images : [];
  if (!list.length) return null;

  // 0: feature
  const feature = list[0];

  // next uniques for diptych/triptych
  const rest = list.slice(1);

  // render flags
  const hasDiptych = rest.length >= 2;
  const hasTriptych = rest.length >= 5; // after feature(1) + diptych(2) → need 3 more

  const diptych = hasDiptych ? rest.slice(0, 2) : [];
  const triptych = hasTriptych ? rest.slice(2, 5) : [];

  // map index for lightbox across all rendered frames:
  const lightboxOrder = [feature, ...diptych, ...triptych].filter(Boolean);

  return (
    <section className="mt-8 space-y-4">
      {/* Feature */}
      {feature ? (
        <figure
          className="rounded-3xl overflow-hidden ring-1 ring-black/5 cursor-zoom-in"
          onClick={() => setOpen(0)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={feature.url!}
            alt={feature.alt || ""}
            className="w-full h-[420px] object-cover"
          />
          {feature.caption ? (
            <figcaption className="p-2 folio-meta text-[var(--text-secondary)]">
              {feature.caption}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      {/* Diptych only when we truly have 2 */}
      {hasDiptych ? (
        <div className="grid grid-cols-2 gap-4">
          {diptych.map((img, i) => (
            <figure
              key={i}
              className="rounded-3xl overflow-hidden ring-1 ring-black/5 cursor-zoom-in"
              onClick={() => setOpen(1 + i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url!}
                alt={img.alt || ""}
                className="w-full h-[300px] object-cover"
              />
              {img.caption ? (
                <figcaption className="p-2 folio-meta text-[var(--text-secondary)]">
                  {img.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}

      {/* Triptych only when we truly have 3 more */}
      {hasTriptych ? (
        <div className="grid grid-cols-3 gap-4">
          {triptych.map((img, i) => (
            <figure
              key={i}
              className="rounded-3xl overflow-hidden ring-1 ring-black/5 cursor-zoom-in"
              onClick={() => setOpen(1 + diptych.length + i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url!}
                alt={img.alt || ""}
                className="w-full h-[220px] object-cover"
              />
              {img.caption ? (
                <figcaption className="p-2 folio-meta text-[var(--text-secondary)]">
                  {img.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}

      {open !== null ? (
        <Lightbox
          images={lightboxOrder as any}
          openIndex={open}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}


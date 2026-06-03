"use client";

import { useEffect, useState } from "react";

export default function Lightbox({
  images,
  openIndex,
  onClose,
}: {
  images: {
    url: string;
    alt?: string | null;
    caption?: string | null;
    tags?: any[];
  }[];
  openIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(openIndex);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight")
        setIdx((i) => Math.min(i + 1, images.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  const im = images[idx];

  if (!im) return null;

  return (
    <div
      className="fixed inset-0 z-[80] glass-backdrop flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={im.url}
          alt={im.alt || ""}
          className="w-full max-h-[80vh] object-contain rounded-xl"
        />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 rounded-full bg-surface-canvas/80 px-3 py-1 folio-meta hover:bg-surface-canvas transition-colors"
        >
          Close
        </button>
        {images.length > 1 && (
          <div className="absolute top-1/2 -translate-y-1/2 left-2 right-2 flex justify-between pointer-events-none">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIdx((i) => Math.max(i - 1, 0));
              }}
              disabled={idx === 0}
              className="rounded-full bg-surface-canvas/80 px-3 py-2 folio-meta hover:bg-surface-canvas transition-colors pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIdx((i) => Math.min(i + 1, images.length - 1));
              }}
              disabled={idx === images.length - 1}
              className="rounded-full bg-surface-canvas/80 px-3 py-2 folio-meta hover:bg-surface-canvas transition-colors pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        )}
        {im.caption || (im.tags?.length ?? 0) > 0 ? (
          <div className="mt-2 rounded-xl bg-surface-canvas/85 p-3 folio-meta text-folio-text-primary">
            {im.caption ? <p className="mb-1">{im.caption}</p> : null}
            {/* Hook: render tag chips if you have InlineTagLink */}
            {im.tags && im.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {im.tags.slice(0, 6).map((t, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-surface-ground px-2 py-0.5 folio-meta ring-1 ring-black/5"
                  >
                    {t?.label || t?.name || t?.productName || "Tagged"}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : null}
        {images.length > 1 && (
          <div className="mt-2 text-center folio-meta text-white/70">
            {idx + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  );
}



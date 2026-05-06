"use client";

import { useEffect, useState } from "react";

export type PhotoFrame = "landscape" | "portrait" | "square";

// Aspect thresholds match the published-page rule:
// - >= 1.3 → landscape (full-bleed)
// - <= 0.85 → portrait (prose column)
// - else → square (wide column)
export function classifyAspect(width: number, height: number): PhotoFrame {
  if (!width || !height) return "landscape";
  const aspect = width / height;
  if (aspect >= 1.3) return "landscape";
  if (aspect <= 0.85) return "portrait";
  return "square";
}

// Resolves a photo's aspect ratio. Prefers stored dimensions (no layout
// shift); falls back to loading the image client-side. Returns null while
// detection is in flight so callers can default to full-bleed.
export function useImageAspect(
  imageUrl: string | undefined,
  storedWidth?: number | null,
  storedHeight?: number | null,
): { frame: PhotoFrame | null; width: number | null; height: number | null } {
  const hasStored = !!(storedWidth && storedHeight);
  const [resolved, setResolved] = useState<{ width: number; height: number } | null>(
    hasStored ? { width: storedWidth!, height: storedHeight! } : null,
  );

  useEffect(() => {
    if (hasStored || !imageUrl) return;
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      setResolved({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, hasStored]);

  if (!resolved) return { frame: null, width: null, height: null };
  return {
    frame: classifyAspect(resolved.width, resolved.height),
    width: resolved.width,
    height: resolved.height,
  };
}

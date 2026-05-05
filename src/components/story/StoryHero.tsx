"use client";

// StoryHero — Full-width hero image. Clean. No text, no overlay, no gradient.
// Rule 1: Photos Are Sacred.
// Orientation-aware: landscape fills width capped at viewport height, portrait
// fills its sidebar column. The viewport-height cap (--story-photo-vmax × aspect)
// keeps the whole image visible even on tall landscape ratios like 3:2.

import Image from "next/image";
import { useImageAspect } from "./useImageAspect";

interface StoryHeroProps {
  imageUrl: string;
  alt: string;
  orientation?: "landscape" | "portrait";
}

export function StoryHero({ imageUrl, alt, orientation = "landscape" }: StoryHeroProps) {
  // Match natural aspect once the image loads so the height cap is precise.
  // Until then the wrapper falls back to full width (no cap).
  const aspect = useImageAspect(imageUrl);

  if (!imageUrl) return null;

  const aspectRatio =
    aspect.width && aspect.height ? aspect.width / aspect.height : null;
  const wrapperMaxWidth =
    orientation === "landscape" && aspectRatio
      ? `min(100%, calc(var(--story-photo-vmax) * ${aspectRatio.toFixed(4)}))`
      : undefined;

  return (
    <figure
      className="relative w-full overflow-hidden rounded-[14px] mx-auto"
      style={wrapperMaxWidth ? { maxWidth: wrapperMaxWidth } : undefined}
    >
      <Image
        src={imageUrl}
        alt={alt}
        width={1920}
        height={orientation === "portrait" ? 2560 : 1080}
        priority
        className="w-full h-auto"
        sizes={orientation === "portrait" ? "(max-width: 768px) 100vw, 48vw" : "100vw"}
      />
    </figure>
  );
}

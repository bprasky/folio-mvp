"use client";

// StoryHero — Full-width hero image. Clean. No text, no overlay, no gradient.
// Rule 1: Photos Are Sacred.
// Orientation-aware: landscape fills width, portrait fills its container column.

import Image from "next/image";

interface StoryHeroProps {
  imageUrl: string;
  alt: string;
  orientation?: "landscape" | "portrait";
}

export function StoryHero({ imageUrl, alt, orientation = "landscape" }: StoryHeroProps) {
  if (!imageUrl) return null;

  return (
    <figure className="relative w-full overflow-hidden rounded-[14px]">
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

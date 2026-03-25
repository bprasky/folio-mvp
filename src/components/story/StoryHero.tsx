"use client";

// StoryHero — Full-width hero image. Clean. No text, no overlay, no gradient.
// Rule 1: Photos Are Sacred.

import Image from "next/image";

interface StoryHeroProps {
  imageUrl: string;
  alt: string;
}

export function StoryHero({ imageUrl, alt }: StoryHeroProps) {
  if (!imageUrl) return null;

  return (
    <figure className="relative w-full overflow-hidden rounded-[14px]">
      <Image
        src={imageUrl}
        alt={alt}
        width={1920}
        height={1080}
        priority
        className="max-h-[75vh] w-auto mx-auto"
        sizes="100vw"
      />
    </figure>
  );
}

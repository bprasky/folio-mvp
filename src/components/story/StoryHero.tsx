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
      {/* Constrain hero height so intro panel is visible above the fold */}
      <div className="relative w-full" style={{ maxHeight: "55vh" }}>
        <Image
          src={imageUrl}
          alt={alt}
          width={1440}
          height={810}
          priority
          className="w-full h-auto object-cover"
          style={{ maxHeight: "55vh", objectFit: "cover" }}
          sizes="100vw"
        />
      </div>
    </figure>
  );
}

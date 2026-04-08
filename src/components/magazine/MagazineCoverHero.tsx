// src/components/magazine/MagazineCoverHero.tsx
//
// Magazine Cover Hero Component - Full-Bleed Editorial Treatment
//
// Creates a magazine cover experience with:
// - Full-viewport hero image (95vh with content peek)
// - Glass Foil masthead overlay (FOLIO brand)
// - Editorial tag and title block
// - Gradient overlay for text legibility
// - Scrolls naturally with the page (not fixed)

"use client";

import Image from "next/image";
import Link from "next/link";
import { type MagazineHero as HeroType } from "@/lib/magazine/getMagazineData";
import { type MagazineEditionConfig } from "@/lib/magazine/editions";
import { TaggedImage } from "@/components/project/interaction/TaggedImage";

interface Props {
  hero: HeroType;
  edition: MagazineEditionConfig;
}

export default function MagazineCoverHero({ hero, edition }: Props) {
  // CRITICAL: Always route published projects to public editorial view (/p/[slug])
  // Never link to /project/[id] from magazine feed - that's the private designer interface
  const href = hero.postSlug
    ? `/p/${hero.postSlug}`
    : `/project/${hero.id}`; // Fallback only if no slug (shouldn't happen for published items)

  return (
    <article className="group w-full">
      <Link href={href} className="block">
        {/* Full-bleed hero container - 100vh minus slight content peek */}
        {/* Negative margin-top pulls hero behind the transparent sticky header (64px) */}
        <div className="relative w-full h-[100vh] -mt-16 overflow-hidden">
          {/* Hero Image - Full bleed with object-fit cover */}
          {hero.imageUrl && hero.imageUrl.length > 0 ? (
            <Image
              src={hero.imageUrl}
              alt={hero.title}
              fill
              className="object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
              priority
              sizes="100vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-base)]" />
          )}

          {/* Tagged product interaction overlay */}
          {hero.heroImage && hero.heroImage.tags?.length > 0 && (
            <TaggedImage image={hero.heroImage} interactionLevel="explore" />
          )}

          {/* Gradient overlay for bottom text legibility */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/2 z-[5]"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 40%, transparent 100%)'
            }}
          />

          {/* Glass Foil Masthead - Centered at top */}
          {/* Extra top padding accounts for the transparent header (64px) + spacing */}
          <div className="absolute top-24 md:top-28 lg:top-32 left-1/2 -translate-x-1/2 z-10">
            <h1
              className="masthead-glass-foil font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light uppercase tracking-[0.15em] md:tracking-[0.18em] select-none"
              style={{
                fontFamily: 'var(--font-headline), ui-serif, Georgia, "Times New Roman", serif',
                fontWeight: 300,
              }}
            >
              FOLIO
            </h1>
          </div>

          {/* Editorial Tag - Upper left, below the masthead */}
          <div className="absolute left-6 md:left-10 lg:left-12 top-44 md:top-52 lg:top-56 z-10">
            <span
              className="text-[10px] md:text-[11px] font-medium uppercase tracking-[0.2em] select-none"
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                mixBlendMode: 'overlay',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }}
            >
              Editorial
            </span>
          </div>

          {/* Title Block - Bottom left */}
          <div className="absolute bottom-8 md:bottom-10 lg:bottom-12 left-6 md:left-10 lg:left-12 max-w-[90%] md:max-w-[600px] z-10">
            {/* Serif italic headline - editorial magazine style */}
            <h2
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[52px] text-white leading-[1.15] mb-2 md:mb-3"
              style={{
                fontFamily: 'var(--font-headline), ui-serif, Georgia, "Times New Roman", serif',
                fontStyle: 'italic',
                fontWeight: 400,
                letterSpacing: '-0.01em',
                textShadow: '0 2px 20px rgba(0,0,0,0.3)'
              }}
            >
              {hero.title}
            </h2>

            {/* Designer attribution */}
            {(hero.designerName || hero.locationLabel) && (
              <p
                className="text-sm md:text-base text-white/85 font-medium tracking-wide"
                style={{
                  textShadow: '0 1px 8px rgba(0,0,0,0.4)'
                }}
              >
                {hero.designerName && <span className="capitalize">{hero.designerName}</span>}
                {hero.designerName && hero.locationLabel && <span className="mx-2 opacity-60">·</span>}
                {hero.locationLabel && <span>{hero.locationLabel}</span>}
              </p>
            )}
          </div>

          {/* Subtle scroll indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 opacity-50 animate-bounce">
            <svg
              className="w-5 h-5 text-white/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        </div>
      </Link>
    </article>
  );
}

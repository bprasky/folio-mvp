// src/components/magazine/MagazineHero.tsx
//
// Editorial Hero Component - Premium Editorial Treatment
//
// Features:
// - Serif italic headline (editorial magazine style)
// - Larger hero imagery
// - Subtle "EDITORIAL" badge
// - Designer attribution visible
// - Tight spacing, magazine density

import Image from "next/image";
import Link from "next/link";
import { type MagazineHero as HeroType } from "@/lib/magazine/getMagazineData";
import { type MagazineEditionConfig } from "@/lib/magazine/editions";

interface Props {
  hero: HeroType;
  edition: MagazineEditionConfig;
}

export default function MagazineHero({ hero, edition }: Props) {
  // CRITICAL: Always route published projects to public editorial view (/p/[slug])
  // Never link to /project/[id] from magazine feed - that's the private designer interface
  const href = hero.postSlug
    ? `/p/${hero.postSlug}`
    : `/project/${hero.id}`; // Fallback only if no slug (shouldn't happen for published items)

  return (
    <article className="group w-full">
      <Link href={href} className="block">
        {/* Hero card with rounded corners and glass styling */}
        <div className="relative w-full h-[50vh] md:h-[65vh] bg-neutral-100 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          {hero.imageUrl && hero.imageUrl.length > 0 ? (
            <Image
              src={hero.imageUrl}
              alt={hero.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.01]"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-100 to-neutral-200" />
          )}
          
          {/* Gradient overlay for text contrast */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/5" />

          {/* Subtle EDITORIAL badge - top left */}
          <div className="absolute left-4 md:left-6 top-4 md:top-6 z-10">
            <span className="inline-flex items-center rounded-full bg-white/90 backdrop-blur-sm px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-700 shadow-sm border border-white/50">
              Editorial
            </span>
          </div>

          {/* Title and metadata overlay - bottom section */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 px-4 md:px-6 pb-6 md:pb-8 z-10">
            {/* Text background gradient for contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
            
            <div className="relative">
              {/* Serif italic headline - editorial magazine style */}
              <h2 
                className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl text-white leading-[1.15] mb-2 md:mb-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                style={{ 
                  fontFamily: 'var(--brand-font), ui-serif, Georgia, "Times New Roman", serif', 
                  fontStyle: 'italic',
                  fontWeight: 400,
                  letterSpacing: '-0.01em' 
                }}
              >
                {hero.title}
              </h2>
              {/* Designer attribution */}
              {(hero.designerName || hero.locationLabel) && (
                <p className="text-sm md:text-base lg:text-lg text-white/90 font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)] tracking-wide">
                  {hero.designerName && <span>{hero.designerName}</span>}
                  {hero.designerName && hero.locationLabel && <span className="mx-2">·</span>}
                  {hero.locationLabel && <span>{hero.locationLabel}</span>}
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}


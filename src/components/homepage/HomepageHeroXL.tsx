// HomepageHeroXL — full-bleed editorial hero (Task 05)
//
// Visual contract:
//   - 21:10 aspect at desktop; 600px min-height
//   - 24px radius
//   - 40px side margins (max-w-[1440px] container)
//   - White overlay text bottom-left (`bottom: 36px`)
//   - White eyebrow badge top-left
//   - NO reel inside the photo. The boost reel is a sibling component
//     tethered 16px below.

import Link from "next/link";
import Image from "next/image";

import type { HomepageHero } from "@/lib/homepage/getHomepageData";

interface Props {
  hero: HomepageHero;
}

export function HomepageHeroXL({ hero }: Props) {
  return (
    <div className="px-10 max-w-[1440px] mx-auto">
      <Link
        href={`/p/${hero.postSlug}`}
        className="relative block overflow-hidden rounded-3xl group"
        style={{ aspectRatio: "21 / 10", minHeight: "600px" }}
      >
        <Image
          src={hero.heroImageUrl}
          alt={hero.title}
          fill
          priority
          sizes="(min-width: 1440px) 1360px, 100vw"
          className="object-cover"
        />

        {/* Subtle gradient at the bottom only — keep the photo readable */}
        <div
          className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(20,20,20,0.58) 0%, rgba(20,20,20,0.0) 100%)",
          }}
        />

        {/* Eyebrow badge — top-left */}
        <div className="absolute top-9 left-9">
          <span
            className="inline-block px-4 py-1.5 rounded-full backdrop-blur-md folio-eyebrow"
            style={{
              background: "rgba(255,255,255,0.92)",
              color: "var(--folio-ink)",
            }}
          >
            {hero.eyebrow}
          </span>
        </div>

        {/* Title + meta — bottom-left, 36px from bottom */}
        <div className="absolute left-9 right-9" style={{ bottom: "36px" }}>
          <h1
            className="text-white max-w-[800px]"
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "var(--type-h1)",
              lineHeight: "var(--lh-h1)",
              fontWeight: "var(--w-h1)",
              letterSpacing: "var(--ls-tight)",
            }}
          >
            {hero.title}
          </h1>
          {(hero.designerName || hero.studio) && (
            <p
              className="text-white/85 mt-2 folio-meta"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {hero.studio ?? hero.designerName}
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}

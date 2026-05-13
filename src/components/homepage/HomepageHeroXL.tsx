// HomepageHeroXL — full-bleed editorial hero (Task 05)
//
// Visual contract:
//   - Desktop: 21:10 aspect, 600px min-height, 40px side margins
//   - Mobile (<sm): 5:4 aspect (taller, more legible at 375px), 16px side
//     margins, smaller eyebrow inset, h2-scale title
//   - 24px radius across breakpoints
//   - White overlay text bottom-left
//   - White eyebrow badge top-left
//   - NO reel inside the photo. The boost reel is a sibling component
//     tethered 16px below.
//
// Server component: no styled-jsx, no `useSession`. Breakpoint switches use
// Tailwind responsive utilities + arbitrary-value classes that compile to
// static CSS at build time.

import Link from "next/link";
import Image from "next/image";

import type { HomepageHero } from "@/lib/homepage/getHomepageData";

interface Props {
  hero: HomepageHero;
}

export function HomepageHeroXL({ hero }: Props) {
  return (
    <div className="px-4 sm:px-10 max-w-[1440px] mx-auto">
      <Link
        href={`/p/${hero.postSlug}`}
        className={[
          "relative block overflow-hidden rounded-3xl group",
          // Aspect: 5:4 on mobile (taller, more legible at 375px),
          // 21:10 on sm+ desktop. min-h-0 on mobile so aspect drives layout.
          "aspect-[5/4] sm:aspect-[21/10]",
          "min-h-0 sm:min-h-[600px]",
        ].join(" ")}
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
        <div className="absolute top-6 left-6 sm:top-9 sm:left-9">
          <span
            className="inline-block px-3 sm:px-4 py-1 sm:py-1.5 rounded-full backdrop-blur-md folio-eyebrow"
            style={{
              background: "rgba(255,255,255,0.92)",
              color: "var(--folio-ink)",
            }}
          >
            {hero.eyebrow}
          </span>
        </div>

        {/* Title + meta — bottom-left.
            Mobile: 24px from bottom, h2-scale title, tighter side margins.
            Desktop: 36px from bottom, h1-scale title. */}
        <div className="absolute left-6 right-6 sm:left-9 sm:right-9 bottom-6 sm:bottom-9">
          <h1
            className={[
              "text-white max-w-[800px]",
              // Mobile uses h3 (28px) + line-clamp-3 because the 5:4 card is
              // ~274px tall on a 343px-wide viewport — h2 (36px) wraps to
              // 5 lines and clips above the card edge. Desktop's 21:10 card
              // (600px+ tall) easily holds h1.
              "line-clamp-3 sm:line-clamp-none",
              "[font-family:var(--font-headline)]",
              "[letter-spacing:var(--ls-tight)]",
              "[font-size:var(--type-h3)] sm:[font-size:var(--type-h1)]",
              "[line-height:var(--lh-h3)] sm:[line-height:var(--lh-h1)]",
              "[font-weight:var(--w-h3)] sm:[font-weight:var(--w-h1)]",
            ].join(" ")}
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

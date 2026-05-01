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
        className="relative block overflow-hidden rounded-3xl group hero-xl"
        // Aspect ratio + min-height set in the dedicated <style> block below
        // so the breakpoint switch (5:4 → 21:10) is one declaration, not a
        // tower of inline-style ternaries.
      >
        <Image
          src={hero.heroImageUrl}
          alt={hero.title}
          fill
          priority
          sizes="(min-width: 1440px) 1360px, (min-width: 640px) 100vw, 100vw"
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
          <h1 className="text-white max-w-[800px] hero-xl-title">
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

      {/* Breakpoint switches kept here rather than in globals.css — they
          belong to this component, not the design system. */}
      <style jsx>{`
        .hero-xl {
          aspect-ratio: 5 / 4;
          min-height: 0;
        }
        .hero-xl-title {
          font-family: var(--font-headline);
          font-size: var(--type-h2);
          line-height: var(--lh-h2);
          font-weight: var(--w-h2);
          letter-spacing: var(--ls-tight);
        }
        @media (min-width: 640px) {
          .hero-xl {
            aspect-ratio: 21 / 10;
            min-height: 600px;
          }
          .hero-xl-title {
            font-size: var(--type-h1);
            line-height: var(--lh-h1);
            font-weight: var(--w-h1);
          }
        }
      `}</style>
    </div>
  );
}

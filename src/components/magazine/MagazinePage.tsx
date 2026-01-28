// src/components/magazine/MagazinePage.tsx
//
// Magazine Page Orchestrator - Editorial + Mosaic Design
//
// Two-zone layout:
// Zone 1: Editorial Feature Section (top) - PUBLISHED posts with engagement
// Zone 2: Mosaic Feed (below) - general posted projects
//
// Tight spacing, clear hierarchy, magazine feel

import { getMagazineData } from "@/lib/magazine/getMagazineData";
import { MAGAZINE_EDITIONS } from "@/lib/magazine/editions";
import MagazineEditionCarousel from "./MagazineEditionCarousel";
import MagazineCoverHero from "./MagazineCoverHero";
import EditorialProductCutoutsRail from "./EditorialProductCutoutsRail";
import MagazineMosaicGrid from "./MagazineMosaicGrid";
import { GatheringVoicesSection } from "@/components/contributions";
import { auth } from "@/lib/auth";

interface Props {
  editionSlug: string;
}

export default async function MagazinePage({ editionSlug }: Props) {
  const session = await auth();
  const user = session?.user;
  const data = await getMagazineData(editionSlug, user?.id);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] w-full max-w-[100vw] overflow-hidden">
      {/* Zone 1: Magazine Cover Hero - Full-bleed editorial treatment */}
      {data.hero && (
        <>
          {/* Full-bleed hero - no padding wrapper for true edge-to-edge */}
          <MagazineCoverHero hero={data.hero} edition={data.edition} />

          {/* Featured Products strip - with padding restored below hero */}
          <div className="w-full px-2 sm:px-3 pt-4 md:pt-6 pb-3 md:pb-4">
            <EditorialProductCutoutsRail products={data.heroProducts} />
          </div>
        </>
      )}

      {/* Gathering Voices Section - Show contribution opportunities */}
      <div className="w-full px-4 sm:px-6 py-6 md:py-8 bg-gradient-to-b from-stone-50 to-transparent">
        <div className="max-w-7xl mx-auto">
          <GatheringVoicesSection />
        </div>
      </div>

      {/* Edition selector - positioned between zones */}
      <div className="w-full bg-[var(--bg-base)] border-b border-[var(--ridge-outer)]">
        <div className="px-2 sm:px-3 py-3 md:py-4">
          <MagazineEditionCarousel
            editions={MAGAZINE_EDITIONS}
            activeSlug={data.edition.slug}
          />
        </div>
      </div>

      {/* Zone 2: Mosaic Feed */}
      <div className="w-full px-0 pt-4 md:pt-6 pb-8 md:pb-12">
        <MagazineMosaicGrid items={data.mosaicItems} />
      </div>
    </div>
  );
}


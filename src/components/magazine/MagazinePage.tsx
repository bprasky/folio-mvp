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
        <MagazineCoverHero hero={data.hero} edition={data.edition} />
      )}

      {/* Featured Products — 48px below hero, consistent 12px horizontal padding */}
      {data.hero && data.heroProducts.length > 0 && (
        <div className="w-full px-3 pt-12">
          <EditorialProductCutoutsRail products={data.heroProducts} />
        </div>
      )}

      {/* Gathering Voices — 48px section gap */}
      <div className="w-full px-3 pt-12">
        <GatheringVoicesSection />
      </div>

      {/* Edition selector — 48px section gap */}
      <div className="w-full px-3 pt-12 pb-6">
        <MagazineEditionCarousel
          editions={MAGAZINE_EDITIONS}
          activeSlug={data.edition.slug}
        />
      </div>

      {/* Zone 2: Mosaic Feed — 24px below edition tabs (internal spacing) */}
      <div className="w-full px-3 pb-12">
        <MagazineMosaicGrid items={data.mosaicItems} />
      </div>
    </div>
  );
}


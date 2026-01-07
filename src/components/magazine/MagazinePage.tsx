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
import MagazineHero from "./MagazineHero";
import EditorialProductCutoutsRail from "./EditorialProductCutoutsRail";
import MagazineMosaicGrid from "./MagazineMosaicGrid";
import { auth } from "@/lib/auth";

interface Props {
  editionSlug: string;
}

export default async function MagazinePage({ editionSlug }: Props) {
  const session = await auth();
  const user = session?.user;
  const data = await getMagazineData(editionSlug, user?.id);

  return (
    <div className="min-h-screen bg-[#F6F4F1]">
      {/* Zone 1: Editorial Feature Section */}
      {data.hero && (
        <div className="w-full px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4">
          <div className="mx-auto max-w-7xl">
            {/* Hero editorial card */}
            <MagazineHero hero={data.hero} edition={data.edition} />
            
            {/* Featured Products strip - tightly attached */}
            <div className="mt-2 md:mt-3">
              <EditorialProductCutoutsRail products={data.heroProducts} />
            </div>
          </div>
        </div>
      )}

      {/* Edition selector - positioned between zones */}
      <div className="w-full bg-[#F6F4F1] border-b border-neutral-200/40">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6 md:py-4">
          <MagazineEditionCarousel
            editions={MAGAZINE_EDITIONS}
            activeSlug={data.edition.slug}
          />
        </div>
      </div>

      {/* Zone 2: Mosaic Feed */}
      <div className="w-full px-4 md:px-6 pt-4 md:pt-6 pb-8 md:pb-12">
        <div className="mx-auto max-w-7xl">
          <MagazineMosaicGrid items={data.mosaicItems} />
        </div>
      </div>
    </div>
  );
}


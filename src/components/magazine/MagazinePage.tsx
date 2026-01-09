// src/components/magazine/MagazinePage.tsx
//
// Magazine Page Orchestrator - Editorial + Mosaic Design
//
// Three-zone layout:
// Zone 1: Above the Fold (hero section) - Currently featured content with time-based rotation
// Zone 2: Filter Tabs - All / Projects / Features
// Zone 3: Mosaic Feed (below) - Badged content weighted by type + engagement
//
// Tight spacing, clear hierarchy, magazine feel

import { getMagazineData } from "@/lib/magazine/getMagazineData";
import { MAGAZINE_EDITIONS } from "@/lib/magazine/editions";
import MagazineEditionCarousel from "./MagazineEditionCarousel";
import MagazineHero from "./MagazineHero";
import EditorialProductCutoutsRail from "./EditorialProductCutoutsRail";
import MagazineMosaicGrid from "./MagazineMosaicGrid";
import FilterTabs, { type MagazineFilter } from "./FilterTabs";
import { auth } from "@/lib/auth";
import { getAboveFoldContent } from "@/lib/editorial/aboveFold";

interface Props {
  editionSlug: string;
  filter?: MagazineFilter;
}

export default async function MagazinePage({ editionSlug, filter = "all" }: Props) {
  const session = await auth();
  const user = session?.user;

  // Fetch data in parallel
  const [data, aboveFoldContent] = await Promise.all([
    getMagazineData(editionSlug, user?.id),
    getAboveFoldContent(),
  ]);

  // Get current above-fold placement (if any)
  const currentPlacement = aboveFoldContent[0] ?? null;

  // Filter mosaic items based on filter type
  const filteredMosaicItems = filter === "all"
    ? data.mosaicItems
    : data.mosaicItems.filter((item) => {
        if (filter === "projects") {
          return item.type === "project";
        }
        if (filter === "features") {
          // Features would be non-project types (future: material studies, methods, etc.)
          return item.type !== "project";
        }
        return true;
      });

  return (
    <div className="min-h-screen bg-[#F6F4F1] w-full max-w-[100vw] overflow-hidden">
      {/* Zone 1: Above the Fold Section */}
      {data.hero && (
        <div className="w-full px-2 sm:px-3 pt-4 md:pt-6 pb-3 md:pb-4">
          {/* Hero editorial card with optional placement data */}
          <MagazineHero
            hero={data.hero}
            edition={data.edition}
            placement={currentPlacement}
          />

          {/* Featured Products strip - tightly attached */}
          <div className="mt-2 md:mt-3">
            <EditorialProductCutoutsRail products={data.heroProducts} />
          </div>
        </div>
      )}

      {/* Edition selector and filter tabs - positioned between zones */}
      <div className="w-full bg-[#F6F4F1] border-b border-neutral-200/40">
        <div className="px-2 sm:px-3 py-3 md:py-4">
          {/* Edition carousel */}
          <MagazineEditionCarousel
            editions={MAGAZINE_EDITIONS}
            activeSlug={data.edition.slug}
          />

          {/* Filter tabs below edition selector */}
          <div className="mt-3 md:mt-4">
            <FilterTabs activeFilter={filter} />
          </div>
        </div>
      </div>

      {/* Zone 3: Mosaic Feed */}
      <div className="w-full px-0 pt-4 md:pt-6 pb-8 md:pb-12">
        {filteredMosaicItems.length > 0 ? (
          <MagazineMosaicGrid items={filteredMosaicItems} />
        ) : (
          <div className="text-center py-12 text-neutral-500">
            <p className="text-lg">No content found for this filter.</p>
            <p className="text-sm mt-2">Try selecting a different filter or check back later.</p>
          </div>
        )}
      </div>
    </div>
  );
}


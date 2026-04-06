// src/components/magazine/MagazinePage.tsx
//
// Magazine Page Orchestrator - Editorial + Mosaic Design
//
// Two-zone layout:
// Zone 1: Editorial Feature Section (top) - PUBLISHED posts with engagement
// Zone 2: Smart Filter Chips + Paginated Mosaic Feed (below)
//
// Server Component: fetches initial data for SEO/perf.
// Filter interactions and pagination are handled client-side via MagazineFeedClient.

import { getMagazineData } from "@/lib/magazine/getMagazineData";
import { getFilteredPosts } from "@/lib/magazine/getFilteredPosts";
import MagazineCoverHero from "./MagazineCoverHero";
import EditorialProductCutoutsRail from "./EditorialProductCutoutsRail";
import MagazineFeedClient from "./MagazineFeedClient";
import { GatheringVoicesSection } from "@/components/contributions";
import { PromptedQuestionsSection } from "@/components/prompted-content/PromptedQuestionsSection";
import { auth } from "@/lib/auth";

interface Props {
  editionSlug: string;
}

async function getInitialFilters() {
  try {
    const { prisma } = await import("@/lib/prisma");

    const filters: Array<{
      id: string;
      label: string;
      type: "category" | "keyword" | "location";
      count: number;
    }> = [];

    // SOURCE A: EditorialCategory labels linked to PUBLISHED posts
    const categoryFilters = await prisma.editorialAssignment.groupBy({
      by: ["categoryId"],
      where: { editorial: { status: "PUBLISHED" } },
      _count: { editorialId: true },
      having: { editorialId: { _count: { gte: 2 } } },
    });

    if (categoryFilters.length > 0) {
      const categoryIds = categoryFilters.map((c) => c.categoryId);
      const categories = await prisma.editorialCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, type: true, label: true },
      });
      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      for (const cf of categoryFilters) {
        const cat = categoryMap.get(cf.categoryId);
        if (cat) {
          filters.push({
            id: `cat-${cat.id}`,
            label: toTitleCase(cat.label),
            type: "category",
            count: cf._count.editorialId,
          });
        }
      }
    }

    // SOURCE B: Keywords
    const publishedPosts = await prisma.projectPost.findMany({
      where: { status: "PUBLISHED" },
      select: { keywords: true },
    });
    const keywordCounts = new Map<string, number>();
    for (const post of publishedPosts) {
      for (const kw of post.keywords) {
        keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1);
      }
    }
    const topKeywords = Array.from(keywordCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    for (const [keyword, count] of topKeywords) {
      if (!filters.some((f) => f.label.toLowerCase() === keyword.toLowerCase())) {
        filters.push({
          id: `kw-${keyword.toLowerCase().replace(/\s+/g, "-")}`,
          label: toTitleCase(keyword),
          type: "keyword",
          count,
        });
      }
    }

    // SOURCE C: Locations
    const locationPosts = await prisma.projectPost.findMany({
      where: { status: "PUBLISHED" },
      select: { project: { select: { city: true, regionState: true } } },
    });
    const locationCounts = new Map<string, number>();
    for (const post of locationPosts) {
      const loc = post.project?.city || post.project?.regionState;
      if (loc?.trim()) {
        locationCounts.set(loc.trim(), (locationCounts.get(loc.trim()) || 0) + 1);
      }
    }
    for (const [location, count] of Array.from(locationCounts.entries())
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])) {
      if (!filters.some((f) => f.label.toLowerCase() === location.toLowerCase())) {
        filters.push({
          id: `loc-${location.toLowerCase().replace(/\s+/g, "-")}`,
          label: toTitleCase(location),
          type: "location",
          count,
        });
      }
    }

    filters.sort((a, b) => b.count - a.count);
    return filters.slice(0, 8);
  } catch (error) {
    console.error("[MAGAZINE] Error fetching filters:", error);
    return [];
  }
}

function toTitleCase(str: string): string {
  return str
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default async function MagazinePage({ editionSlug }: Props) {
  const session = await auth();
  const user = session?.user;

  // Fetch hero data (existing), initial feed page, and filters in parallel
  const [data, feedPage, filters] = await Promise.all([
    getMagazineData(editionSlug, user?.id),
    getFilteredPosts({ take: 12 }),
    getInitialFilters(),
  ]);

  return (
    <div className="min-h-screen bg-surface-canvas w-full max-w-[100vw] overflow-hidden">
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

      {/* Prompted Questions — 48px section gap */}
      <div className="w-full px-3 pt-12">
        <PromptedQuestionsSection />
      </div>

      {/* Zone 2: Smart Filters + Paginated Mosaic Feed */}
      <div className="w-full px-3 pt-12 pb-12">
        <MagazineFeedClient
          initialPosts={feedPage.posts}
          initialNextCursor={feedPage.nextCursor}
          initialFilters={filters}
        />
      </div>
    </div>
  );
}

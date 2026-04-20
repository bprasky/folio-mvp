// @idor-allow: public-read reason="Public magazine filter options"
// GET /api/magazine/filters
//
// Derives smart filter chips from real published content.
// Sources (priority order):
//   A. EditorialCategory labels (via EditorialAssignment on PUBLISHED posts)
//   B. ProjectPost.keywords frequency
//   C. Project.city/regionState for geographic filters
//
// Cached for 5 minutes. Never returns 503 — degrades to { filters: [] }.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300; // 5-minute cache

interface SmartFilter {
  id: string;
  label: string;
  type: "category" | "keyword" | "location";
  count: number;
}

export async function GET() {
  try {
    const filters: SmartFilter[] = [];

    // SOURCE A: EditorialCategory labels linked to PUBLISHED posts
    // Single query using groupBy on the join path
    const categoryFilters = await prisma.editorialAssignment.groupBy({
      by: ["categoryId"],
      where: {
        editorial: { status: "PUBLISHED" },
      },
      _count: { editorialId: true },
      having: {
        editorialId: { _count: { gte: 2 } },
      },
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

    // SOURCE B: ProjectPost.keywords frequency
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
      // Avoid duplicating a label that already exists from categories
      const alreadyExists = filters.some(
        (f) => f.label.toLowerCase() === keyword.toLowerCase()
      );
      if (!alreadyExists) {
        filters.push({
          id: `kw-${keyword.toLowerCase().replace(/\s+/g, "-")}`,
          label: toTitleCase(keyword),
          type: "keyword",
          count,
        });
      }
    }

    // SOURCE C: Project.city / regionState for geographic filters
    const locationPosts = await prisma.projectPost.findMany({
      where: { status: "PUBLISHED" },
      select: {
        project: {
          select: { city: true, regionState: true },
        },
      },
    });

    const locationCounts = new Map<string, number>();
    for (const post of locationPosts) {
      const loc = post.project?.city || post.project?.regionState;
      if (loc && loc.trim()) {
        const normalized = loc.trim();
        locationCounts.set(normalized, (locationCounts.get(normalized) || 0) + 1);
      }
    }

    const topLocations = Array.from(locationCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1]);

    for (const [location, count] of topLocations) {
      const alreadyExists = filters.some(
        (f) => f.label.toLowerCase() === location.toLowerCase()
      );
      if (!alreadyExists) {
        filters.push({
          id: `loc-${location.toLowerCase().replace(/\s+/g, "-")}`,
          label: toTitleCase(location),
          type: "location",
          count,
        });
      }
    }

    // Sort by count descending, limit to 8
    filters.sort((a, b) => b.count - a.count);
    const result = filters.slice(0, 8);

    return NextResponse.json({ filters: result });
  } catch (error) {
    console.error("[MAGAZINE FILTERS] Error deriving filters:", error);
    return NextResponse.json({ filters: [] }, { status: 200 });
  }
}

function toTitleCase(str: string): string {
  return str
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

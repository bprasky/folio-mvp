// src/app/api/magazine/feed/route.ts
//
// Magazine Feed API
//
// GET - Get filtered and weighted magazine feed
// Query params:
//   - filter: "all" | "projects" | "features" (default: "all")
//   - page: number (default: 1)
//   - limit: number (default: 20, max: 50)

import { NextRequest, NextResponse } from "next/server";
import {
  getMagazineFeed,
  getTrendingFeed,
  type MagazineFilter,
} from "@/lib/feed/magazineFeed";

const VALID_FILTERS: MagazineFilter[] = ["all", "projects", "features"];
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

/**
 * GET /api/magazine/feed
 * Returns paginated, filtered, and weighted magazine feed
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filter
    const filterParam = searchParams.get("filter") ?? "all";
    const filter: MagazineFilter = VALID_FILTERS.includes(
      filterParam as MagazineFilter
    )
      ? (filterParam as MagazineFilter)
      : "all";

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10))
    );

    // Check for trending mode
    const trending = searchParams.get("trending") === "true";

    if (trending) {
      const items = await getTrendingFeed(limit);
      return NextResponse.json({
        success: true,
        data: {
          items,
          total: items.length,
          page: 1,
          totalPages: 1,
          filter: "trending",
        },
      });
    }

    const result = await getMagazineFeed(filter, page, limit);
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        filter,
      },
    });
  } catch (error) {
    console.error("[API] Error getting magazine feed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get magazine feed" },
      { status: 500 }
    );
  }
}

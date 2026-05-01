// @idor-allow: public-read reason="Public homepage feed; Following filter scoped to caller's userId"
//
// Homepage Editorial Elevation Feed (Task 05)
//
// GET /api/homepage-feed?filter=following&cursor=...
//
// Used by the client-side filter chip row + mosaic pagination on `/`. The
// initial-render data is computed server-side in the page component (no HTTP
// hop); this route exists for filter-switch and "load more" interactions.
//
// Cache:
//   - Anonymous (no Following): public, s-maxage=60, stale-while-revalidate=300
//   - Authenticated with Following filter: private, no-store (per-user shape)
//
// Boost impressions are emitted from the client (BoostReel.tsx with
// IntersectionObserver) — never from this route.

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getHomepageData } from "@/lib/homepage/getHomepageData";
import type { FeedFilter } from "@/lib/magazine/getFilteredPosts";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const filterType = url.searchParams.get("filterType");
  const filterValue = url.searchParams.get("filterValue");
  const cursor = url.searchParams.get("cursor");
  const followingOnly = url.searchParams.get("following") === "true";

  let filter: FeedFilter | null = null;
  if (filterType && filterValue && (filterType === "category" || filterType === "keyword" || filterType === "location")) {
    filter = { type: filterType, value: filterValue };
  }

  // Following filter requires a session; otherwise fall through to anonymous shape.
  let userId: string | null = null;
  if (followingOnly) {
    const session = await auth();
    userId = session?.user?.id ?? null;
  }

  const data = await getHomepageData({
    userId,
    filter,
    followingOnly: followingOnly && !!userId,
    cursor,
  });

  const headers: Record<string, string> = {};
  if (followingOnly && userId) {
    headers["Cache-Control"] = "private, no-store";
  } else {
    headers["Cache-Control"] = "public, s-maxage=60, stale-while-revalidate=300";
  }

  return NextResponse.json(data, { headers });
}

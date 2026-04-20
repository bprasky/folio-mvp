// @idor-allow: public-read reason="Public magazine post listings"
// GET /api/magazine/posts
//
// Paginated, filterable feed endpoint.
// Query params:
//   - filter (optional): JSON { type: 'category'|'keyword'|'location', value: string }
//   - cursor (optional): post id for cursor-based pagination
//   - take (optional): page size (default 12, max 24)
//
// Never returns 503 — catches all errors and returns empty posts array.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFilteredPosts } from "@/lib/magazine/getFilteredPosts";

const filterSchema = z.object({
  type: z.enum(["category", "keyword", "location"]),
  value: z.string().min(1),
});

const querySchema = z.object({
  filter: z.string().optional(),
  cursor: z.string().optional(),
  take: z.coerce.number().int().min(1).max(24).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const raw = {
      filter: searchParams.get("filter") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      take: searchParams.get("take") ?? undefined,
    };

    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ posts: [], nextCursor: null }, { status: 200 });
    }

    let filter = null;
    if (parsed.data.filter) {
      try {
        const filterParsed = filterSchema.safeParse(JSON.parse(parsed.data.filter));
        if (filterParsed.success) {
          filter = filterParsed.data;
        }
      } catch {
        // Invalid JSON — treat as no filter
      }
    }

    const result = await getFilteredPosts({
      filter,
      cursor: parsed.data.cursor ?? null,
      take: parsed.data.take ?? 12,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[MAGAZINE POSTS] Error fetching posts:", error);
    return NextResponse.json({ posts: [], nextCursor: null }, { status: 200 });
  }
}

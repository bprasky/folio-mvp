import { NextRequest, NextResponse } from "next/server";
import {
  getBadgesForContent,
  getBadgeDisplay,
  type ContentType,
} from "@/lib/editorial/badges";

// [Edition System] Get badges for content API

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("contentId");
    const contentType = searchParams.get("contentType") as ContentType | null;

    if (!contentId) {
      return NextResponse.json(
        { error: "contentId is required" },
        { status: 400 }
      );
    }

    if (!contentType || !["projectPost", "feature"].includes(contentType)) {
      return NextResponse.json(
        { error: "contentType must be 'projectPost' or 'feature'" },
        { status: 400 }
      );
    }

    const badges = await getBadgesForContent(contentId, contentType);
    const display = await getBadgeDisplay(contentId, contentType);

    return NextResponse.json({
      badges,
      display,
    });
  } catch (error) {
    console.error("[API] GET /api/editions/badges error:", error);
    return NextResponse.json(
      { error: "Failed to fetch badges" },
      { status: 500 }
    );
  }
}

// src/app/api/magazine/above-fold/route.ts
//
// Above the Fold API
//
// GET - Get current above fold content
// POST - Add content to above fold queue (admin only)
// PATCH - Track engagement for a placement

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getAboveFoldContent,
  addToAboveFold,
  trackAboveFoldEngagement,
  rotateAboveFold,
} from "@/lib/editorial/aboveFold";

/**
 * GET /api/magazine/above-fold
 * Returns currently featured above-fold content
 */
export async function GET() {
  try {
    const content = await getAboveFoldContent();
    return NextResponse.json({ success: true, data: content });
  } catch (error) {
    console.error("[API] Error getting above fold content:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get above fold content" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/magazine/above-fold
 * Add content to the above fold queue
 * Body: { contentId: string, contentType: "projectPost", windowHours?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // For now, allow any authenticated user (can be restricted to admin later)
    const body = await request.json();
    const { contentId, contentType, windowHours } = body;

    if (!contentId || !contentType) {
      return NextResponse.json(
        { success: false, error: "Missing contentId or contentType" },
        { status: 400 }
      );
    }

    if (contentType !== "projectPost") {
      return NextResponse.json(
        { success: false, error: "Invalid contentType. Must be 'projectPost'" },
        { status: 400 }
      );
    }

    const result = await addToAboveFold(contentId, contentType, windowHours);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[API] Error adding to above fold:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add to above fold" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/magazine/above-fold
 * Track engagement or trigger rotation
 * Body: { action: "track", placementId: string, type: "view" | "save" | "share" }
 *    or { action: "rotate" }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "track") {
      const { placementId, type } = body;
      if (!placementId || !type) {
        return NextResponse.json(
          { success: false, error: "Missing placementId or type" },
          { status: 400 }
        );
      }

      if (!["view", "save", "share"].includes(type)) {
        return NextResponse.json(
          { success: false, error: "Invalid type. Must be view, save, or share" },
          { status: 400 }
        );
      }

      await trackAboveFoldEngagement(placementId, type);
      return NextResponse.json({ success: true });
    }

    if (action === "rotate") {
      // Rotation can be triggered manually (useful for testing) or by cron
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }

      const result = await rotateAboveFold();
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[API] Error in above fold PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}

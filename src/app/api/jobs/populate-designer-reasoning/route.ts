export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import {
  populateDesignerReasoning,
  populateAllDesignerReasoning,
} from "@/lib/atelier/extractDesignerReasoning";

/**
 * POST /api/jobs/populate-designer-reasoning
 *
 * Triggers population of designer reasoning profiles.
 * Can target a specific designer or all designers.
 *
 * Body:
 * - designerId?: string - Specific designer to process
 * - all?: boolean - Process all designers
 *
 * Requires ADMIN role.
 */
export async function POST(req: NextRequest) {
  try {
    // Check admin access
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { designerId, all } = body;

    if (all) {
      // Process all designers (async, returns immediately)
      populateAllDesignerReasoning().catch((err) => {
        console.error("Error in batch population:", err);
      });

      return NextResponse.json({
        message: "Batch population started for all designers",
        status: "processing",
      });
    }

    if (designerId) {
      // Process single designer
      await populateDesignerReasoning(designerId);

      // Return updated profile
      const profile = await prisma.designerReasoningProfile.findUnique({
        where: { userId: designerId },
      });

      return NextResponse.json({
        message: "Designer reasoning profile populated",
        profile,
      });
    }

    return NextResponse.json(
      { error: "Provide designerId or set all: true" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error populating designer reasoning:", error);
    return NextResponse.json(
      { error: error?.message || "Population failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jobs/populate-designer-reasoning
 *
 * Get status of designer reasoning profiles.
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin access
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get counts
    const totalDesigners = await prisma.user.count({
      where: { role: "DESIGNER" },
    });

    const profilesPopulated = await prisma.designerReasoningProfile.count();

    const highConfidenceProfiles = await prisma.designerReasoningProfile.count({
      where: { confidenceScore: { gte: 0.5 } },
    });

    const lowConfidenceProfiles = await prisma.designerReasoningProfile.count({
      where: { confidenceScore: { lt: 0.5 } },
    });

    // Get recent profiles
    const recentProfiles = await prisma.designerReasoningProfile.findMany({
      orderBy: { lastComputedAt: "desc" },
      take: 10,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      totalDesigners,
      profilesPopulated,
      profilesMissing: totalDesigners - profilesPopulated,
      highConfidenceProfiles,
      lowConfidenceProfiles,
      recentProfiles: recentProfiles.map((p) => ({
        designerId: p.userId,
        designerName: p.user.name,
        confidenceScore: p.confidenceScore,
        dataSourcesUsed: p.dataSourcesUsed,
        lastComputedAt: p.lastComputedAt,
      })),
    });
  } catch (error: any) {
    console.error("Error getting reasoning profile status:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to get status" },
      { status: 500 }
    );
  }
}

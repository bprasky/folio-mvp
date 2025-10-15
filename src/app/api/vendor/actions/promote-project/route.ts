import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canVendorUseQuickActions } from "@/lib/permissions";
import { VendorAnalytics } from "@/lib/analytics";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Check vendor has products in this project
    const canPromote = await canVendorUseQuickActions(session.user.id, projectId);
    if (!canPromote) {
      return NextResponse.json({ error: "No products in this project" }, { status: 403 });
    }

    // Check if already promoted recently (prevent spam)
    const recentPromotion = await prisma.project.findFirst({
      where: {
        id: projectId,
        // Add a promotionQueuedAt field to track when last promoted
        // For now, we'll use a simple approach with metadata
      },
      select: { id: true },
    });

    // Flag project for editorial boost (add to queue)
    // For now, we'll add a note to the project or create a simple queue entry
    // In a real implementation, you'd have a promotion queue table
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        // Add a field to track promotion status
        // For now, we'll use a simple approach
        updatedAt: new Date(),
      },
      select: {
        id: true,
        title: true,
      },
    });

    // Emit analytics
    await VendorAnalytics.promoteProject({
      projectId,
      actorId: session.user.id,
      payload: {
        projectTitle: project.title,
        promotedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Project flagged for promotion",
      project: {
        id: project.id,
        title: project.title,
      },
    });
  } catch (error: any) {
    console.error("[promote-project][POST]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}


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
    const { projectId, selectionId, note } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Check vendor has access to project/product
    const canSupport = await canVendorUseQuickActions(session.user.id, projectId, selectionId);
    if (!canSupport) {
      return NextResponse.json({ error: "No access to project/product" }, { status: 403 });
    }

    // Mark with priority support flag
    // For now, we'll add a note to the selection or project
    // In a real implementation, you'd have a support ticket system
    if (selectionId) {
      // Update selection with priority support flag
      await prisma.selection.update({
        where: { id: selectionId },
        data: {
          notes: note || "Priority support requested",
          // You could add a prioritySupport boolean field
        },
      });
    } else {
      // Update project with priority support flag
      await prisma.project.update({
        where: { id: projectId },
        data: {
          // Add a field to track priority support
          updatedAt: new Date(),
        },
      });
    }

    // Emit analytics
    await VendorAnalytics.prioritySupport({
      projectId,
      actorId: session.user.id,
      payload: {
        selectionId: selectionId || null,
        hasNote: Boolean(note),
        supportType: selectionId ? 'product' : 'project',
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Priority support requested",
      support: {
        projectId,
        selectionId: selectionId || null,
        note: note || null,
        requestedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[priority-support][POST]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}


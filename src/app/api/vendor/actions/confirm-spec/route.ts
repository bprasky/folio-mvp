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
    const { projectId, productId, changeType, message, altProductId } = body;

    if (!projectId || !changeType) {
      return NextResponse.json({ error: "Project ID and change type required" }, { status: 400 });
    }

    // Validate change type
    const validChangeTypes = ['low_stock', 'discontinued', 'alt_suggested'];
    if (!validChangeTypes.includes(changeType)) {
      return NextResponse.json({ error: "Invalid change type" }, { status: 400 });
    }

    // Check vendor has access to project/product
    const canConfirm = await canVendorUseQuickActions(session.user.id, projectId, productId);
    if (!canConfirm) {
      return NextResponse.json({ error: "No access to project/product" }, { status: 403 });
    }

    // Add system note to project's spec log
    // For now, we'll add a note to the selection or project
    // In a real implementation, you'd have a spec change log table
    const specNote = {
      type: 'vendor_confirmation',
      changeType,
      message: message || null,
      altProductId: altProductId || null,
      vendorId: session.user.id,
      timestamp: new Date().toISOString(),
    };

    if (productId) {
      // Update selection with spec change note
      await prisma.selection.update({
        where: { id: productId },
        data: {
          notes: JSON.stringify(specNote),
        },
      });
    } else {
      // Update project with spec change note
      await prisma.project.update({
        where: { id: projectId },
        data: {
          // Add a field to track spec changes
          updatedAt: new Date(),
        },
      });
    }

    // Emit analytics
    await VendorAnalytics.confirmSpec({
      projectId,
      actorId: session.user.id,
      payload: {
        productId: productId || null,
        changeType,
        hasMessage: Boolean(message),
        altProductId: altProductId || null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Spec change confirmed",
      specChange: {
        projectId,
        productId: productId || null,
        changeType,
        message: message || null,
        altProductId: altProductId || null,
        confirmedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[confirm-spec][POST]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}


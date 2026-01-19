export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

type Params = { params: { developmentId: string; designerId: string } };

/**
 * PATCH /api/developments/[developmentId]/designers/[designerId]
 *
 * Updates a designer's settings in the pool.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { developmentId, designerId } = params;
    const body = await req.json();

    const existing = await prisma.developmentDesigner.findUnique({
      where: {
        developmentId_designerId: {
          developmentId,
          designerId,
        },
      },
      include: { development: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Designer not in pool" }, { status: 404 });
    }

    if (user.role !== 'ADMIN') {
      const hasAccess = await prisma.organizationUser.findFirst({
        where: {
          userId: user.id,
          organizationId: existing.development.developerOrgId,
          isActive: true,
        },
      });
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updateData: any = {};

    if (body.consultationFeeShare !== undefined) {
      if (body.consultationFeeShare < 0 || body.consultationFeeShare > 1) {
        return NextResponse.json(
          { error: "consultationFeeShare must be between 0 and 1" },
          { status: 400 }
        );
      }
      updateData.consultationFeeShare = body.consultationFeeShare;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    const developmentDesigner = await prisma.developmentDesigner.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            studio: true,
          },
        },
      },
    });

    return NextResponse.json({ developmentDesigner });

  } catch (error: any) {
    console.error("Error updating designer in pool:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update designer" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/developments/[developmentId]/designers/[designerId]
 *
 * Removes a designer from the pool (soft-delete by setting isActive=false).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { developmentId, designerId } = params;
    const searchParams = req.nextUrl.searchParams;
    const hardDelete = searchParams.get('hard') === 'true';

    const existing = await prisma.developmentDesigner.findUnique({
      where: {
        developmentId_designerId: {
          developmentId,
          designerId,
        },
      },
      include: { development: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Designer not in pool" }, { status: 404 });
    }

    if (user.role !== 'ADMIN') {
      const hasAccess = await prisma.organizationUser.findFirst({
        where: {
          userId: user.id,
          organizationId: existing.development.developerOrgId,
          isActive: true,
        },
      });
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Check for consultations
    const consultationCount = await prisma.consultation.count({
      where: { developmentId, designerId },
    });

    if (hardDelete) {
      if (consultationCount > 0) {
        return NextResponse.json(
          { error: "Cannot hard delete - designer has consultations. Use soft delete." },
          { status: 400 }
        );
      }

      await prisma.developmentDesigner.delete({
        where: { id: existing.id },
      });

      return NextResponse.json({ success: true, message: "Designer removed from pool" });
    }

    // Soft delete
    await prisma.developmentDesigner.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "Designer deactivated in pool",
      consultationsPreserved: consultationCount,
    });

  } catch (error: any) {
    console.error("Error removing designer from pool:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to remove designer" },
      { status: 500 }
    );
  }
}

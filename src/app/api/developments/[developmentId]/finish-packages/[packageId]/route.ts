export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

type Params = { params: { developmentId: string; packageId: string } };

/**
 * PATCH /api/developments/[developmentId]/finish-packages/[packageId]
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { developmentId, packageId } = params;
    const body = await req.json();

    const existing = await prisma.finishPackage.findFirst({
      where: { id: packageId, developmentId },
      include: { development: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Finish package not found" }, { status: 404 });
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
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.priceDeltaCents !== undefined) updateData.priceDeltaCents = body.priceDeltaCents;
    if (body.heroImageUrl !== undefined) updateData.heroImageUrl = body.heroImageUrl;

    // Handle default selections update
    if (body.defaultSelections !== undefined) {
      // Delete existing and recreate
      await prisma.finishPackageDefault.deleteMany({
        where: { finishPackageId: packageId },
      });

      if (body.defaultSelections.length > 0) {
        await prisma.finishPackageDefault.createMany({
          data: body.defaultSelections.map((sel: any) => ({
            finishPackageId: packageId,
            slotKey: sel.slotKey,
            roomType: sel.roomType,
            developmentProductId: sel.developmentProductId,
          })),
        });
      }
    }

    const finishPackage = await prisma.finishPackage.update({
      where: { id: packageId },
      data: updateData,
      include: {
        defaultSelections: {
          include: {
            developmentProduct: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ finishPackage });

  } catch (error: any) {
    console.error("Error updating finish package:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update finish package" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/developments/[developmentId]/finish-packages/[packageId]
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { developmentId, packageId } = params;

    const existing = await prisma.finishPackage.findFirst({
      where: { id: packageId, developmentId },
      include: {
        development: true,
        _count: { select: { consultations: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Finish package not found" }, { status: 404 });
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

    if (existing._count.consultations > 0) {
      return NextResponse.json(
        { error: "Cannot delete finish package with existing consultations" },
        { status: 400 }
      );
    }

    await prisma.finishPackage.delete({
      where: { id: packageId },
    });

    return NextResponse.json({ success: true, message: "Finish package deleted" });

  } catch (error: any) {
    console.error("Error deleting finish package:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete finish package" },
      { status: 500 }
    );
  }
}

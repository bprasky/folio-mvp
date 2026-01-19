export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

type Params = { params: { developmentId: string; unitTypeId: string } };

/**
 * GET /api/developments/[developmentId]/unit-types/[unitTypeId]
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { developmentId, unitTypeId } = params;

    const unitType = await prisma.unitType.findFirst({
      where: {
        id: unitTypeId,
        developmentId,
      },
      include: {
        rooms: {
          include: {
            finishSlots: true,
          },
        },
        consultations: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: { consultations: true },
        },
      },
    });

    if (!unitType) {
      return NextResponse.json({ error: "Unit type not found" }, { status: 404 });
    }

    return NextResponse.json({ unitType });

  } catch (error: any) {
    console.error("Error fetching unit type:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch unit type" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/developments/[developmentId]/unit-types/[unitTypeId]
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { developmentId, unitTypeId } = params;
    const body = await req.json();

    // Verify unit type exists and user has access
    const existing = await prisma.unitType.findFirst({
      where: { id: unitTypeId, developmentId },
      include: { development: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Unit type not found" }, { status: 404 });
    }

    // Check access
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

    // Build update data
    const updateData: any = {};
    const allowedFields = ['name', 'squareFootage', 'bedrooms', 'bathrooms', 'basePriceCents', 'floorPlanUrl'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Handle code change (check uniqueness)
    if (body.code && body.code !== existing.code) {
      const codeExists = await prisma.unitType.findUnique({
        where: {
          developmentId_code: {
            developmentId,
            code: body.code,
          },
        },
      });
      if (codeExists) {
        return NextResponse.json({ error: "Unit type code already exists" }, { status: 409 });
      }
      updateData.code = body.code;
    }

    const unitType = await prisma.unitType.update({
      where: { id: unitTypeId },
      data: updateData,
      include: {
        rooms: {
          include: {
            finishSlots: true,
          },
        },
      },
    });

    return NextResponse.json({ unitType });

  } catch (error: any) {
    console.error("Error updating unit type:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update unit type" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/developments/[developmentId]/unit-types/[unitTypeId]
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { developmentId, unitTypeId } = params;

    // Verify unit type exists and user has access
    const existing = await prisma.unitType.findFirst({
      where: { id: unitTypeId, developmentId },
      include: {
        development: true,
        _count: { select: { consultations: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Unit type not found" }, { status: 404 });
    }

    // Check access
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

    // Prevent deletion if consultations exist
    if (existing._count.consultations > 0) {
      return NextResponse.json(
        { error: "Cannot delete unit type with existing consultations" },
        { status: 400 }
      );
    }

    // Delete (cascade will handle rooms and slots)
    await prisma.unitType.delete({
      where: { id: unitTypeId },
    });

    return NextResponse.json({ success: true, message: "Unit type deleted" });

  } catch (error: any) {
    console.error("Error deleting unit type:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete unit type" },
      { status: 500 }
    );
  }
}

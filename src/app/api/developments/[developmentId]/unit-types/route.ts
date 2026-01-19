export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

type Params = { params: { developmentId: string } };

/**
 * Helper to check if user has access to development
 */
async function checkDevelopmentAccess(userId: string, developmentId: string, isAdmin: boolean) {
  const development = await prisma.development.findUnique({
    where: { id: developmentId },
    select: { id: true, developerOrgId: true },
  });

  if (!development) return { error: "Development not found", status: 404 };

  if (!isAdmin) {
    const hasAccess = await prisma.organizationUser.findFirst({
      where: {
        userId,
        organizationId: development.developerOrgId,
        isActive: true,
      },
    });
    if (!hasAccess) return { error: "Forbidden", status: 403 };
  }

  return { development };
}

/**
 * POST /api/developments/[developmentId]/unit-types
 *
 * Creates a new unit type for a development.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { developmentId } = params;
    const body = await req.json();

    // Check access
    const access = await checkDevelopmentAccess(user.id, developmentId, user.role === 'ADMIN');
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const {
      name,
      code,
      squareFootage,
      bedrooms,
      bathrooms,
      basePriceCents,
      floorPlanUrl,
      rooms = [], // Array of { name, type, finishSlots: [{ key, label, category, isCustomizable }] }
    } = body;

    // Validate required fields
    if (!name || !code || bedrooms === undefined || bathrooms === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: name, code, bedrooms, bathrooms" },
        { status: 400 }
      );
    }

    // Check code uniqueness within development
    const existingCode = await prisma.unitType.findUnique({
      where: {
        developmentId_code: {
          developmentId,
          code,
        },
      },
    });

    if (existingCode) {
      return NextResponse.json(
        { error: "Unit type code already exists in this development" },
        { status: 409 }
      );
    }

    // Create unit type with rooms and slots in a transaction
    const unitType = await prisma.unitType.create({
      data: {
        developmentId,
        name,
        code,
        squareFootage,
        bedrooms,
        bathrooms,
        basePriceCents,
        floorPlanUrl,
        rooms: {
          create: rooms.map((room: any) => ({
            name: room.name,
            type: room.type,
            finishSlots: {
              create: (room.finishSlots || []).map((slot: any) => ({
                key: slot.key,
                label: slot.label,
                category: slot.category,
                isCustomizable: slot.isCustomizable ?? true,
              })),
            },
          })),
        },
      },
      include: {
        rooms: {
          include: {
            finishSlots: true,
          },
        },
      },
    });

    return NextResponse.json({ unitType }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating unit type:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create unit type" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/developments/[developmentId]/unit-types
 *
 * Lists all unit types for a development.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { developmentId } = params;

    // Check development exists and is accessible
    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      select: { id: true, publishedAt: true, developerOrgId: true },
    });

    if (!development) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }

    // For unpublished developments, check auth
    if (!development.publishedAt) {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user = session.user as { id: string; role: string };
      if (user.role !== 'ADMIN') {
        const hasAccess = await prisma.organizationUser.findFirst({
          where: {
            userId: user.id,
            organizationId: development.developerOrgId,
            isActive: true,
          },
        });
        if (!hasAccess) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const unitTypes = await prisma.unitType.findMany({
      where: { developmentId },
      include: {
        rooms: {
          include: {
            finishSlots: true,
          },
        },
        _count: {
          select: { consultations: true },
        },
      },
      orderBy: [{ bedrooms: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ unitTypes });

  } catch (error: any) {
    console.error("Error listing unit types:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to list unit types" },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { FinishPackageTier } from "@prisma/client";

type Params = { params: { developmentId: string } };

/**
 * POST /api/developments/[developmentId]/finish-packages
 *
 * Creates a new finish package for a development.
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

    // Check development access
    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      select: { id: true, developerOrgId: true },
    });

    if (!development) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }

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

    const {
      name,
      tier,
      description,
      priceDeltaCents = 0,
      heroImageUrl,
      defaultSelections = [], // Array of { slotKey, roomType, developmentProductId }
    } = body;

    if (!name || !tier) {
      return NextResponse.json(
        { error: "Missing required fields: name, tier" },
        { status: 400 }
      );
    }

    // Validate tier
    if (!Object.values(FinishPackageTier).includes(tier)) {
      return NextResponse.json(
        { error: `Invalid tier. Must be one of: ${Object.values(FinishPackageTier).join(', ')}` },
        { status: 400 }
      );
    }

    // Check tier uniqueness
    const existingTier = await prisma.finishPackage.findUnique({
      where: {
        developmentId_tier: {
          developmentId,
          tier,
        },
      },
    });

    if (existingTier) {
      return NextResponse.json(
        { error: "A package with this tier already exists for this development" },
        { status: 409 }
      );
    }

    // Create package with defaults
    const finishPackage = await prisma.finishPackage.create({
      data: {
        developmentId,
        name,
        tier,
        description,
        priceDeltaCents,
        heroImageUrl,
        defaultSelections: {
          create: defaultSelections.map((sel: any) => ({
            slotKey: sel.slotKey,
            roomType: sel.roomType,
            developmentProductId: sel.developmentProductId,
          })),
        },
      },
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

    return NextResponse.json({ finishPackage }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating finish package:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create finish package" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/developments/[developmentId]/finish-packages
 *
 * Lists all finish packages for a development.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { developmentId } = params;

    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      select: { id: true, publishedAt: true, developerOrgId: true },
    });

    if (!development) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }

    // For unpublished, check auth
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

    const finishPackages = await prisma.finishPackage.findMany({
      where: { developmentId },
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
                    brand: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { consultations: true },
        },
      },
      orderBy: { tier: 'asc' },
    });

    return NextResponse.json({ finishPackages });

  } catch (error: any) {
    console.error("Error listing finish packages:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to list finish packages" },
      { status: 500 }
    );
  }
}

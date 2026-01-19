export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

type Params = { params: { developmentId: string } };

/**
 * POST /api/developments/[developmentId]/designers
 *
 * Adds a designer to the development's consultation pool.
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

    const { designerId, consultationFeeShare = 0.7 } = body;

    if (!designerId) {
      return NextResponse.json({ error: "designerId is required" }, { status: 400 });
    }

    // Verify designer exists and is a DESIGNER role
    const designer = await prisma.user.findUnique({
      where: { id: designerId },
      select: { id: true, role: true, name: true },
    });

    if (!designer) {
      return NextResponse.json({ error: "Designer not found" }, { status: 404 });
    }

    if (designer.role !== 'DESIGNER') {
      return NextResponse.json(
        { error: "User must have DESIGNER role to be added to pool" },
        { status: 400 }
      );
    }

    // Check if designer already in pool
    const existing = await prisma.developmentDesigner.findUnique({
      where: {
        developmentId_designerId: {
          developmentId,
          designerId,
        },
      },
    });

    if (existing) {
      // Reactivate if inactive
      if (!existing.isActive) {
        const updated = await prisma.developmentDesigner.update({
          where: { id: existing.id },
          data: { isActive: true, consultationFeeShare },
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
        return NextResponse.json({ developmentDesigner: updated });
      }
      return NextResponse.json(
        { error: "Designer already in pool" },
        { status: 409 }
      );
    }

    // Validate fee share
    if (consultationFeeShare < 0 || consultationFeeShare > 1) {
      return NextResponse.json(
        { error: "consultationFeeShare must be between 0 and 1" },
        { status: 400 }
      );
    }

    const developmentDesigner = await prisma.developmentDesigner.create({
      data: {
        developmentId,
        designerId,
        consultationFeeShare,
        isActive: true,
      },
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            studio: true,
            bio: true,
          },
        },
      },
    });

    return NextResponse.json({ developmentDesigner }, { status: 201 });

  } catch (error: any) {
    console.error("Error adding designer to pool:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to add designer" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/developments/[developmentId]/designers
 *
 * Lists all designers in the development's consultation pool.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { developmentId } = params;
    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      select: { id: true, publishedAt: true },
    });

    if (!development) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }

    const where: any = { developmentId };
    if (!includeInactive) {
      where.isActive = true;
    }

    const designers = await prisma.developmentDesigner.findMany({
      where,
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            studio: true,
            bio: true,
            specialties: true,
            subscriptionTier: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch fingerprint info for each designer
    const designersWithFingerprint = await Promise.all(
      designers.map(async (dd) => {
        const fingerprint = await prisma.atelierFingerprint.findFirst({
          where: { designerId: dd.designerId, ownerType: 'DESIGNER' },
          select: { id: true, completeness: true, lastComputedAt: true },
        });

        const consultationCount = await prisma.consultation.count({
          where: { designerId: dd.designerId, developmentId },
        });

        return {
          ...dd,
          fingerprint,
          consultationCount,
        };
      })
    );

    return NextResponse.json({ designers: designersWithFingerprint });

  } catch (error: any) {
    console.error("Error listing designer pool:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to list designers" },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { ConsultationStatus } from "@prisma/client";

/**
 * POST /api/consultations
 *
 * Creates a new consultation session for a buyer with a designer's Atelier.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();

    const {
      developmentId,
      unitTypeId,
      finishPackageId,
      designerId,
      buyerEmail,
      buyerName,
      buyerPhone,
    } = body;

    // Validate required fields
    if (!developmentId || !unitTypeId || !finishPackageId || !designerId) {
      return NextResponse.json(
        { error: "Missing required fields: developmentId, unitTypeId, finishPackageId, designerId" },
        { status: 400 }
      );
    }

    if (!buyerEmail || !buyerName) {
      return NextResponse.json(
        { error: "Missing required buyer fields: buyerEmail, buyerName" },
        { status: 400 }
      );
    }

    // Validate development exists and is published
    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      select: {
        id: true,
        name: true,
        publishedAt: true,
        status: true,
      },
    });

    if (!development) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }

    if (!development.publishedAt) {
      return NextResponse.json(
        { error: "Development is not yet published" },
        { status: 400 }
      );
    }

    // Validate unit type belongs to development
    const unitType = await prisma.unitType.findFirst({
      where: { id: unitTypeId, developmentId },
    });

    if (!unitType) {
      return NextResponse.json(
        { error: "Unit type not found in this development" },
        { status: 404 }
      );
    }

    // Validate finish package belongs to development
    const finishPackage = await prisma.finishPackage.findFirst({
      where: { id: finishPackageId, developmentId },
    });

    if (!finishPackage) {
      return NextResponse.json(
        { error: "Finish package not found in this development" },
        { status: 404 }
      );
    }

    // Validate designer is in the development's pool and active
    const developmentDesigner = await prisma.developmentDesigner.findFirst({
      where: {
        developmentId,
        designerId,
        isActive: true,
      },
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });

    if (!developmentDesigner) {
      return NextResponse.json(
        { error: "Designer not available in this development" },
        { status: 404 }
      );
    }

    // Find or create consultation buyer
    let buyer = await prisma.consultationBuyer.findUnique({
      where: { email: buyerEmail },
    });

    if (!buyer) {
      // Generate session token for lightweight auth
      const sessionToken = generateSessionToken();
      const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      buyer = await prisma.consultationBuyer.create({
        data: {
          email: buyerEmail,
          name: buyerName,
          phone: buyerPhone,
          sessionToken,
          sessionExpiresAt,
        },
      });
    } else {
      // Update buyer info if needed
      if (buyer.name !== buyerName || buyer.phone !== buyerPhone) {
        buyer = await prisma.consultationBuyer.update({
          where: { id: buyer.id },
          data: {
            name: buyerName,
            phone: buyerPhone,
          },
        });
      }
    }

    // Create the consultation
    const consultation = await prisma.consultation.create({
      data: {
        developmentId,
        unitTypeId,
        finishPackageId,
        designerId,
        buyerId: buyer.id,
        status: ConsultationStatus.DRAFT,
        totalUpgradeCents: 0,
      },
      include: {
        development: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        unitType: {
          select: {
            id: true,
            name: true,
            bedroomCount: true,
            bathroomCount: true,
          },
        },
        finishPackage: {
          select: {
            id: true,
            name: true,
            tier: true,
            priceDeltaCents: true,
          },
        },
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            studio: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      consultation,
      buyerSessionToken: buyer.sessionToken,
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating consultation:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create consultation" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/consultations
 *
 * Lists consultations. Filters by role:
 * - ADMIN: all consultations
 * - DESIGNER: own consultations
 * - DEVELOPER org: consultations for their developments
 * - Buyer (via session token): own consultations
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const buyerToken = searchParams.get('buyerToken');
    const developmentId = searchParams.get('developmentId');
    const designerId = searchParams.get('designerId');
    const status = searchParams.get('status') as ConsultationStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause based on auth context
    const where: any = {};

    // If buyer token provided, filter by buyer
    if (buyerToken) {
      const buyer = await prisma.consultationBuyer.findFirst({
        where: {
          sessionToken: buyerToken,
          sessionExpiresAt: { gt: new Date() },
        },
      });

      if (!buyer) {
        return NextResponse.json({ error: "Invalid or expired buyer session" }, { status: 401 });
      }

      where.buyerId = buyer.id;
    } else {
      // Check authenticated user
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user = session.user as { id: string; role: string };

      if (user.role === 'DESIGNER') {
        where.designerId = user.id;
      } else if (user.role !== 'ADMIN') {
        // For non-admin, non-designer users, check org membership
        const userOrgs = await prisma.organizationUser.findMany({
          where: { userId: user.id, isActive: true },
          select: { organizationId: true },
        });

        if (userOrgs.length === 0) {
          return NextResponse.json({ consultations: [], total: 0 });
        }

        // Get developments for these orgs
        const developments = await prisma.development.findMany({
          where: {
            developerOrgId: { in: userOrgs.map(o => o.organizationId) },
          },
          select: { id: true },
        });

        where.developmentId = { in: developments.map(d => d.id) };
      }
    }

    // Apply additional filters
    if (developmentId) {
      where.developmentId = developmentId;
    }

    if (designerId) {
      where.designerId = designerId;
    }

    if (status) {
      where.status = status;
    }

    const [consultations, total] = await Promise.all([
      prisma.consultation.findMany({
        where,
        include: {
          development: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          unitType: {
            select: {
              id: true,
              name: true,
              bedroomCount: true,
            },
          },
          finishPackage: {
            select: {
              id: true,
              name: true,
              tier: true,
            },
          },
          designer: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          buyer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: { selections: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.consultation.count({ where }),
    ]);

    return NextResponse.json({ consultations, total });

  } catch (error: any) {
    console.error("Error listing consultations:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to list consultations" },
      { status: 500 }
    );
  }
}

/**
 * Generate a secure session token for buyer authentication.
 */
function generateSessionToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

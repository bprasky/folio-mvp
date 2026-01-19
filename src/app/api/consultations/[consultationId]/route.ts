export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

type Params = { params: { consultationId: string } };

/**
 * GET /api/consultations/[consultationId]
 *
 * Gets full consultation details including all selections.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { consultationId } = params;
    const searchParams = req.nextUrl.searchParams;
    const buyerToken = searchParams.get('buyerToken');

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        development: {
          select: {
            id: true,
            name: true,
            slug: true,
            heroImageUrl: true,
            developerOrgId: true,
          },
        },
        unitType: {
          select: {
            id: true,
            name: true,
            bedroomCount: true,
            bathroomCount: true,
            sqft: true,
            rooms: {
              include: {
                finishSlots: true,
              },
            },
          },
        },
        finishPackage: {
          select: {
            id: true,
            name: true,
            tier: true,
            description: true,
            priceDeltaCents: true,
            heroImageUrl: true,
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
          },
        },
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            studio: true,
            bio: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        selections: {
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
                    price: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { roomType: 'asc' },
            { slotKey: 'asc' },
          ],
        },
      },
    });

    if (!consultation) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }

    // Check access
    const hasAccess = await checkConsultationAccess(consultation, buyerToken);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get designer's fingerprint for context
    const fingerprint = await prisma.atelierFingerprint.findFirst({
      where: {
        designerId: consultation.designerId,
        ownerType: 'DESIGNER',
      },
      select: {
        id: true,
        completeness: true,
        voiceProfile: true,
      },
    });

    return NextResponse.json({
      consultation,
      designerFingerprint: fingerprint,
    });

  } catch (error: any) {
    console.error("Error fetching consultation:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch consultation" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/consultations/[consultationId]
 *
 * Updates consultation metadata (notes, status for cancellation).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { consultationId } = params;
    const searchParams = req.nextUrl.searchParams;
    const buyerToken = searchParams.get('buyerToken');
    const body = await req.json();

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        development: {
          select: { developerOrgId: true },
        },
        buyer: true,
      },
    });

    if (!consultation) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }

    // Check access
    const hasAccess = await checkConsultationAccess(consultation, buyerToken);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: any = {};

    // Notes can be updated
    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    // Status can only be set to CANCELLED via this endpoint
    if (body.status === 'CANCELLED') {
      if (consultation.status === 'COMPLETED') {
        return NextResponse.json(
          { error: "Cannot cancel a completed consultation" },
          { status: 400 }
        );
      }
      updateData.status = 'CANCELLED';
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: updateData,
      include: {
        development: {
          select: { id: true, name: true, slug: true },
        },
        unitType: {
          select: { id: true, name: true },
        },
        finishPackage: {
          select: { id: true, name: true, tier: true },
        },
        designer: {
          select: { id: true, name: true, profileImage: true },
        },
        buyer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ consultation: updated });

  } catch (error: any) {
    console.error("Error updating consultation:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update consultation" },
      { status: 500 }
    );
  }
}

/**
 * Check if current request has access to this consultation.
 */
async function checkConsultationAccess(
  consultation: any,
  buyerToken: string | null
): Promise<boolean> {
  // Buyer token access
  if (buyerToken) {
    const buyer = await prisma.consultationBuyer.findFirst({
      where: {
        sessionToken: buyerToken,
        sessionExpiresAt: { gt: new Date() },
      },
    });
    return buyer?.id === consultation.buyerId;
  }

  // Authenticated user access
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return false;
  }

  const user = session.user as { id: string; role: string };

  // Admin access
  if (user.role === 'ADMIN') {
    return true;
  }

  // Designer access
  if (user.id === consultation.designerId) {
    return true;
  }

  // Developer org access
  const hasOrgAccess = await prisma.organizationUser.findFirst({
    where: {
      userId: user.id,
      organizationId: consultation.development.developerOrgId,
      isActive: true,
    },
  });

  return !!hasOrgAccess;
}

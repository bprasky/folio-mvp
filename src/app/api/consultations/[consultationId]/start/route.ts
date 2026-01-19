export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { ConsultationStatus } from "@prisma/client";

type Params = { params: { consultationId: string } };

/**
 * POST /api/consultations/[consultationId]/start
 *
 * Starts a consultation session, transitioning from DRAFT to IN_PROGRESS.
 * Initializes selections from finish package defaults.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { consultationId } = params;
    const searchParams = req.nextUrl.searchParams;
    const buyerToken = searchParams.get('buyerToken');

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        development: {
          select: { developerOrgId: true },
        },
        buyer: true,
        finishPackage: {
          include: {
            defaultSelections: {
              include: {
                developmentProduct: true,
              },
            },
          },
        },
        unitType: {
          include: {
            rooms: {
              include: {
                finishSlots: true,
              },
            },
          },
        },
        selections: true,
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

    // Validate status transition
    if (consultation.status !== ConsultationStatus.DRAFT) {
      return NextResponse.json(
        { error: `Cannot start consultation in ${consultation.status} status` },
        { status: 400 }
      );
    }

    // Initialize selections from package defaults if not already created
    if (consultation.selections.length === 0) {
      const selectionsToCreate: any[] = [];

      // For each room in the unit type
      for (const room of consultation.unitType.rooms) {
        // For each finish slot in the room
        for (const slot of room.finishSlots) {
          // Find default selection for this slot/room combo
          const defaultSelection = consultation.finishPackage.defaultSelections.find(
            (ds) => ds.slotKey === slot.slotKey && ds.roomType === room.roomType
          );

          if (defaultSelection) {
            selectionsToCreate.push({
              consultationId,
              developmentProductId: defaultSelection.developmentProductId,
              slotKey: slot.slotKey,
              roomType: room.roomType,
              isUpgrade: false,
              upgradePriceCents: 0,
            });
          }
        }
      }

      if (selectionsToCreate.length > 0) {
        await prisma.consultationSelection.createMany({
          data: selectionsToCreate,
        });
      }
    }

    // Update consultation status
    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: ConsultationStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
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
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ consultation: updated });

  } catch (error: any) {
    console.error("Error starting consultation:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to start consultation" },
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

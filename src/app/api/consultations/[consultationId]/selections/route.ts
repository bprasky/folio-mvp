export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { ConsultationStatus } from "@prisma/client";

type Params = { params: { consultationId: string } };

/**
 * GET /api/consultations/[consultationId]/selections
 *
 * Lists all product selections for a consultation.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { consultationId } = params;
    const searchParams = req.nextUrl.searchParams;
    const buyerToken = searchParams.get('buyerToken');
    const roomType = searchParams.get('roomType');

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

    const where: any = { consultationId };
    if (roomType) {
      where.roomType = roomType;
    }

    const selections = await prisma.consultationSelection.findMany({
      where,
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
                description: true,
              },
            },
          },
        },
      },
      orderBy: [
        { roomType: 'asc' },
        { slotKey: 'asc' },
      ],
    });

    // Group by room type for easier consumption
    const byRoom: Record<string, any[]> = {};
    for (const selection of selections) {
      const room = selection.roomType || 'GENERAL';
      if (!byRoom[room]) {
        byRoom[room] = [];
      }
      byRoom[room].push(selection);
    }

    return NextResponse.json({
      selections,
      byRoom,
      totalUpgradeCents: selections.reduce(
        (sum, s) => sum + (s.isUpgrade ? (s.upgradePriceCents || 0) : 0),
        0
      ),
    });

  } catch (error: any) {
    console.error("Error listing selections:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to list selections" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/consultations/[consultationId]/selections
 *
 * Adds or updates a product selection in the consultation.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { consultationId } = params;
    const searchParams = req.nextUrl.searchParams;
    const buyerToken = searchParams.get('buyerToken');
    const body = await req.json();

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        development: {
          select: { id: true, developerOrgId: true },
        },
        buyer: true,
        finishPackage: true,
        unitType: {
          include: {
            rooms: {
              include: {
                finishSlots: true,
              },
            },
          },
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

    // Can only modify selections during active consultation
    if (consultation.status !== ConsultationStatus.IN_PROGRESS) {
      return NextResponse.json(
        { error: "Can only modify selections during an active consultation" },
        { status: 400 }
      );
    }

    const { developmentProductId, slotKey, roomType } = body;

    if (!developmentProductId || !slotKey || !roomType) {
      return NextResponse.json(
        { error: "Missing required fields: developmentProductId, slotKey, roomType" },
        { status: 400 }
      );
    }

    // Validate the product is in the development catalog
    const developmentProduct = await prisma.developmentProduct.findUnique({
      where: {
        developmentId_productId: {
          developmentId: consultation.development.id,
          productId: developmentProductId,
        },
      },
      include: {
        product: true,
      },
    });

    // Also try finding by development product ID directly
    const devProductById = developmentProduct || await prisma.developmentProduct.findUnique({
      where: { id: developmentProductId },
      include: { product: true },
    });

    if (!devProductById) {
      return NextResponse.json(
        { error: "Product not available in this development" },
        { status: 404 }
      );
    }

    // Validate product is available in the selected tier
    if (!devProductById.availableInPackages.includes(consultation.finishPackage.tier)) {
      return NextResponse.json(
        { error: "Product not available in selected finish package tier" },
        { status: 400 }
      );
    }

    // Validate slot exists in unit type
    const room = consultation.unitType.rooms.find(r => r.roomType === roomType);
    if (!room) {
      return NextResponse.json(
        { error: "Room type not found in unit type" },
        { status: 400 }
      );
    }

    const slot = room.finishSlots.find(s => s.slotKey === slotKey);
    if (!slot) {
      return NextResponse.json(
        { error: "Slot not found in room" },
        { status: 400 }
      );
    }

    // Check if this slot already has a selection
    const existingSelection = await prisma.consultationSelection.findFirst({
      where: {
        consultationId,
        slotKey,
        roomType,
      },
    });

    // Determine if this is an upgrade
    const isUpgrade = devProductById.isUpgrade || false;
    const upgradePriceCents = isUpgrade ? (devProductById.upgradePriceCents || 0) : 0;

    let selection;
    if (existingSelection) {
      // Update existing selection
      selection = await prisma.consultationSelection.update({
        where: { id: existingSelection.id },
        data: {
          developmentProductId: devProductById.id,
          isUpgrade,
          upgradePriceCents,
        },
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
      });
    } else {
      // Create new selection
      selection = await prisma.consultationSelection.create({
        data: {
          consultationId,
          developmentProductId: devProductById.id,
          slotKey,
          roomType,
          isUpgrade,
          upgradePriceCents,
        },
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
      });
    }

    // Recalculate total upgrade cost
    const allSelections = await prisma.consultationSelection.findMany({
      where: { consultationId },
    });

    const totalUpgradeCents = allSelections.reduce(
      (sum, s) => sum + (s.isUpgrade ? (s.upgradePriceCents || 0) : 0),
      0
    );

    // Update consultation total
    await prisma.consultation.update({
      where: { id: consultationId },
      data: { totalUpgradeCents },
    });

    return NextResponse.json({
      selection,
      totalUpgradeCents,
    }, { status: existingSelection ? 200 : 201 });

  } catch (error: any) {
    console.error("Error updating selection:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update selection" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/consultations/[consultationId]/selections
 *
 * Removes a selection (reverts to no selection for that slot).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { consultationId } = params;
    const searchParams = req.nextUrl.searchParams;
    const buyerToken = searchParams.get('buyerToken');
    const slotKey = searchParams.get('slotKey');
    const roomType = searchParams.get('roomType');

    if (!slotKey || !roomType) {
      return NextResponse.json(
        { error: "Missing required query params: slotKey, roomType" },
        { status: 400 }
      );
    }

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

    // Can only modify during active consultation
    if (consultation.status !== ConsultationStatus.IN_PROGRESS) {
      return NextResponse.json(
        { error: "Can only modify selections during an active consultation" },
        { status: 400 }
      );
    }

    const selection = await prisma.consultationSelection.findFirst({
      where: {
        consultationId,
        slotKey,
        roomType,
      },
    });

    if (!selection) {
      return NextResponse.json({ error: "Selection not found" }, { status: 404 });
    }

    await prisma.consultationSelection.delete({
      where: { id: selection.id },
    });

    // Recalculate total
    const remainingSelections = await prisma.consultationSelection.findMany({
      where: { consultationId },
    });

    const totalUpgradeCents = remainingSelections.reduce(
      (sum, s) => sum + (s.isUpgrade ? (s.upgradePriceCents || 0) : 0),
      0
    );

    await prisma.consultation.update({
      where: { id: consultationId },
      data: { totalUpgradeCents },
    });

    return NextResponse.json({
      success: true,
      message: "Selection removed",
      totalUpgradeCents,
    });

  } catch (error: any) {
    console.error("Error removing selection:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to remove selection" },
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

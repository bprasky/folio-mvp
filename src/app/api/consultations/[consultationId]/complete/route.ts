export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { ConsultationStatus } from "@prisma/client";

type Params = { params: { consultationId: string } };

/**
 * POST /api/consultations/[consultationId]/complete
 *
 * Completes a consultation session, calculating final upgrade costs.
 * Transitions from IN_PROGRESS or AWAITING_REVIEW to COMPLETED.
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
        selections: {
          include: {
            developmentProduct: {
              include: {
                product: true,
              },
            },
          },
        },
        finishPackage: {
          select: {
            priceDeltaCents: true,
          },
        },
      },
    });

    if (!consultation) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }

    // Check access - only designer or admin can complete
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };

    const canComplete =
      user.role === 'ADMIN' ||
      user.id === consultation.designerId;

    if (!canComplete) {
      return NextResponse.json(
        { error: "Only the designer or admin can complete a consultation" },
        { status: 403 }
      );
    }

    // Validate status transition
    const validStatuses = [ConsultationStatus.IN_PROGRESS, ConsultationStatus.AWAITING_REVIEW];
    if (!validStatuses.includes(consultation.status)) {
      return NextResponse.json(
        { error: `Cannot complete consultation in ${consultation.status} status` },
        { status: 400 }
      );
    }

    // Calculate total upgrade cost
    let totalUpgradeCents = 0;
    for (const selection of consultation.selections) {
      if (selection.isUpgrade) {
        totalUpgradeCents += selection.upgradePriceCents || 0;
      }
    }

    // Add finish package base price delta
    totalUpgradeCents += consultation.finishPackage.priceDeltaCents || 0;

    // Update consultation
    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: ConsultationStatus.COMPLETED,
        completedAt: new Date(),
        totalUpgradeCents,
      },
      include: {
        development: {
          select: { id: true, name: true, slug: true },
        },
        unitType: {
          select: { id: true, name: true, bedroomCount: true, bathroomCount: true },
        },
        finishPackage: {
          select: { id: true, name: true, tier: true, priceDeltaCents: true },
        },
        designer: {
          select: { id: true, name: true, profileImage: true, studio: true },
        },
        buyer: {
          select: { id: true, name: true, email: true, phone: true },
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

    // Generate summary for the completion
    const summary = {
      consultation: updated,
      summary: {
        totalSelections: updated.selections.length,
        totalUpgrades: updated.selections.filter(s => s.isUpgrade).length,
        finishPackageCost: consultation.finishPackage.priceDeltaCents,
        upgradeCost: totalUpgradeCents - (consultation.finishPackage.priceDeltaCents || 0),
        totalCost: totalUpgradeCents,
        completedAt: updated.completedAt,
        byRoom: groupSelectionsByRoom(updated.selections),
      },
    };

    return NextResponse.json(summary);

  } catch (error: any) {
    console.error("Error completing consultation:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to complete consultation" },
      { status: 500 }
    );
  }
}

/**
 * Group selections by room type for summary display.
 */
function groupSelectionsByRoom(selections: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  for (const selection of selections) {
    const roomType = selection.roomType || 'GENERAL';
    if (!grouped[roomType]) {
      grouped[roomType] = [];
    }
    grouped[roomType].push({
      slotKey: selection.slotKey,
      product: selection.developmentProduct.product,
      isUpgrade: selection.isUpgrade,
      upgradePriceCents: selection.upgradePriceCents,
    });
  }

  return grouped;
}

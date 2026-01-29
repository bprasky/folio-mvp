export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

const TOTAL_FOUNDING_SLOTS = 20;

/**
 * GET /api/vendor/founding-program
 *
 * Returns founding vendor program status: total slots, invites sent,
 * spots remaining, and whether this vendor is eligible.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's vendor organization
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        organization: {
          type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] },
        },
      },
      select: {
        organizationId: true,
        organization: {
          select: {
            isFoundingVendor: true,
            foundingVendorClaimedAt: true,
          },
        },
      },
    });

    // Count invites sent (vendor invites with founding slots)
    const invitesSent = await prisma.vendorInvite.count({
      where: {
        foundingVendorSlot: { not: null },
      },
    });

    // Count currently claimed founding vendors
    const foundingVendorsClaimed = await prisma.organization.count({
      where: { isFoundingVendor: true },
    });

    const spotsRemaining = Math.max(0, TOTAL_FOUNDING_SLOTS - foundingVendorsClaimed);

    // Check if this vendor is eligible
    let isEligible = false;
    let currentSlot: number | null = null;

    if (orgUser) {
      // Already a founding vendor?
      if (orgUser.organization.isFoundingVendor) {
        const invite = await prisma.vendorInvite.findUnique({
          where: { organizationId: orgUser.organizationId },
          select: { foundingVendorSlot: true },
        });
        currentSlot = invite?.foundingVendorSlot ?? null;
      } else {
        // Eligible if spots remain and org is a vendor type
        isEligible = spotsRemaining > 0;
      }
    }

    return NextResponse.json({
      totalSlots: TOTAL_FOUNDING_SLOTS,
      invitesSent,
      spotsRemaining,
      isEligible,
      currentSlot,
      isFoundingVendor: orgUser?.organization?.isFoundingVendor ?? false,
    });
  } catch (error) {
    console.error('[vendor/founding-program] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/vendor/founding-program
 *
 * Claims a founding vendor slot for the organization.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Verify membership
    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId,
        },
      },
      select: { role: true, isActive: true },
    });

    if (!membership?.isActive) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Check if already a founding vendor
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { isFoundingVendor: true },
    });

    if (org?.isFoundingVendor) {
      return NextResponse.json({
        success: true,
        message: 'Already a founding vendor',
        alreadyClaimed: true,
      });
    }

    // Check spots remaining (use transaction for atomicity)
    const result = await prisma.$transaction(async (tx) => {
      const currentCount = await tx.organization.count({
        where: { isFoundingVendor: true },
      });

      if (currentCount >= TOTAL_FOUNDING_SLOTS) {
        return { success: false, reason: 'No founding vendor slots remaining' };
      }

      const slotNumber = currentCount + 1;

      // Claim the slot
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          isFoundingVendor: true,
          foundingVendorClaimedAt: new Date(),
        },
      });

      // Update vendor invite with slot number
      await tx.vendorInvite.upsert({
        where: { organizationId },
        create: {
          organizationId,
          foundingVendorSlot: slotNumber,
        },
        update: {
          foundingVendorSlot: slotNumber,
        },
      });

      return { success: true, slotNumber };
    });

    if (!result.success) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      slotNumber: result.slotNumber,
      message: `Claimed founding vendor slot #${result.slotNumber}`,
    });
  } catch (error) {
    console.error('[vendor/founding-program] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

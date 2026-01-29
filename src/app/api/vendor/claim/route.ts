export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { canClaimOrganization } from '@/lib/vendor/domain-verification';

/**
 * POST /api/vendor/claim
 *
 * Allows a rep to claim the vendor organization.
 * Does NOT activate the org — admin must do that separately.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Verify domain match
    const verification = await canClaimOrganization(
      session.user.email,
      organizationId
    );

    if (!verification.allowed) {
      return NextResponse.json(
        { error: verification.reason || 'Not authorized to claim this organization' },
        { status: 403 }
      );
    }

    // Create or update the vendor invite record
    const vendorInvite = await prisma.vendorInvite.upsert({
      where: { organizationId },
      create: {
        organizationId,
        claimedAt: new Date(),
        claimedByUserId: session.user.id,
      },
      update: {
        claimedAt: new Date(),
        claimedByUserId: session.user.id,
      },
    });

    // Add user to org if not already a member
    const existingMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId,
        },
      },
    });

    if (!existingMembership) {
      await prisma.organizationUser.create({
        data: {
          userId: session.user.id,
          organizationId,
          role: 'MEMBER',
          isActive: true,
          workEmail: session.user.email,
        },
      });
    }

    // Update org status to CLAIMED if currently UNCLAIMED
    await prisma.organization.updateMany({
      where: {
        id: organizationId,
        status: 'UNCLAIMED',
      },
      data: {
        status: 'CLAIMED',
      },
    });

    return NextResponse.json({
      success: true,
      vendorInviteId: vendorInvite.id,
      message: 'Organization claimed successfully. An admin must activate to unlock full features.',
    });
  } catch (error) {
    console.error('[vendor/claim] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

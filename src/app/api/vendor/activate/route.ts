export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/vendor/activate
 *
 * Allows an org admin/owner to activate the organization.
 * Unlocks full analytics and designer details.
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

    // Verify user is OWNER or ADMIN of the org
    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId,
        },
      },
      select: { role: true, isActive: true },
    });

    if (!membership?.isActive || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only organization owners or admins can activate' },
        { status: 403 }
      );
    }

    // Check if invite exists
    const existingInvite = await prisma.vendorInvite.findUnique({
      where: { organizationId },
    });

    if (!existingInvite) {
      return NextResponse.json(
        { error: 'No vendor invite found for this organization' },
        { status: 404 }
      );
    }

    if (existingInvite.adminActivatedAt) {
      return NextResponse.json({
        success: true,
        message: 'Organization already activated',
        alreadyActivated: true,
      });
    }

    // Activate
    await prisma.vendorInvite.update({
      where: { organizationId },
      data: {
        adminActivatedAt: new Date(),
        adminUserId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Organization activated. Full analytics are now available.',
    });
  } catch (error) {
    console.error('[vendor/activate] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

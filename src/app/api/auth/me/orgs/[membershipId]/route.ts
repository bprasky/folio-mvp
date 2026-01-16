export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/auth/me/orgs/[membershipId] - Update org membership settings
 *
 * Body: { showOnProfile: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { membershipId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { membershipId } = params;

    // Verify this membership belongs to the current user
    const membership = await prisma.organizationUser.findFirst({
      where: {
        id: membershipId,
        userId: session.user.id,
      },
      select: { id: true, showOnProfile: true }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    const body = await request.json();
    const { showOnProfile } = body;

    if (typeof showOnProfile !== 'boolean') {
      return NextResponse.json(
        { error: 'showOnProfile must be a boolean' },
        { status: 400 }
      );
    }

    const updated = await prisma.organizationUser.update({
      where: { id: membershipId },
      data: { showOnProfile },
      select: {
        id: true,
        role: true,
        showOnProfile: true,
        joinedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            logo: true,
          }
        }
      }
    });

    return NextResponse.json({
      id: updated.id,
      role: updated.role,
      showOnProfile: updated.showOnProfile,
      joinedAt: updated.joinedAt,
      org: updated.organization
    });
  } catch (error) {
    console.error('[PATCH /api/auth/me/orgs/[membershipId]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update membership' },
      { status: 500 }
    );
  }
}

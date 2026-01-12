export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/orgs/[orgId]/members/[userId] - Update member role or settings
 * Body: { role?: OrgUserRole, showOnProfile?: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orgId: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, userId } = params;
    const body = await request.json();
    const { role, showOnProfile } = body;

    // Get current user's membership
    const currentUserMembership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: orgId,
        isActive: true,
      }
    });

    // Users can always update their own showOnProfile setting
    const isSelfUpdate = session.user.id === userId;
    const isUpdatingShowOnProfile = showOnProfile !== undefined && role === undefined;

    if (isSelfUpdate && isUpdatingShowOnProfile) {
      const updated = await prisma.organizationUser.update({
        where: {
          userId_organizationId: {
            userId,
            organizationId: orgId
          }
        },
        data: { showOnProfile }
      });

      return NextResponse.json({
        membership: {
          id: updated.id,
          role: updated.role,
          showOnProfile: updated.showOnProfile,
        },
        message: 'Settings updated',
      });
    }

    // For role changes, need admin permissions
    if (!currentUserMembership || !['OWNER', 'ADMIN'].includes(currentUserMembership.role)) {
      return NextResponse.json(
        { error: 'Only organization admins can update member roles' },
        { status: 403 }
      );
    }

    // Get target member
    const targetMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId
        }
      }
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Can't modify the owner unless you're the owner
    if (targetMembership.role === 'OWNER' && currentUserMembership.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only the owner can modify owner settings' },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (role !== undefined) {
      const validRoles = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];
      if (!validRoles.includes(role.toUpperCase())) {
        return NextResponse.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        );
      }

      // Only owner can transfer ownership
      if (role.toUpperCase() === 'OWNER') {
        if (currentUserMembership.role !== 'OWNER') {
          return NextResponse.json(
            { error: 'Only the current owner can transfer ownership' },
            { status: 403 }
          );
        }

        // Transfer ownership: demote current owner to admin
        await prisma.$transaction([
          prisma.organizationUser.update({
            where: {
              userId_organizationId: {
                userId: session.user.id,
                organizationId: orgId
              }
            },
            data: { role: 'ADMIN' }
          }),
          prisma.organizationUser.update({
            where: {
              userId_organizationId: {
                userId,
                organizationId: orgId
              }
            },
            data: { role: 'OWNER' }
          })
        ]);

        return NextResponse.json({
          message: 'Ownership transferred successfully',
        });
      }

      updateData.role = role.toUpperCase();
    }

    if (showOnProfile !== undefined) {
      updateData.showOnProfile = showOnProfile;
    }

    const updated = await prisma.organizationUser.update({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId
        }
      },
      data: updateData
    });

    return NextResponse.json({
      membership: {
        id: updated.id,
        role: updated.role,
        showOnProfile: updated.showOnProfile,
      },
      message: 'Member updated successfully',
    });
  } catch (error: any) {
    console.error('[PATCH /api/orgs/[orgId]/members/[userId]] Error:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orgs/[orgId]/members/[userId] - Remove member from organization
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { orgId: string; userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, userId } = params;

    // Get current user's membership
    const currentUserMembership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: orgId,
        isActive: true,
      }
    });

    // Users can leave the org themselves
    const isSelf = session.user.id === userId;

    if (!isSelf && (!currentUserMembership || !['OWNER', 'ADMIN'].includes(currentUserMembership.role))) {
      return NextResponse.json(
        { error: 'Only organization admins can remove members' },
        { status: 403 }
      );
    }

    // Get target member
    const targetMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId
        }
      }
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Owner cannot be removed (they must transfer ownership first)
    if (targetMembership.role === 'OWNER') {
      return NextResponse.json(
        { error: 'The owner cannot be removed. Transfer ownership first.' },
        { status: 400 }
      );
    }

    // Remove membership
    await prisma.organizationUser.delete({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId
        }
      }
    });

    return NextResponse.json({
      message: isSelf ? 'You have left the organization' : 'Member removed successfully',
    });
  } catch (error: any) {
    console.error('[DELETE /api/orgs/[orgId]/members/[userId]] Error:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/orgs/[orgId]/members/[userId] - Update member role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, userId: targetUserId } = await params;

    // Check if current user is admin/owner of this org
    const currentMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId,
        },
      },
    });

    if (!currentMembership || !['OWNER', 'ADMIN'].includes(currentMembership.role)) {
      return NextResponse.json(
        { error: 'Only org owners and admins can update member roles' },
        { status: 403 }
      );
    }

    // Get target membership
    const targetMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: orgId,
        },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { role, showOnProfile } = body;

    // Role update validation
    if (role !== undefined) {
      // Only OWNER can change roles to/from ADMIN/OWNER
      if (currentMembership.role !== 'OWNER') {
        if (targetMembership.role === 'OWNER' || targetMembership.role === 'ADMIN') {
          return NextResponse.json(
            { error: 'Only the owner can modify admin roles' },
            { status: 403 }
          );
        }
        if (role === 'OWNER' || role === 'ADMIN') {
          return NextResponse.json(
            { error: 'Only the owner can assign admin roles' },
            { status: 403 }
          );
        }
      }

      // Can't demote the last owner
      if (targetMembership.role === 'OWNER' && role !== 'OWNER') {
        const ownerCount = await prisma.organizationUser.count({
          where: {
            organizationId: orgId,
            role: 'OWNER',
            isActive: true,
          },
        });

        if (ownerCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote the only owner. Transfer ownership first.' },
            { status: 400 }
          );
        }
      }
    }

    // Update membership
    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (showOnProfile !== undefined) updateData.showOnProfile = showOnProfile;

    const updatedMembership = await prisma.organizationUser.update({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: orgId,
        },
      },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true,
          },
        },
      },
    });

    return NextResponse.json(updatedMembership);
  } catch (error) {
    console.error('Error updating member:', error);
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
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, userId: targetUserId } = await params;

    // Allow users to remove themselves, or admins to remove others
    const isSelf = session.user.id === targetUserId;

    if (!isSelf) {
      const currentMembership = await prisma.organizationUser.findUnique({
        where: {
          userId_organizationId: {
            userId: session.user.id,
            organizationId: orgId,
          },
        },
      });

      if (!currentMembership || !['OWNER', 'ADMIN'].includes(currentMembership.role)) {
        return NextResponse.json(
          { error: 'Only org owners and admins can remove members' },
          { status: 403 }
        );
      }
    }

    // Get target membership
    const targetMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: orgId,
        },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Can't remove the last owner
    if (targetMembership.role === 'OWNER') {
      const ownerCount = await prisma.organizationUser.count({
        where: {
          organizationId: orgId,
          role: 'OWNER',
          isActive: true,
        },
      });

      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the only owner. Transfer ownership first.' },
          { status: 400 }
        );
      }
    }

    // Soft delete by marking inactive (preserves history)
    await prisma.organizationUser.update({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: orgId,
        },
      },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}

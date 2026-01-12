export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/orgs/[orgId]/join/[requestId] - Approve or reject join request
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, requestId } = await params;

    // Check if user is admin/owner of this org
    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only org admins can review join requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, rejectionNote } = body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Get the join request
    const joinRequest = await prisma.orgJoinRequest.findFirst({
      where: {
        id: requestId,
        organizationId: orgId,
        status: 'PENDING',
      },
    });

    if (!joinRequest) {
      return NextResponse.json(
        { error: 'Join request not found or already processed' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      // Create membership and update request in transaction
      const [updatedRequest] = await prisma.$transaction([
        prisma.orgJoinRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
          },
        }),
        prisma.organizationUser.create({
          data: {
            userId: joinRequest.userId,
            organizationId: orgId,
            role: 'MEMBER',
          },
        }),
      ]);

      return NextResponse.json({
        ...updatedRequest,
        message: 'Join request approved. User is now a member.',
      });
    } else {
      // Reject the request
      const updatedRequest = await prisma.orgJoinRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectionNote,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json(updatedRequest);
    }
  } catch (error) {
    console.error('Error processing join request:', error);
    return NextResponse.json(
      { error: 'Failed to process join request' },
      { status: 500 }
    );
  }
}

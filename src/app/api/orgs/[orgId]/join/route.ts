export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { roleForOrgType } from '@/lib/onboarding/role-org-mapping';

/**
 * POST /api/orgs/[orgId]/join - Request to join an organization
 * Body: { message?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;
    const body = await request.json().catch(() => ({}));
    const { message } = body;

    // Check if org exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, status: true }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user is already a member
    const existingMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId
        }
      }
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: 'You are already a member of this organization' },
        { status: 400 }
      );
    }

    // Check if there's already a pending request
    const existingRequest = await prisma.orgJoinRequest.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId
        }
      }
    });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        return NextResponse.json(
          { error: 'You already have a pending join request for this organization' },
          { status: 400 }
        );
      }

      // If previous request was rejected, allow re-request
      if (existingRequest.status === 'REJECTED') {
        await prisma.orgJoinRequest.update({
          where: { id: existingRequest.id },
          data: {
            status: 'PENDING',
            message: message?.trim() || null,
            reviewedBy: null,
            reviewedAt: null,
            createdAt: new Date(),
          }
        });

        return NextResponse.json({
          message: 'Join request submitted successfully',
        });
      }
    }

    // Create join request
    await prisma.orgJoinRequest.create({
      data: {
        userId: session.user.id,
        organizationId: orgId,
        status: 'PENDING',
        message: message?.trim() || null,
      }
    });

    return NextResponse.json({
      message: 'Join request submitted successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/orgs/[orgId]/join] Error:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Join request already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit join request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs/[orgId]/join - Get join requests for this org (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    // Check if user is admin of this org
    const membership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: orgId,
        role: { in: ['OWNER', 'ADMIN'] },
        isActive: true,
      }
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only organization admins can view join requests' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'PENDING';

    const requests = await prisma.orgJoinRequest.findMany({
      where: {
        organizationId: orgId,
        status: status.toUpperCase() as any,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]/join] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch join requests' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orgs/[orgId]/join - Approve or reject a join request (admin only)
 * Body: { requestId, action: 'approve' | 'reject' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    // Check if user is admin of this org
    const membership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: orgId,
        role: { in: ['OWNER', 'ADMIN'] },
        isActive: true,
      }
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only organization admins can review join requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { requestId, action } = body;

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Missing required fields: requestId, action (approve/reject)' },
        { status: 400 }
      );
    }

    const joinRequest = await prisma.orgJoinRequest.findUnique({
      where: { id: requestId },
      include: { user: { select: { id: true, name: true } } }
    });

    if (!joinRequest || joinRequest.organizationId !== orgId) {
      return NextResponse.json(
        { error: 'Join request not found' },
        { status: 404 }
      );
    }

    if (joinRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'This request has already been reviewed' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Need the org's type to derive the role to promote the joiner to.
      // Done as a separate fetch (rather than expanding the include above)
      // to keep the reject branch's transaction minimal.
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { type: true },
      });
      const targetRole = org ? roleForOrgType(org.type) : null;

      // Create membership + approve request + promote role (if still
      // INDIVIDUAL) atomically. The `updateMany` with role guard makes
      // role-promotion a no-op for already-promoted users, never overwriting.
      // See docs/AUTH_ORG_ENROLLMENT_FLOW.md.
      await prisma.$transaction([
        prisma.organizationUser.create({
          data: {
            userId: joinRequest.userId,
            organizationId: orgId,
            role: 'MEMBER',
            isActive: true,
            showOnProfile: true,
          }
        }),
        prisma.orgJoinRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
          }
        }),
        ...(targetRole
          ? [
              prisma.user.updateMany({
                where: { id: joinRequest.userId, role: 'INDIVIDUAL' },
                data: { role: targetRole },
              }),
            ]
          : []),
      ]);

      return NextResponse.json({
        message: `${joinRequest.user.name} has been added to the organization`,
      });
    } else {
      // Reject request
      await prisma.orgJoinRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        }
      });

      return NextResponse.json({
        message: 'Join request rejected',
      });
    }
  } catch (error: any) {
    console.error('[PATCH /api/orgs/[orgId]/join] Error:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process join request' },
      { status: 500 }
    );
  }
}

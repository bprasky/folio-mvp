export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/orgs/[orgId]/join - Request to join an organization
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const body = await request.json();
    const { message } = body;

    // Check if org exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId,
        },
      },
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
          organizationId: orgId,
        },
      },
    });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        return NextResponse.json(
          { error: 'You already have a pending join request for this organization' },
          { status: 400 }
        );
      }
      // If previously rejected, allow re-request by updating
      const updatedRequest = await prisma.orgJoinRequest.update({
        where: { id: existingRequest.id },
        data: {
          status: 'PENDING',
          message,
          rejectionNote: null,
          reviewedBy: null,
          reviewedAt: null,
        },
      });
      return NextResponse.json(updatedRequest, { status: 200 });
    }

    // Create new join request
    const joinRequest = await prisma.orgJoinRequest.create({
      data: {
        userId: session.user.id,
        organizationId: orgId,
        message,
      },
    });

    return NextResponse.json(joinRequest, { status: 201 });
  } catch (error) {
    console.error('Error creating join request:', error);
    return NextResponse.json(
      { error: 'Failed to create join request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs/[orgId]/join - Get pending join requests (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

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
        { error: 'Only org admins can view join requests' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    const joinRequests = await prisma.orgJoinRequest.findMany({
      where: {
        organizationId: orgId,
        status: status as any,
      },
      include: {
        // Include user info - need to fetch separately since no relation defined
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch user info for each request
    const userIds = joinRequests.map(r => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        profileImage: true,
        title: true,
      },
    });

    const usersMap = new Map(users.map(u => [u.id, u]));
    const requestsWithUsers = joinRequests.map(r => ({
      ...r,
      user: usersMap.get(r.userId),
    }));

    return NextResponse.json({ requests: requestsWithUsers });
  } catch (error) {
    console.error('Error fetching join requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch join requests' },
      { status: 500 }
    );
  }
}

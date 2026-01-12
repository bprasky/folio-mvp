export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/orgs/[orgId]/invite - Invite a user to the organization
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
        { error: 'Only org admins can invite members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role = 'MEMBER' } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate role - can't invite as OWNER
    if (role === 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot invite someone as OWNER. Transfer ownership instead.' },
        { status: 400 }
      );
    }

    // Check if user with this email is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    if (existingUser) {
      const existingMembership = await prisma.organizationUser.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: orgId,
          },
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: 'This user is already a member of the organization' },
          { status: 400 }
        );
      }
    }

    // Check for existing pending invite
    const existingInvite = await prisma.orgInvite.findFirst({
      where: {
        organizationId: orgId,
        email: email.toLowerCase(),
        status: 'PENDING',
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invite has already been sent to this email' },
        { status: 400 }
      );
    }

    // Create invite with 7 day expiration
    const invite = await prisma.orgInvite.create({
      data: {
        organizationId: orgId,
        email: email.toLowerCase(),
        role,
        token: uuidv4(),
        invitedBy: session.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // TODO: Send email notification with invite link
    // For now, return the invite with token for testing

    return NextResponse.json(invite, { status: 201 });
  } catch (error) {
    console.error('Error creating invite:', error);
    return NextResponse.json(
      { error: 'Failed to create invite' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs/[orgId]/invite - List pending invites (admin only)
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
        { error: 'Only org admins can view invites' },
        { status: 403 }
      );
    }

    const invites = await prisma.orgInvite.findMany({
      where: {
        organizationId: orgId,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch inviter info
    const inviterIds = [...new Set(invites.map(i => i.invitedBy))];
    const inviters = await prisma.user.findMany({
      where: { id: { in: inviterIds } },
      select: { id: true, name: true, email: true },
    });
    const invitersMap = new Map(inviters.map(u => [u.id, u]));

    const invitesWithInviters = invites.map(i => ({
      ...i,
      inviter: invitersMap.get(i.invitedBy),
    }));

    return NextResponse.json({ invites: invitesWithInviters });
  } catch (error) {
    console.error('Error fetching invites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invites' },
      { status: 500 }
    );
  }
}

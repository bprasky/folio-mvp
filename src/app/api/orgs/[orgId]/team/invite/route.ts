export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';

/**
 * POST /api/orgs/[orgId]/team/invite - Send team member invite
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

    // Verify user is org owner/admin
    const memberships = await getUserOrgMemberships(session.user.id);
    if (!isOrgAdmin(memberships, orgId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      );
    }

    // Check if already invited
    const existingInvite = await prisma.teamMemberInvite.findUnique({
      where: {
        organizationId_email: {
          organizationId: orgId,
          email
        }
      }
    });

    if (existingInvite && existingInvite.status === 'PENDING') {
      return NextResponse.json(
        { error: 'An invite has already been sent to this email' },
        { status: 400 }
      );
    }

    // Check if user already exists and is a member
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      const existingMembership = await prisma.organizationUser.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: orgId
          }
        }
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: 'This user is already a team member' },
          { status: 400 }
        );
      }
    }

    // Create or update invite
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to accept

    const invite = await prisma.teamMemberInvite.upsert({
      where: {
        organizationId_email: {
          organizationId: orgId,
          email
        }
      },
      create: {
        organizationId: orgId,
        email,
        role,
        invitedById: session.user.id,
        expiresAt,
        status: 'PENDING'
      },
      update: {
        role,
        invitedById: session.user.id,
        expiresAt,
        status: 'PENDING'
      }
    });

    // TODO: Send email invitation
    // await sendTeamInviteEmail({
    //   to: email,
    //   orgName: org.name,
    //   inviterName: session.user.name,
    //   inviteToken: invite.token,
    //   role
    // });

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt
      }
    });
  } catch (error) {
    console.error('[POST /api/orgs/[orgId]/team/invite] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send invite' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs/[orgId]/team/invite - Get pending invites
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

    // Verify user is org owner/admin
    const memberships = await getUserOrgMemberships(session.user.id);
    if (!isOrgAdmin(memberships, orgId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const invites = await prisma.teamMemberInvite.findMany({
      where: {
        organizationId: orgId,
        status: 'PENDING'
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]/team/invite] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invites' },
      { status: 500 }
    );
  }
}

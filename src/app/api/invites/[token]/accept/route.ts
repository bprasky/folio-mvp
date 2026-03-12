export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/invites/[token]/accept - Accept a team invite
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = params;

    const invite = await prisma.teamMemberInvite.findUnique({
      where: { token },
      include: { organization: { select: { name: true } } },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (invite.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Invite has already been ${invite.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    if (invite.expiresAt < new Date()) {
      await prisma.teamMemberInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
      return NextResponse.json({ error: 'Invite has expired' }, { status: 400 });
    }

    // Verify email matches
    if (invite.email.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invite was sent to a different email address' },
        { status: 403 }
      );
    }

    // Check if already a member
    const existingMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: invite.organizationId,
        },
      },
    });

    if (existingMembership) {
      // Update invite status and return success
      await prisma.teamMemberInvite.update({
        where: { id: invite.id },
        data: { status: 'CLAIMED', claimedAt: new Date(), claimedByUserId: session.user.id },
      });
      return NextResponse.json({
        success: true,
        message: 'You are already a member of this organization',
        orgId: invite.organizationId,
      });
    }

    // Map invite role string to OrgUserRole enum
    const roleMapping: Record<string, string> = {
      ADMIN: 'ADMIN',
      MANAGER: 'MANAGER',
      MEMBER: 'MEMBER',
      Admin: 'ADMIN',
      Manager: 'MANAGER',
      Member: 'MEMBER',
    };
    const orgRole = roleMapping[invite.role] || 'MEMBER';

    // Create membership and update invite in a transaction
    await prisma.$transaction([
      prisma.organizationUser.create({
        data: {
          userId: session.user.id,
          organizationId: invite.organizationId,
          role: orgRole as any,
          isActive: true,
        },
      }),
      prisma.teamMemberInvite.update({
        where: { id: invite.id },
        data: {
          status: 'CLAIMED',
          claimedAt: new Date(),
          claimedByUserId: session.user.id,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      orgId: invite.organizationId,
      orgName: invite.organization.name,
    });
  } catch (error) {
    console.error('[POST /api/invites/[token]/accept] Error:', error);
    return NextResponse.json(
      { error: 'Failed to accept invite' },
      { status: 500 }
    );
  }
}

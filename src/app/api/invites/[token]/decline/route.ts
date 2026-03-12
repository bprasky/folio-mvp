export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/invites/[token]/decline - Decline a team invite
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = params;

    const invite = await prisma.teamMemberInvite.findUnique({
      where: { token },
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

    await prisma.teamMemberInvite.update({
      where: { id: invite.id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/invites/[token]/decline] Error:', error);
    return NextResponse.json(
      { error: 'Failed to decline invite' },
      { status: 500 }
    );
  }
}

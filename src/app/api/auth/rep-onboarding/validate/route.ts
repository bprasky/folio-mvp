export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Define PendingRepInviteStatus locally since it may not be in Prisma schema yet
const PendingRepInviteStatus = {
  PENDING: 'PENDING',
  CLAIMED: 'CLAIMED',
  EXPIRED: 'EXPIRED',
} as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get('inviteId');
    const token = searchParams.get('token');

    if (!inviteId || !token) {
      return NextResponse.json(
        { error: 'Missing invite ID or token' },
        { status: 400 }
      );
    }

    const invite = await prisma.pendingRepInvite.findUnique({
      where: { id: inviteId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            images: {
              take: 1,
              select: { url: true },
            },
          },
        },
        vendorOrganization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      );
    }

    if (invite.token !== token) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 403 }
      );
    }

    if (invite.status !== PendingRepInviteStatus.PENDING) {
      return NextResponse.json(
        { error: 'This invite has already been claimed or cancelled' },
        { status: 400 }
      );
    }

    return NextResponse.json({ invite });
  } catch (error) {
    console.error('Failed to validate rep invite:', error);
    return NextResponse.json(
      { error: 'Failed to validate invite' },
      { status: 500 }
    );
  }
}





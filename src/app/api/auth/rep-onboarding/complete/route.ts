import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { autoFollowDesignersForRep } from '@/lib/server/repAutoFollow';

// Define PendingRepInviteStatus locally since it may not be in Prisma schema yet
const PendingRepInviteStatus = {
  PENDING: 'PENDING',
  CLAIMED: 'CLAIMED',
  EXPIRED: 'EXPIRED',
} as const;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { inviteId, token, emailChoice, workEmail } = body;

    if (!inviteId || !token || !emailChoice) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate invite
    const invite = await prisma.pendingRepInvite.findUnique({
      where: { id: inviteId },
      include: {
        vendorOrganization: true,
      },
    });

    if (!invite || invite.token !== token || invite.status !== PendingRepInviteStatus.PENDING) {
      return NextResponse.json(
        { error: 'Invalid or expired invite' },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const chosenWorkEmail = emailChoice === 'different' ? workEmail : invite.email;

    // Validate email format if different email provided
    if (emailChoice === 'different' && (!chosenWorkEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chosenWorkEmail))) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Update user and reassign all pending invites for this email
    const invitesToClaim = await prisma.pendingRepInvite.findMany({
      where: {
        email: invite.email,
        status: PendingRepInviteStatus.PENDING,
      },
    });

    await prisma.$transaction([
      // Update user
      prisma.user.update({
        where: { id: userId },
        data: {
          isVendorRep: true,
          originalInviteEmail: invite.email,
          workEmail: chosenWorkEmail,
          workEmailVerifiedAt: new Date(), // We know they own the invite email
          vendorOrganizationId: invite.vendorOrganizationId || undefined,
        },
      }),
      // Mark all invites as claimed
      ...invitesToClaim.map((inv) =>
        prisma.pendingRepInvite.update({
          where: { id: inv.id },
          data: {
            status: PendingRepInviteStatus.CLAIMED,
            repUserId: userId,
          },
        })
      ),
    ]);

    // Auto-follow designers
    await autoFollowDesignersForRep(userId);

    console.log('[RepOnboarding] Completed', {
      userId,
      inviteId,
      workEmail: chosenWorkEmail,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to complete rep onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}





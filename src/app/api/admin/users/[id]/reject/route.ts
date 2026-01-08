import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is admin
    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (adminUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();
    const { reason } = body;

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, accountStatus: true, email: true, name: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user status to rejected
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        accountStatus: 'REJECTED',
        rejectionReason: reason || null,
        approvedAt: null,
        approvedBy: null,
      },
    });

    // TODO: Send rejection email to user
    // await sendRejectionEmail(targetUser.email, targetUser.name, reason);

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        accountStatus: updatedUser.accountStatus,
      },
    });
  } catch (error) {
    console.error('Error rejecting user:', error);
    return NextResponse.json(
      { error: 'Failed to reject user' },
      { status: 500 }
    );
  }
}

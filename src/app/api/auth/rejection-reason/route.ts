import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { rejectionReason: true, accountStatus: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only return rejection reason if user is actually rejected
    if (user.accountStatus !== 'REJECTED') {
      return NextResponse.json({ rejectionReason: null });
    }

    return NextResponse.json({ rejectionReason: user.rejectionReason });
  } catch (error) {
    console.error('Error fetching rejection reason:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rejection reason' },
      { status: 500 }
    );
  }
}

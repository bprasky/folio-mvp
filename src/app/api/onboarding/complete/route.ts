import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a designer and approved
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, accountStatus: true, onboardingCompletedAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'DESIGNER') {
      return NextResponse.json(
        { error: 'Only designers need to complete onboarding' },
        { status: 400 }
      );
    }

    if (user.accountStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Account must be approved before completing onboarding' },
        { status: 400 }
      );
    }

    // If already completed, return success
    if (user.onboardingCompletedAt) {
      return NextResponse.json({ success: true, alreadyCompleted: true });
    }

    // Mark onboarding as complete
    await prisma.user.update({
      where: { id: session.user.id },
      data: { onboardingCompletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}

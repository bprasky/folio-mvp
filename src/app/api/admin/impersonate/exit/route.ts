import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

const IMPERSONATION_COOKIE = 'folio-impersonation';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get impersonation data from cookie
    const cookieStore = cookies();
    const impersonationCookie = cookieStore.get(IMPERSONATION_COOKIE);

    if (!impersonationCookie?.value) {
      return NextResponse.json(
        { error: 'No active impersonation session' },
        { status: 400 }
      );
    }

    let impersonationData;
    try {
      impersonationData = JSON.parse(impersonationCookie.value);
    } catch {
      return NextResponse.json(
        { error: 'Invalid impersonation data' },
        { status: 400 }
      );
    }

    // Update the impersonation log to set endedAt
    await prisma.impersonationLog.updateMany({
      where: {
        adminId: impersonationData.originalAdminId,
        targetUserId: impersonationData.targetUserId,
        endedAt: null,
      },
      data: {
        endedAt: new Date(),
      },
    });

    const response = NextResponse.json({
      success: true,
      message: 'Impersonation ended',
    });

    // Clear the impersonation cookie
    response.cookies.delete(IMPERSONATION_COOKIE);

    return response;
  } catch (error) {
    console.error('Error ending impersonation:', error);
    return NextResponse.json(
      { error: 'Failed to end impersonation' },
      { status: 500 }
    );
  }
}

// GET endpoint to check impersonation status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get impersonation data from cookie
    const cookieStore = cookies();
    const impersonationCookie = cookieStore.get(IMPERSONATION_COOKIE);

    if (!impersonationCookie?.value) {
      return NextResponse.json({ isImpersonating: false });
    }

    try {
      const impersonationData = JSON.parse(impersonationCookie.value);
      return NextResponse.json({
        isImpersonating: true,
        ...impersonationData,
      });
    } catch {
      return NextResponse.json({ isImpersonating: false });
    }
  } catch (error) {
    console.error('Error checking impersonation status:', error);
    return NextResponse.json({ isImpersonating: false });
  }
}

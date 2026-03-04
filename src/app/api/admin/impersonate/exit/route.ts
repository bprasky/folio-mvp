import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { cookies } from 'next/headers';

const IMPERSONATION_COOKIE = 'folio-impersonation';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

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
  } catch (error: any) {
    if (error.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.status === 403) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    await requireAdmin();

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
  } catch (error: any) {
    if (error.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.status === 403) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Error checking impersonation status:', error);
    return NextResponse.json({ isImpersonating: false });
  }
}

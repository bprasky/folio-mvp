/**
 * GET /api/contributions
 *
 * List current user's contributions (with topic info, status)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserContributions } from '@/lib/contributions';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const contributions = await getUserContributions(session.user.id, {
      status,
      limit,
      offset,
    });

    return NextResponse.json({
      contributions,
      count: contributions.length,
    });
  } catch (error) {
    console.error('[GET /api/contributions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contributions' },
      { status: 500 }
    );
  }
}

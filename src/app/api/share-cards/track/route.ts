/**
 * POST /api/share-cards/track
 * Track share event
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { trackShareEvent } from '@/lib/share-cards';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { contributionId, action } = body;

    if (!contributionId || typeof contributionId !== 'string') {
      return NextResponse.json(
        { error: 'Contribution ID is required' },
        { status: 400 }
      );
    }

    if (!action || !['download', 'share'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action (download or share) is required' },
        { status: 400 }
      );
    }

    await trackShareEvent(contributionId, action);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[POST /api/share-cards/track] Error:', error);
    return NextResponse.json(
      { error: 'Failed to track share event' },
      { status: 500 }
    );
  }
}

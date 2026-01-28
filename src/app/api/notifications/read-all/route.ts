/**
 * POST /api/notifications/read-all
 *
 * Mark all notifications as read for current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { markAllAsRead } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const count = await markAllAsRead(session.user.id);

    return NextResponse.json({
      success: true,
      markedCount: count,
    });
  } catch (error) {
    console.error('[POST /api/notifications/read-all] Error:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
}

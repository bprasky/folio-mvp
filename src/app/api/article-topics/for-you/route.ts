/**
 * GET /api/article-topics/for-you
 *
 * Personalized topic recommendations based on user's taste profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getForYouTopics } from '@/lib/contributions';

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
    const limit = parseInt(searchParams.get('limit') || '3', 10);

    const topics = await getForYouTopics(session.user.id, limit);

    return NextResponse.json({
      topics,
      count: topics.length,
    });
  } catch (error) {
    console.error('[GET /api/article-topics/for-you] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personalized topics' },
      { status: 500 }
    );
  }
}

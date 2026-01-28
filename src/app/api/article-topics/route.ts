/**
 * GET /api/article-topics
 *
 * List GATHERING topics for current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTopicsForUser } from '@/lib/contributions';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    const topics = await getTopicsForUser(userId);

    return NextResponse.json({
      topics,
      count: topics.length,
    });
  } catch (error) {
    console.error('[GET /api/article-topics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article topics' },
      { status: 500 }
    );
  }
}

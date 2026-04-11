export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getRecommendedProducts } from '@/lib/recommendations/scoreProducts';

/**
 * GET /api/recommendations?limit=24
 *
 * Returns personalized product recommendations based on user's taste profile.
 * Uses TasteInference signals (materials, styles, colors, brands) to score
 * and rank candidate products.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 48);

  try {
    const products = await getRecommendedProducts(session.user.id, limit);

    return NextResponse.json({
      products,
      count: products.length,
      userId: session.user.id,
    });
  } catch (error) {
    console.error('[recommendations] Error:', error);
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 });
  }
}

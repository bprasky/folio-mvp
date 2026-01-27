export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { recordLike, removeLike, hasUserLiked, getProductEngagement } from '@/lib/intelligence/signals';

/**
 * POST /api/signals/like
 *
 * Record a like signal for a product
 *
 * Body:
 *   productId: string - The product to like
 */
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
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const result = await recordLike({
      userId: session.user.id,
      productId,
    });

    const engagement = await getProductEngagement(productId);

    return NextResponse.json({
      success: result.success,
      isNew: result.isNew,
      likeCount: engagement.likeCount,
      saveCount: engagement.saveCount,
    });
  } catch (error) {
    console.error('[POST /api/signals/like] Error:', error);
    return NextResponse.json(
      { error: 'Failed to record like' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/signals/like
 *
 * Remove a like from a product
 *
 * Body:
 *   productId: string - The product to unlike
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const result = await removeLike({
      userId: session.user.id,
      productId,
    });

    const engagement = await getProductEngagement(productId);

    return NextResponse.json({
      success: result.success,
      likeCount: engagement.likeCount,
      saveCount: engagement.saveCount,
    });
  } catch (error) {
    console.error('[DELETE /api/signals/like] Error:', error);
    return NextResponse.json(
      { error: 'Failed to remove like' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/signals/like
 *
 * Check if user has liked a product
 *
 * Query params:
 *   productId: string - The product to check
 */
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
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const isLiked = await hasUserLiked(session.user.id, productId);
    const engagement = await getProductEngagement(productId);

    return NextResponse.json({
      isLiked,
      likeCount: engagement.likeCount,
      saveCount: engagement.saveCount,
    });
  } catch (error) {
    console.error('[GET /api/signals/like] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check like status' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { recordSave, removeSave, hasUserSaved, getProductEngagement, getUserSaves } from '@/lib/intelligence/signals';

/**
 * POST /api/signals/save
 *
 * Record a save signal for a product
 *
 * Body:
 *   productId: string - The product to save
 *   boardId?: string - Optional board to save to
 *   roomType?: string - Optional room type (living_room, bedroom, etc.)
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
    const { productId, boardId, roomType } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const result = await recordSave({
      userId: session.user.id,
      productId,
      boardId,
      roomType,
    });

    const engagement = await getProductEngagement(productId);

    return NextResponse.json({
      success: result.success,
      isNew: result.isNew,
      saveId: result.saveId,
      likeCount: engagement.likeCount,
      saveCount: engagement.saveCount,
    });
  } catch (error) {
    console.error('[POST /api/signals/save] Error:', error);
    return NextResponse.json(
      { error: 'Failed to record save' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/signals/save
 *
 * Remove a save from a product
 *
 * Body:
 *   productId: string - The product to unsave
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

    const result = await removeSave({
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
    console.error('[DELETE /api/signals/save] Error:', error);
    return NextResponse.json(
      { error: 'Failed to remove save' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/signals/save
 *
 * Check if user has saved a product, or get all user's saves
 *
 * Query params:
 *   productId?: string - The product to check (if omitted, returns all saves)
 *   boardId?: string - Filter by board (only when listing all)
 *   limit?: number - Max number of saves to return (default 50)
 *   offset?: number - Offset for pagination
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
    const boardId = searchParams.get('boardId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // If productId is provided, check if saved
    if (productId) {
      const isSaved = await hasUserSaved(session.user.id, productId);
      const engagement = await getProductEngagement(productId);

      return NextResponse.json({
        isSaved,
        likeCount: engagement.likeCount,
        saveCount: engagement.saveCount,
      });
    }

    // Otherwise, return user's saves
    const saves = await getUserSaves(session.user.id, {
      limit,
      offset,
      boardId: boardId || undefined,
    });

    return NextResponse.json({
      saves,
      count: saves.length,
    });
  } catch (error) {
    console.error('[GET /api/signals/save] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get save status' },
      { status: 500 }
    );
  }
}

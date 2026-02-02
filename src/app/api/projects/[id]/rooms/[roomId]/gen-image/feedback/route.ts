import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/projects/[id]/rooms/[roomId]/gen-image/feedback
 *
 * Stores user feedback on generated images for analytics and improvement.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, roomId } = await params;
    const body = await request.json().catch(() => ({}));

    const {
      rating,
      readinessScore,
      assetIds = [],
      reasons = [],
      customFeedback = '',
    } = body;

    // Validate rating
    if (!rating || !['positive', 'negative'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    // Log to analytics table (or create one if needed)
    // For now, we'll use console logging and optionally store in a JSON field
    const feedbackData = {
      userId: session.user.id,
      projectId,
      roomId,
      rating,
      readinessScore: readinessScore ?? null,
      assetIds,
      reasons,
      customFeedback,
      timestamp: new Date().toISOString(),
    };

    console.log('[gen-image/feedback]', JSON.stringify(feedbackData));

    // Try to store feedback in the database
    // We'll use the existing analytics/signal infrastructure or create a simple log
    try {
      // Check if we have an ImageGenFeedback model, otherwise just log
      // For MVP, we can store this as metadata on the room or create a simple log
      await prisma.$executeRaw`
        INSERT INTO "image_gen_feedback" (
          "id", "user_id", "project_id", "room_id", "rating",
          "readiness_score", "asset_ids", "reasons", "custom_feedback", "created_at"
        ) VALUES (
          gen_random_uuid(),
          ${session.user.id},
          ${projectId},
          ${roomId},
          ${rating},
          ${readinessScore ?? null},
          ${JSON.stringify(assetIds)}::jsonb,
          ${JSON.stringify(reasons)}::jsonb,
          ${customFeedback},
          NOW()
        )
      `;
    } catch (dbError: any) {
      // Table might not exist yet - that's OK, we logged it
      if (!dbError.message?.includes('does not exist')) {
        console.error('[gen-image/feedback] DB error:', dbError.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[gen-image/feedback] Error:', error);
    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    );
  }
}

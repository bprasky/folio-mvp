export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { confirmInference } from '@/lib/intelligence/patterns';

/**
 * POST /api/users/[userId]/inferences/[inferenceId]/confirm
 *
 * Confirm, deny, or skip an inference
 *
 * Body:
 *   response: 'confirm' | 'deny' | 'skip'
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string; inferenceId: string }> }
) {
  try {
    const { userId, inferenceId } = await context.params;
    const session = await getServerSession(authOptions);

    // Users can only confirm their own inferences
    if (!session?.user?.id || session.user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { response } = body;

    if (!response || !['confirm', 'deny', 'skip'].includes(response)) {
      return NextResponse.json(
        { error: 'Invalid response. Must be one of: confirm, deny, skip' },
        { status: 400 }
      );
    }

    const result = await confirmInference({
      userId,
      inferenceId,
      response,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Inference not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      response,
    });
  } catch (error) {
    console.error('[POST /api/users/[userId]/inferences/[inferenceId]/confirm] Error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm inference' },
      { status: 500 }
    );
  }
}

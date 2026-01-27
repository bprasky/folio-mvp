export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPendingInferences } from '@/lib/intelligence/patterns';

/**
 * GET /api/users/[userId]/inferences
 *
 * Get user's taste inferences
 *
 * Query params:
 *   pending: boolean - If true, only return pending (not yet shown) inferences
 *   limit: number - Max number to return (default 10)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params;
    const session = await getServerSession(authOptions);

    // Users can only view their own inferences
    if (!session?.user?.id || session.user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pending = searchParams.get('pending') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (pending) {
      // Get pending inferences that haven't been shown to user
      const pendingInferences = await getPendingInferences(userId, limit);

      return NextResponse.json({
        inferences: pendingInferences,
        hasPending: pendingInferences.length > 0,
      });
    }

    // Get all inferences
    const inferences = await prisma.tasteInference.findMany({
      where: { userId },
      orderBy: [
        { confirmedByUser: 'desc' }, // Confirmed first
        { confidence: 'desc' },
      ],
      take: limit,
    });

    return NextResponse.json({
      inferences: inferences.map(i => ({
        id: i.id,
        attribute: i.attribute,
        attributeType: i.attributeType,
        confidence: i.confidence,
        evidence: i.evidence,
        source: i.source,
        confirmedByUser: i.confirmedByUser,
        confirmedAt: i.confirmedAt,
        shownToUser: i.shownToUser,
      })),
    });
  } catch (error) {
    console.error('[GET /api/users/[userId]/inferences] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get inferences' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/users/[id]/relationship
 * Returns the current relationship state between the session user and target user.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: targetId } = await params;
    const currentUserId = session.user.id;

    if (currentUserId === targetId) {
      return NextResponse.json({
        isFollowing: false,
        isFollowedBy: false,
        isMutual: false,
        tier: null,
      });
    }

    // Query both directions
    const [outgoing, incoming] = await Promise.all([
      prisma.userRelationship.findUnique({
        where: { followerId_followingId: { followerId: currentUserId, followingId: targetId } },
        select: { tier: true, isMutual: true },
      }),
      prisma.userRelationship.findUnique({
        where: { followerId_followingId: { followerId: targetId, followingId: currentUserId } },
        select: { tier: true, isMutual: true },
      }),
    ]);

    return NextResponse.json({
      isFollowing: !!outgoing,
      isFollowedBy: !!incoming,
      isMutual: outgoing?.isMutual ?? false,
      tier: outgoing?.tier ?? null,
    });
  } catch (error) {
    console.error('[users/relationship] GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

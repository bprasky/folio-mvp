/**
 * GET /api/contributor/profile
 *
 * Current user's contributor profile
 * - Badges earned
 * - Contribution count by status
 * - Published contributions with share stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getContributorProfile,
  getUserContributions,
  getNextBadgeLevel,
} from '@/lib/contributions';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get contributor profile (badges)
    const profile = await getContributorProfile(userId);

    // Get contribution counts by status
    const statusCounts = await prisma.contribution.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    const countsByStatus = statusCounts.reduce((acc, c) => {
      acc[c.status] = c._count;
      return acc;
    }, {} as Record<string, number>);

    // Get published contributions with share stats
    const publishedContributions = await getUserContributions(userId, {
      status: 'PUBLISHED',
      limit: 20,
    });

    // Get next badge info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        publishedContributionCount: true,
      },
    });

    const nextBadge = user
      ? getNextBadgeLevel(user.publishedContributionCount, user.role)
      : null;

    return NextResponse.json({
      profile: {
        ...profile,
        countsByStatus,
        publishedContributions,
        nextBadge,
      },
    });
  } catch (error) {
    console.error('[GET /api/contributor/profile] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contributor profile' },
      { status: 500 }
    );
  }
}

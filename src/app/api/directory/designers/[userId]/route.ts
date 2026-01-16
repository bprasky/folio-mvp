export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  calculateDesignerScores,
  calculateDesignerTotalScore,
  generateDesignerSuggestions,
  getDesignerEligibilityStatus,
  calculatePotentialRank,
  updateDesignerRanking,
} from '@/lib/directory';
import type { DesignerRankingResponse } from '@/lib/directory/types';

/**
 * GET /api/directory/designers/[userId]
 * Get individual designer's ranking and score breakdown
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const session = await getServerSession(authOptions);
    const isOwnProfile = session?.user?.id === userId;

    // Get current ranking
    const ranking = await prisma.directoryRanking.findUnique({
      where: { userId },
      select: {
        rank: true,
        rankChange: true,
        totalScore: true,
        taggedProjectsScore: true,
        completenessScore: true,
        engagementScore: true,
        editorialScore: true,
        vendorDiversityScore: true,
        recencyScore: true,
        isEligible: true,
        lastCalculatedAt: true,
      },
    });

    // Get eligibility status
    const eligibility = await getDesignerEligibilityStatus(userId);

    // If no ranking exists, calculate scores for display
    let response: DesignerRankingResponse;

    if (ranking) {
      response = {
        rank: ranking.rank,
        rankChange: ranking.rankChange,
        totalScore: ranking.totalScore,
        isEligible: ranking.isEligible,
        requiresProUpgrade: eligibility.requiresProUpgrade,
      };

      // Only show breakdown to the designer themselves
      if (isOwnProfile) {
        response.breakdown = {
          taggedProjectsScore: ranking.taggedProjectsScore,
          completenessScore: ranking.completenessScore,
          engagementScore: ranking.engagementScore,
          editorialScore: ranking.editorialScore,
          vendorDiversityScore: ranking.vendorDiversityScore,
          recencyScore: ranking.recencyScore,
        };

        // Generate improvement suggestions
        response.suggestions = generateDesignerSuggestions(
          response.breakdown,
          ranking.isEligible
        );
      }
    } else {
      // Calculate scores on-the-fly for users without a ranking
      const scores = await calculateDesignerScores(userId);
      const totalScore = calculateDesignerTotalScore(scores);

      // Calculate potential rank for non-eligible users
      const potentialRank = !eligibility.isEligible
        ? await calculatePotentialRank(userId, totalScore)
        : null;

      response = {
        rank: potentialRank,
        rankChange: 0,
        totalScore,
        isEligible: eligibility.isEligible,
        requiresProUpgrade: eligibility.requiresProUpgrade,
      };

      if (isOwnProfile) {
        response.breakdown = scores;
        response.suggestions = generateDesignerSuggestions(scores, eligibility.isEligible);
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] /api/directory/designers/[userId] error:', error);
    return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 });
  }
}

/**
 * POST /api/directory/designers/[userId]
 * Trigger ranking recalculation for a designer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const session = await getServerSession(authOptions);

    // Only allow the designer themselves or admins to trigger recalculation
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isOwnProfile = session.user.id === userId;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isOwnProfile && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Trigger ranking update
    const result = await updateDesignerRanking(userId);

    return NextResponse.json({
      success: result.success,
      rank: result.rank,
      rankChange: result.rankChange,
    });
  } catch (error) {
    console.error('[API] POST /api/directory/designers/[userId] error:', error);
    return NextResponse.json({ error: 'Failed to update ranking' }, { status: 500 });
  }
}

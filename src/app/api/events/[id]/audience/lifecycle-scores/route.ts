export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/[id]/audience/lifecycle-scores
 * Get project lifecycle scores for designers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const stage = url.searchParams.get('stage');
    const minScore = parseFloat(url.searchParams.get('minScore') || '0.5');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: params.id },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const where: any = {
      overallLifecycleScore: { gte: minScore },
    };

    if (stage) {
      where.currentStage = stage;
    }

    const lifecycleScores = await prisma.projectLifecycleScore.findMany({
      where,
      orderBy: { overallLifecycleScore: 'desc' },
      take: limit,
      include: {
        designer: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImage: true,
            location: true,
            specialties: true,
            budgetRange: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: lifecycleScores.length,
      lifecycleScores: lifecycleScores.map((score) => ({
        designer: score.designer,
        projectId: score.projectId,
        lifecycle: {
          stage: score.currentStage,
          overallScore: score.overallLifecycleScore,
          procurementReadiness: score.procurementReadinessScore,
          budgetClarity: score.budgetClarityScore,
          timelineUrgency: score.timelineUrgencyScore,
        },
        indicators: {
          hasActiveSelections: score.hasActiveSelections,
          hasPendingQuotes: score.hasPendingQuotes,
          hasRecentActivity: score.hasRecentActivity,
        },
        estimatedProcurementDate: score.estimatedProcurementDate,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching lifecycle scores:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}





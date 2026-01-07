import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/events/[id]/ai/optimize-guest-list
 * AI-powered guest list optimization
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currentList, optimizationGoals, maxSize } = body;

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: params.id },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get designer activity profiles for scoring
    const activityProfiles = await prisma.designerActivityProfile.findMany({
      where: {
        designer: {
          email: {
            in: currentList.map((c: any) => c.email),
          },
        },
      },
      include: {
        designer: {
          select: {
            id: true,
            email: true,
            name: true,
            location: true,
            specialties: true,
          },
        },
      },
    });

    // Score each contact based on optimization goals
    const scoredContacts = currentList.map((contact: any) => {
      const profile = activityProfiles.find(
        (p) => p.designer.email === contact.email
      );

      let score = 0.5; // Base score

      if (profile) {
        // Engagement-based scoring
        if (optimizationGoals.includes('high_engagement')) {
          score +=
            (profile.eventEngagementScore +
              profile.productEngagementScore) /
            4;
        }

        // Proximity-based scoring
        if (optimizationGoals.includes('purchase_ready')) {
          score += profile.proximityToPurchaseScore / 2;
        }

        // Lifecycle-based scoring
        if (optimizationGoals.includes('procurement_ready')) {
          score += profile.lifecycleScore / 2;
        }

        // Location matching
        if (
          optimizationGoals.includes('location_match') &&
          event.city &&
          profile.designer.location?.includes(event.city)
        ) {
          score += 0.2;
        }

        // Specialty matching
        if (
          optimizationGoals.includes('specialty_match') &&
          event.designStyles &&
          profile.designer.specialties.some((s) =>
            event.designStyles.includes(s)
          )
        ) {
          score += 0.15;
        }
      }

      return {
        ...contact,
        score: Math.min(score, 1.0), // Cap at 1.0
        profile: profile?.designer,
      };
    });

    // Sort by score and take top N
    const optimized = scoredContacts
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSize || currentList.length);

    // Calculate optimization metrics
    const avgScore = optimized.reduce((sum, c) => sum + c.score, 0) / optimized.length;
    const removed = currentList.length - optimized.length;

    return NextResponse.json({
      success: true,
      optimized: optimized.map((c) => ({
        email: c.email,
        name: c.name,
        score: c.score,
        profile: c.profile,
      })),
      metrics: {
        originalSize: currentList.length,
        optimizedSize: optimized.length,
        removed,
        averageScore: avgScore,
        optimizationGoals,
      },
    });
  } catch (error: any) {
    console.error('Error optimizing guest list:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}





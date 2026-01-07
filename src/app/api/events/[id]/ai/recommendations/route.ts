import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/[id]/ai/recommendations
 * Get AI-powered recommendations for event optimization
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
    const type = url.searchParams.get('type'); // "guests" | "products" | "timing" | "all"

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        hostProfile: true,
        engagementMetrics: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const recommendations: any = {
      guests: [],
      products: [],
      timing: [],
      engagement: [],
    };

    // Guest recommendations
    if (type === 'guests' || type === 'all') {
      // Find designers with high engagement but not yet invited
      const highEngagementDesigners = await prisma.designerActivityProfile.findMany({
        where: {
          eventEngagementScore: { gte: 0.7 },
          designer: {
            rsvps: {
              none: { eventId: params.id },
            },
          },
        },
        take: 10,
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
        orderBy: { eventEngagementScore: 'desc' },
      });

      recommendations.guests = highEngagementDesigners.map((profile) => ({
        type: 'add_guest',
        priority: 'high',
        designer: profile.designer,
        reason: `High engagement score (${profile.eventEngagementScore.toFixed(2)})`,
        action: 'Invite to event',
      }));
    }

    // Product recommendations
    if (type === 'products' || type === 'all') {
      // Find products with high match scores but low event engagement
      const highMatchProducts = await prisma.vendorProductMatchScore.findMany({
        where: {
          overallMatchScore: { gte: 0.7 },
          eventId: params.id,
        },
        take: 10,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              category: true,
            },
          },
        },
        orderBy: { overallMatchScore: 'desc' },
      });

      recommendations.products = highMatchProducts.map((match) => ({
        type: 'feature_product',
        priority: 'medium',
        product: match.product,
        matchScore: match.overallMatchScore,
        reason: `High match score with event audience`,
        action: 'Feature in event',
      }));
    }

    // Timing recommendations
    if (type === 'timing' || type === 'all') {
      const daysUntilEvent = Math.ceil(
        (new Date(event.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilEvent > 7) {
        recommendations.timing.push({
          type: 'send_reminder',
          priority: 'low',
          reason: `Event is ${daysUntilEvent} days away`,
          action: 'Send reminder to invited guests',
        });
      }

      if (daysUntilEvent <= 3 && daysUntilEvent > 0) {
        recommendations.timing.push({
          type: 'final_notice',
          priority: 'high',
          reason: `Event is ${daysUntilEvent} days away`,
          action: 'Send final RSVP reminder',
        });
      }
    }

    // Engagement recommendations
    if (type === 'engagement' || type === 'all') {
      const metrics = event.engagementMetrics;
      if (metrics) {
        const rsvpRate = metrics.totalRSVPs / Math.max(metrics.totalInvites, 1);
        
        if (rsvpRate < 0.3) {
          recommendations.engagement.push({
            type: 'improve_rsvp',
            priority: 'high',
            reason: `Low RSVP rate (${(rsvpRate * 100).toFixed(1)}%)`,
            action: 'Send personalized follow-up emails',
          });
        }

        if (metrics.productViews > 0) {
          const conversionRate = metrics.productSaves / metrics.productViews;
          if (conversionRate < 0.1) {
            recommendations.engagement.push({
              type: 'improve_product_engagement',
              priority: 'medium',
              reason: `Low product save rate (${(conversionRate * 100).toFixed(1)}%)`,
              action: 'Optimize product presentation',
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      eventId: params.id,
      recommendations,
      summary: {
        total: Object.values(recommendations).flat().length,
        byPriority: {
          high: Object.values(recommendations).flat().filter((r: any) => r.priority === 'high').length,
          medium: Object.values(recommendations).flat().filter((r: any) => r.priority === 'medium').length,
          low: Object.values(recommendations).flat().filter((r: any) => r.priority === 'low').length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching AI recommendations:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}





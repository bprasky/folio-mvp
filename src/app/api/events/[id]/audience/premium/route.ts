import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/[id]/audience/premium
 * Get premium curated audience lists for purchase
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
    const category = url.searchParams.get('category'); // "high_engagement" | "proximity_purchase" | "lifecycle_ready"
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: params.id },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    let designers: any[] = [];

    if (category === 'high_engagement') {
      // Get designers with high engagement scores
      const profiles = await prisma.designerActivityProfile.findMany({
        where: {
          OR: [
            { eventEngagementScore: { gte: 0.7 } },
            { productEngagementScore: { gte: 0.7 } },
            { vendorEngagementScore: { gte: 0.7 } },
          ],
        },
        orderBy: [
          { eventEngagementScore: 'desc' },
          { productEngagementScore: 'desc' },
        ],
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

      designers = profiles.map((profile) => ({
        ...profile.designer,
        scores: {
          eventEngagement: profile.eventEngagementScore,
          productEngagement: profile.productEngagementScore,
          vendorEngagement: profile.vendorEngagementScore,
        },
        metrics: {
          totalEventsAttended: profile.totalEventsAttended,
          totalProductsSaved: profile.totalProductsSaved,
          totalVendorsEngaged: profile.totalVendorsEngaged,
        },
      }));
    } else if (category === 'proximity_purchase') {
      // Get designers with high proximity to purchase
      const indicators = await prisma.proximityToPurchaseIndicator.findMany({
        where: {
          proximityScore: { gte: 0.6 },
          OR: [
            { hasActiveProjects: true },
            { hasRecentSaves: true },
            { hasPendingQuotes: true },
          ],
        },
        orderBy: { proximityScore: 'desc' },
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

      designers = indicators.map((indicator) => ({
        ...indicator.designer,
        proximity: {
          score: indicator.proximityScore,
          hasActiveProjects: indicator.hasActiveProjects,
          hasRecentSaves: indicator.hasRecentSaves,
          hasPendingQuotes: indicator.hasPendingQuotes,
          estimatedPurchaseWindow: indicator.estimatedPurchaseWindow,
        },
      }));
    } else if (category === 'lifecycle_ready') {
      // Get designers with projects in procurement-ready stages
      const lifecycleScores = await prisma.projectLifecycleScore.findMany({
        where: {
          currentStage: {
            in: ['spec_locked', 'in_procurement', 'install'],
          },
          overallLifecycleScore: { gte: 0.7 },
          hasActiveSelections: true,
        },
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

      designers = lifecycleScores.map((score) => ({
        ...score.designer,
        lifecycle: {
          stage: score.currentStage,
          overallScore: score.overallLifecycleScore,
          procurementReadiness: score.procurementReadinessScore,
          hasActiveSelections: score.hasActiveSelections,
          hasPendingQuotes: score.hasPendingQuotes,
        },
      }));
    } else {
      // Default: return all premium categories combined
      const [highEngagement, proximity, lifecycle] = await Promise.all([
        prisma.designerActivityProfile.findMany({
          where: {
            eventEngagementScore: { gte: 0.7 },
          },
          take: Math.floor(limit / 3),
          include: { designer: true },
        }),
        prisma.proximityToPurchaseIndicator.findMany({
          where: {
            proximityScore: { gte: 0.6 },
          },
          take: Math.floor(limit / 3),
          include: { designer: true },
        }),
        prisma.projectLifecycleScore.findMany({
          where: {
            overallLifecycleScore: { gte: 0.7 },
          },
          take: Math.floor(limit / 3),
          include: { designer: true },
        }),
      ]);

      designers = [
        ...highEngagement.map((p) => ({ ...p.designer, category: 'high_engagement' })),
        ...proximity.map((p) => ({ ...p.designer, category: 'proximity_purchase' })),
        ...lifecycle.map((p) => ({ ...p.designer, category: 'lifecycle_ready' })),
      ].slice(0, limit);
    }

    return NextResponse.json({
      success: true,
      category: category || 'all',
      count: designers.length,
      designers,
      pricing: {
        perContact: 0.50, // $0.50 per contact
        bulkDiscount: {
          threshold: 100,
          discount: 0.15, // 15% off for 100+
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching premium audience:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[id]/audience/premium
 * Purchase a premium curated list
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
    const { category, contactIds, listName } = body;

    if (!category || !contactIds || !Array.isArray(contactIds)) {
      return NextResponse.json(
        { error: 'category and contactIds array are required' },
        { status: 400 }
      );
    }

    // Get or create host profile
    let hostProfile = await prisma.eventHostProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!hostProfile) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      hostProfile = await prisma.eventHostProfile.create({
        data: {
          userId: session.user.id,
          hostName: user.name,
          hostEmail: user.email,
          hostPhone: user.phone,
          hostCompany: user.companyName,
          hostTitle: user.title,
        },
      });
    }

    // Calculate pricing
    const basePrice = 0.50;
    const bulkDiscount = contactIds.length >= 100 ? 0.15 : 0;
    const totalPrice = contactIds.length * basePrice * (1 - bulkDiscount);

    // Create premium invite list
    const inviteList = await prisma.eventInviteList.create({
      data: {
        hostProfileId: hostProfile.id,
        name: listName || `Premium ${category} List - ${new Date().toLocaleDateString()}`,
        description: `Premium curated list: ${category}`,
        listType: 'premium',
        contactIds: contactIds,
        isPremium: true,
        priceUsd: totalPrice,
      },
    });

    return NextResponse.json({
      success: true,
      list: inviteList,
      pricing: {
        contactCount: contactIds.length,
        basePricePerContact: basePrice,
        bulkDiscount: bulkDiscount * 100,
        totalPrice,
      },
    });
  } catch (error: any) {
    console.error('Error purchasing premium list:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}





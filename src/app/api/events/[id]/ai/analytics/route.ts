export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/[id]/ai/analytics
 * Get AI-powered event → product → designer analytics
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

    if (event.hostProfile?.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get comprehensive analytics
    const [
      productEdges,
      designerEdges,
      vendorEdges,
      topProducts,
      topDesigners,
      topVendors,
    ] = await Promise.all([
      // Product engagement
      prisma.eventProductEdge.findMany({
        where: { eventId: params.id },
        include: {
          product: {
            include: {
              vendorRecord: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { views: 'desc' },
        take: 20,
      }),

      // Designer engagement
      prisma.eventDesignerEdge.findMany({
        where: { eventId: params.id },
        include: {
          designer: {
            select: {
              id: true,
              name: true,
              email: true,
              location: true,
            },
          },
        },
        orderBy: { views: 'desc' },
        take: 20,
      }),

      // Vendor engagement
      prisma.eventVendorEdge.findMany({
        where: { eventId: params.id },
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { productViews: 'desc' },
      }),

      // Top products by engagement
      prisma.eventProductEdge.findMany({
        where: { eventId: params.id },
        orderBy: [{ saves: 'desc' }, { views: 'desc' }],
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
      }),

      // Top designers by engagement
      prisma.eventDesignerEdge.findMany({
        where: { eventId: params.id },
        orderBy: [{ saves: 'desc' }, { views: 'desc' }],
        take: 10,
        include: {
          designer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),

      // Top vendors by ROI
      prisma.eventVendorEdge.findMany({
        where: { eventId: params.id },
        orderBy: { actualROI: 'desc' },
        take: 10,
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // Calculate insights
    const totalProductViews = productEdges.reduce((sum, e) => sum + e.views, 0);
    const totalProductSaves = productEdges.reduce((sum, e) => sum + e.saves, 0);
    const totalDesignerEngagements = designerEdges.reduce((sum, e) => sum + e.views + e.saves, 0);
    const totalVendorROI = vendorEdges.reduce((sum, e) => sum + (e.actualROI || 0), 0);

    const insights = {
      productEngagement: {
        totalViews: totalProductViews,
        totalSaves: totalProductSaves,
        conversionRate: totalProductViews > 0 ? totalProductSaves / totalProductViews : 0,
        topProducts: topProducts.map((e) => ({
          product: e.product,
          metrics: {
            views: e.views,
            saves: e.saves,
            clicks: e.clicks,
            conversionRate: e.views > 0 ? e.saves / e.views : 0,
          },
        })),
      },
      designerEngagement: {
        totalEngagements: totalDesignerEngagements,
        topDesigners: topDesigners.map((e) => ({
          designer: e.designer,
          metrics: {
            views: e.views,
            saves: e.saves,
            clicks: e.clicks,
          },
        })),
      },
      vendorPerformance: {
        totalROI: totalVendorROI,
        topVendors: topVendors.map((e) => ({
          vendor: e.vendor,
          metrics: {
            productViews: e.productViews,
            productSaves: e.productSaves,
            repEngagements: e.repEngagements,
            estimatedROI: e.estimatedROI,
            actualROI: e.actualROI,
          },
        })),
      },
      correlations: {
        // Product → Designer correlations
        productDesignerPairs: productEdges.slice(0, 10).map((pe) => ({
          product: pe.product,
          potentialDesigners: designerEdges
            .filter((de) => de.views > 0)
            .slice(0, 5)
            .map((de) => de.designer),
        })),
      },
    };

    return NextResponse.json({
      success: true,
      eventId: params.id,
      eventTitle: event.title,
      insights,
      summary: {
        totalProducts: productEdges.length,
        totalDesigners: designerEdges.length,
        totalVendors: vendorEdges.length,
        overallEngagement: totalProductViews + totalDesignerEngagements,
        estimatedRevenue: totalVendorROI,
      },
    });
  } catch (error: any) {
    console.error('Error fetching AI analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}





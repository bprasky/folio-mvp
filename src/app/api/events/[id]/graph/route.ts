import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/[id]/graph
 * Get the complete event graph with all edges and relationships
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
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check permissions (host or admin)
    if (
      event.hostProfile?.userId !== session.user.id &&
      session.user.role !== 'ADMIN'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all graph edges
    const [
      designerEdges,
      vendorEdges,
      productEdges,
      repEdges,
      relationshipEdges,
      engagementMetrics,
    ] = await Promise.all([
      // Designer edges
      prisma.eventDesignerEdge.findMany({
        where: { eventId: params.id },
        include: {
          designer: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImage: true,
              role: true,
              location: true,
            },
          },
        },
      }),

      // Vendor edges
      prisma.eventVendorEdge.findMany({
        where: { eventId: params.id },
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              primaryEmail: true,
              logoUrl: true,
            },
          },
        },
      }),

      // Product edges
      prisma.eventProductEdge.findMany({
        where: { eventId: params.id },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              category: true,
              brand: true,
            },
          },
        },
      }),

      // Rep edges
      prisma.eventRepEdge.findMany({
        where: { eventId: params.id },
        include: {
          rep: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImage: true,
              role: true,
            },
          },
        },
      }),

      // Relationship edges
      prisma.eventRelationshipEdge.findMany({
        where: { eventId: params.id },
      }),

      // Engagement metrics
      prisma.eventEngagementMetrics.findUnique({
        where: { eventId: params.id },
      }),
    ]);

    // Build graph structure
    const graph = {
      event: {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
      },
      nodes: {
        designers: designerEdges.map((edge) => ({
          id: edge.designer.id,
          type: 'designer',
          data: edge.designer,
          edge: {
            type: edge.edgeType,
            weight: edge.weight,
            views: edge.views,
            saves: edge.saves,
            clicks: edge.clicks,
          },
        })),
        vendors: vendorEdges.map((edge) => ({
          id: edge.vendor.id,
          type: 'vendor',
          data: edge.vendor,
          edge: {
            type: edge.edgeType,
            weight: edge.weight,
            productViews: edge.productViews,
            productSaves: edge.productSaves,
            repEngagements: edge.repEngagements,
            estimatedROI: edge.estimatedROI,
            actualROI: edge.actualROI,
          },
        })),
        products: productEdges.map((edge) => ({
          id: edge.product.id,
          type: 'product',
          data: edge.product,
          edge: {
            type: edge.edgeType,
            weight: edge.weight,
            views: edge.views,
            saves: edge.saves,
            clicks: edge.clicks,
            conversionRate: edge.conversionRate,
          },
        })),
        reps: repEdges.map((edge) => ({
          id: edge.rep.id,
          type: 'rep',
          data: edge.rep,
          edge: {
            type: edge.edgeType,
            weight: edge.weight,
            connectionsMade: edge.connectionsMade,
            productsPresented: edge.productsPresented,
            quotesSent: edge.quotesSent,
          },
        })),
      },
      edges: relationshipEdges.map((edge) => ({
        id: edge.id,
        sourceType: edge.sourceType,
        sourceId: edge.sourceId,
        targetType: edge.targetType,
        targetId: edge.targetId,
        relationshipType: edge.relationshipType,
        weight: edge.weight,
      })),
      metrics: engagementMetrics || {
        totalInvites: 0,
        totalRSVPs: 0,
        totalAttendees: 0,
        totalEngagements: 0,
      },
      summary: {
        totalDesigners: designerEdges.length,
        totalVendors: vendorEdges.length,
        totalProducts: productEdges.length,
        totalReps: repEdges.length,
        totalRelationships: relationshipEdges.length,
      },
    };

    return NextResponse.json(graph);
  } catch (error: any) {
    console.error('Error fetching event graph:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[id]/graph/edges
 * Create or update graph edges (automatically called by system)
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
    const { edgeType, sourceType, sourceId, targetType, targetId, metadata } =
      body;

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: params.id },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Determine which edge table to use
    let edge: any;

    if (targetType === 'designer' && sourceType === 'event') {
      // EventDesignerEdge
      const existing = await prisma.eventDesignerEdge.findFirst({
        where: {
          eventId: params.id,
          designerId: targetId,
        },
      });

      if (existing) {
        edge = await prisma.eventDesignerEdge.update({
          where: { id: existing.id },
          data: {
            weight: { increment: 1.0 },
            lastSeenAt: new Date(),
          },
        });
      } else {
        edge = await prisma.eventDesignerEdge.create({
          data: {
            eventId: params.id,
            designerId: targetId,
            edgeType: edgeType || 'engaged',
            weight: 1.0,
          },
        });
      }
    } else if (targetType === 'vendor' && sourceType === 'event') {
      // EventVendorEdge
      const existing = await prisma.eventVendorEdge.findFirst({
        where: {
          eventId: params.id,
          vendorId: targetId,
        },
      });

      if (existing) {
        edge = await prisma.eventVendorEdge.update({
          where: { id: existing.id },
          data: {
            weight: { increment: 1.0 },
          },
        });
      } else {
        edge = await prisma.eventVendorEdge.create({
          data: {
            eventId: params.id,
            vendorId: targetId,
            edgeType: edgeType || 'exhibitor',
            weight: 1.0,
          },
        });
      }
    } else if (targetType === 'product' && sourceType === 'event') {
      // EventProductEdge
      const existing = await prisma.eventProductEdge.findFirst({
        where: {
          eventId: params.id,
          productId: targetId,
        },
      });

      if (existing) {
        edge = await prisma.eventProductEdge.update({
          where: { id: existing.id },
          data: {
            weight: { increment: 1.0 },
          },
        });
      } else {
        edge = await prisma.eventProductEdge.create({
          data: {
            eventId: params.id,
            productId: targetId,
            edgeType: edgeType || 'featured',
            weight: 1.0,
          },
        });
      }
    } else if (targetType === 'rep' && sourceType === 'event') {
      // EventRepEdge
      const existing = await prisma.eventRepEdge.findFirst({
        where: {
          eventId: params.id,
          repId: targetId,
        },
      });

      if (existing) {
        edge = await prisma.eventRepEdge.update({
          where: { id: existing.id },
          data: {
            weight: { increment: 1.0 },
          },
        });
      } else {
        edge = await prisma.eventRepEdge.create({
          data: {
            eventId: params.id,
            repId: targetId,
            edgeType: edgeType || 'invited',
            weight: 1.0,
          },
        });
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid edge type combination' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      edge,
    });
  } catch (error: any) {
    console.error('Error creating graph edge:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


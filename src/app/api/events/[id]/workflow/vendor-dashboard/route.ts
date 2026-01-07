import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/events/[id]/workflow/vendor-dashboard
 * Update vendor dashboards with event engagement data
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

    if (event.hostProfile?.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create workflow job
    const job = await prisma.eventWorkflowJob.create({
      data: {
        eventId: params.id,
        jobType: 'update_vendor_dashboard',
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Get all vendor edges for this event
    const vendorEdges = await prisma.eventVendorEdge.findMany({
      where: { eventId: params.id },
      include: {
        vendor: true,
      },
    });

    const updates: any[] = [];

    for (const edge of vendorEdges) {
      // Aggregate metrics for this vendor
      const productEdges = await prisma.eventProductEdge.findMany({
        where: {
          eventId: params.id,
          product: {
            vendorRecordId: edge.vendorId,
          },
        },
      });

      const totalViews = productEdges.reduce((sum, e) => sum + e.views, 0);
      const totalSaves = productEdges.reduce((sum, e) => sum + e.saves, 0);
      const totalClicks = productEdges.reduce((sum, e) => sum + e.clicks, 0);

      // Update vendor edge with aggregated metrics
      await prisma.eventVendorEdge.update({
        where: { id: edge.id },
        data: {
          productViews: totalViews,
          productSaves: totalSaves,
          repEngagements: edge.repEngagements,
        },
      });

      updates.push({
        vendorId: edge.vendorId,
        vendorName: edge.vendor.name,
        metrics: {
          productViews: totalViews,
          productSaves: totalSaves,
          productClicks: totalClicks,
          repEngagements: edge.repEngagements,
        },
      });
    }

    // Update job status
    await prisma.eventWorkflowJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: {
          vendorsUpdated: updates.length,
          updates,
        },
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      vendorsUpdated: updates.length,
      updates,
      message: 'Vendor dashboards updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating vendor dashboards:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}





export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/events/[id]/workflow/roi
 * Attach event ROI metrics to vendors
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
    const { vendorId, estimatedROI, actualROI, notes } = body;

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
        jobType: 'attach_roi',
        status: 'running',
        jobData: { vendorId, estimatedROI, actualROI, notes },
        startedAt: new Date(),
      },
    });

    // Update or create vendor edge with ROI
    let vendorEdge = await prisma.eventVendorEdge.findFirst({
      where: {
        eventId: params.id,
        vendorId: vendorId,
      },
    });

    if (vendorEdge) {
      vendorEdge = await prisma.eventVendorEdge.update({
        where: { id: vendorEdge.id },
        data: {
          estimatedROI: estimatedROI || vendorEdge.estimatedROI,
          actualROI: actualROI || vendorEdge.actualROI,
        },
      });
    } else {
      // Create new vendor edge if it doesn't exist
      vendorEdge = await prisma.eventVendorEdge.create({
        data: {
          eventId: params.id,
          vendorId: vendorId,
          edgeType: 'sponsor',
          estimatedROI,
          actualROI,
        },
      });
    }

    // Update engagement metrics
    const engagementMetrics = await prisma.eventEngagementMetrics.findUnique({
      where: { eventId: params.id },
    });

    if (engagementMetrics && actualROI) {
      await prisma.eventEngagementMetrics.update({
        where: { eventId: params.id },
        data: {
          actualRevenue: (engagementMetrics.actualRevenue || 0) + actualROI,
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
          vendorId,
          estimatedROI,
          actualROI,
          notes,
        },
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      vendorEdge,
      message: 'ROI attached to vendor successfully',
    });
  } catch (error: any) {
    console.error('Error attaching ROI:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}





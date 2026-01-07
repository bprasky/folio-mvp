import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/events/[id]/workflow/followups
 * Generate designer product follow-ups based on event engagement
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
        jobType: 'generate_followups',
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Get designers who engaged with products but didn't save
    const productEdges = await prisma.eventProductEdge.findMany({
      where: {
        eventId: params.id,
        views: { gt: 0 },
        saves: 0, // Viewed but didn't save
      },
      include: {
        product: {
          include: {
            vendorRecord: true,
          },
        },
      },
    });

    // Get designer edges to match products to designers
    const designerEdges = await prisma.eventDesignerEdge.findMany({
      where: {
        eventId: params.id,
        views: { gt: 0 },
      },
    });

    const followups: any[] = [];

    // Generate follow-up suggestions
    for (const productEdge of productEdges) {
      // Find designers who viewed this product
      const interestedDesigners = designerEdges.filter((de) => {
        // In a real implementation, you'd track which designer viewed which product
        // For now, we'll create followups for all designers who engaged
        return de.views > 0;
      });

      for (const designerEdge of interestedDesigners) {
        followups.push({
          designerId: designerEdge.designerId,
          productId: productEdge.productId,
          productName: productEdge.product.name,
          vendorName: productEdge.product.vendorRecord?.name,
          reason: 'Viewed but not saved - potential interest',
          suggestedAction: 'Send product details or offer',
        });
      }
    }

    // Update job status
    await prisma.eventWorkflowJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: {
          followupsGenerated: followups.length,
          followups,
        },
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      followupsGenerated: followups.length,
      followups,
      message: 'Designer product follow-ups generated successfully',
    });
  } catch (error: any) {
    console.error('Error generating follow-ups:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}





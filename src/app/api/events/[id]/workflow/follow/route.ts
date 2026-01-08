export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/events/[id]/workflow/follow
 * Auto-follow relationships based on event engagement
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
    const { followType } = body; // "designers" | "vendors" | "products" | "all"

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
        jobType: 'follow_relationships',
        status: 'running',
        jobData: { followType },
        startedAt: new Date(),
      },
    });

    let relationshipsCreated = 0;

    // Get event engagement data
    const [designerEdges, vendorEdges, productEdges] = await Promise.all([
      prisma.eventDesignerEdge.findMany({
        where: {
          eventId: params.id,
          edgeType: { in: ['attended', 'engaged', 'saved_product'] },
        },
      }),
      prisma.eventVendorEdge.findMany({
        where: { eventId: params.id },
      }),
      prisma.eventProductEdge.findMany({
        where: {
          eventId: params.id,
          edgeType: { in: ['saved', 'tagged'] },
        },
      }),
    ]);

    // Create relationship edges based on engagement
    if (followType === 'designers' || followType === 'all') {
      for (const edge of designerEdges) {
        // Create relationship edge for host → designer
        const existing = await prisma.eventRelationshipEdge.findFirst({
          where: {
            hostProfileId: event.hostProfileId,
            sourceType: 'host',
            sourceId: event.hostProfileId || '',
            targetType: 'designer',
            targetId: edge.designerId,
            relationshipType: 'followed',
          },
        });

        if (!existing && event.hostProfileId) {
          await prisma.eventRelationshipEdge.create({
            data: {
              hostProfileId: event.hostProfileId,
              sourceType: 'host',
              sourceId: event.hostProfileId,
              targetType: 'designer',
              targetId: edge.designerId,
              relationshipType: 'followed',
              eventId: params.id,
              weight: edge.weight,
            },
          });
          relationshipsCreated++;
        }
      }
    }

    if (followType === 'vendors' || followType === 'all') {
      for (const edge of vendorEdges) {
        if (event.hostProfileId) {
          const existing = await prisma.eventRelationshipEdge.findFirst({
            where: {
              hostProfileId: event.hostProfileId,
              sourceType: 'host',
              sourceId: event.hostProfileId,
              targetType: 'vendor',
              targetId: edge.vendorId,
              relationshipType: 'followed',
            },
          });

          if (!existing) {
            await prisma.eventRelationshipEdge.create({
              data: {
                hostProfileId: event.hostProfileId,
                sourceType: 'host',
                sourceId: event.hostProfileId,
                targetType: 'vendor',
                targetId: edge.vendorId,
                relationshipType: 'followed',
                eventId: params.id,
                weight: edge.weight,
              },
            });
            relationshipsCreated++;
          }
        }
      }
    }

    // Update job status
    await prisma.eventWorkflowJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: {
          relationshipsCreated,
          followType,
        },
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      relationshipsCreated,
      message: 'Relationships auto-followed successfully',
    });
  } catch (error: any) {
    console.error('Error auto-following relationships:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}





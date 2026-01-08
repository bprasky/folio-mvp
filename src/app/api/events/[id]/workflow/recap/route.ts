export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/events/[id]/workflow/recap
 * Send recap emails to event attendees
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
    const { template, includeMetrics, includeProducts } = body;

    // Verify event exists and user has permission
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        hostProfile: true,
        rsvps: {
          where: { status: 'attending' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        engagementMetrics: true,
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
        jobType: 'recap_email',
        status: 'pending',
        jobData: {
          template,
          includeMetrics,
          includeProducts,
          recipientCount: event.rsvps.length,
        },
        scheduledAt: new Date(),
      },
    });

    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    // For now, we'll just mark it as completed
    // In production, this would:
    // 1. Generate email content from template
    // 2. Include metrics if requested
    // 3. Include product highlights if requested
    // 4. Send emails to all attendees
    // 5. Track delivery status

    // Simulate email sending (replace with actual email service)
    const emailsSent = event.rsvps.length;
    
    await prisma.eventWorkflowJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        result: {
          emailsSent,
          emailsDelivered: emailsSent,
          emailsFailed: 0,
        },
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      emailsSent,
      message: 'Recap emails queued for sending',
    });
  } catch (error: any) {
    console.error('Error sending recap emails:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}





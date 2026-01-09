export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const RespondSchema = z.object({
  response: z.enum(['ACCEPT', 'DECLINE']),
  declineReason: z.string().max(500).optional(),
});

/**
 * POST /api/collaboration/stories/[id]/respond
 * Designer accepts or declines the collaboration invitation
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

    const storyId = params.id;

    // Get the story
    const story = await prisma.collaborationStory.findUnique({
      where: { id: storyId },
      select: {
        id: true,
        designerUserId: true,
        status: true,
        vendorOrg: {
          select: { name: true },
        },
      },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Only the invited designer can respond
    if (story.designerUserId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the invited designer can respond' },
        { status: 403 }
      );
    }

    // Can only respond to INVITED status
    if (story.status !== 'INVITED') {
      return NextResponse.json(
        { error: 'This invitation has already been responded to' },
        { status: 400 }
      );
    }

    // Parse body
    const body = await request.json();
    const input = RespondSchema.parse(body);

    if (input.response === 'ACCEPT') {
      // Accept the invitation - move to ACCEPTED status
      const updatedStory = await prisma.collaborationStory.update({
        where: { id: storyId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
        include: {
          vendorOrg: {
            select: { id: true, name: true, logo: true },
          },
          designer: {
            select: { id: true, name: true, profileImage: true },
          },
        },
      });

      // TODO: Notify vendor that designer accepted
      // await sendCollaborationAcceptedNotification(storyId);

      console.log('[collaboration/stories/respond] Accepted:', {
        storyId,
        designerUserId: session.user.id,
      });

      return NextResponse.json({
        success: true,
        status: 'ACCEPTED',
        story: updatedStory,
        message: `You've accepted the collaboration with ${story.vendorOrg.name}. You can now start the interview.`,
      });
    } else {
      // Decline the invitation
      const updatedStory = await prisma.collaborationStory.update({
        where: { id: storyId },
        data: {
          status: 'DECLINED',
        },
      });

      // TODO: Notify vendor that designer declined
      // await sendCollaborationDeclinedNotification(storyId, input.declineReason);

      console.log('[collaboration/stories/respond] Declined:', {
        storyId,
        designerUserId: session.user.id,
        reason: input.declineReason,
      });

      return NextResponse.json({
        success: true,
        status: 'DECLINED',
        message: 'You have declined this collaboration invitation.',
      });
    }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[collaboration/stories/respond] POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to respond to invitation' },
      { status: 500 }
    );
  }
}

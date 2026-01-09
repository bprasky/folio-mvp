export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { assertCollaborationStoryEdit } from '@/lib/collaboration/auth';
import { CollaborationStoryStatus } from '@prisma/client';

const ApproveSchema = z.object({
  approved: z.boolean(),
  feedback: z.string().max(1000).optional(), // If rejecting, can provide feedback
});

/**
 * POST /api/collaboration/stories/[id]/approve
 * Party approves or requests changes to the generated story
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

    // Check access and get role
    const { role } = await assertCollaborationStoryEdit(session.user.id, storyId);

    if (role !== 'vendor' && role !== 'designer') {
      return NextResponse.json(
        { error: 'Only participants can approve' },
        { status: 403 }
      );
    }

    // Get the story
    const story = await prisma.collaborationStory.findUnique({
      where: { id: storyId },
      include: {
        vendorOrg: { select: { name: true } },
        designer: { select: { name: true } },
      },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Verify story is in a reviewable state
    const reviewableStatuses: CollaborationStoryStatus[] = [
      'REVIEW',
      'VENDOR_APPROVED',
      'DESIGNER_APPROVED',
    ];

    if (!reviewableStatuses.includes(story.status)) {
      return NextResponse.json(
        {
          error: 'Story is not ready for approval',
          currentStatus: story.status,
        },
        { status: 400 }
      );
    }

    // Parse body
    const body = await request.json();
    const input = ApproveSchema.parse(body);

    if (!input.approved) {
      // Request changes - go back to REVIEW status
      await prisma.collaborationStory.update({
        where: { id: storyId },
        data: {
          status: 'REVIEW',
          // Store feedback for revision (could be enhanced with proper feedback model)
          generatedNarrative: {
            ...(story.generatedNarrative as object || {}),
            revisionFeedback: {
              from: role,
              feedback: input.feedback,
              requestedAt: new Date().toISOString(),
            },
          } as any,
        },
      });

      // TODO: Notify about requested changes
      // await sendRevisionRequestedNotification(storyId, role, input.feedback);

      console.log('[collaboration/stories/approve] Changes requested:', {
        storyId,
        role,
        feedback: input.feedback,
      });

      return NextResponse.json({
        success: true,
        status: 'REVIEW',
        message: 'Revision requested. The other party will be notified.',
      });
    }

    // Approve - determine new status
    let newStatus: CollaborationStoryStatus;
    let bothApproved = false;

    if (role === 'vendor') {
      if (story.status === 'DESIGNER_APPROVED') {
        // Designer already approved, now vendor approves = both approved
        newStatus = 'PUBLISHED'; // Will be set in publish route, but mark ready
        bothApproved = true;
      } else {
        newStatus = 'VENDOR_APPROVED';
      }
    } else {
      // designer
      if (story.status === 'VENDOR_APPROVED') {
        // Vendor already approved, now designer approves = both approved
        newStatus = 'PUBLISHED'; // Will be set in publish route, but mark ready
        bothApproved = true;
      } else {
        newStatus = 'DESIGNER_APPROVED';
      }
    }

    const updatedStory = await prisma.collaborationStory.update({
      where: { id: storyId },
      data: {
        status: newStatus,
        // If both approved, set publishedAt to mark as ready
        ...(bothApproved ? { publishedAt: new Date() } : {}),
      },
      include: {
        vendorOrg: { select: { id: true, name: true, logo: true } },
        designer: { select: { id: true, name: true, profileImage: true } },
      },
    });

    // TODO: Notify other party or both if now published
    // if (bothApproved) {
    //   await sendStoryPublishedNotification(storyId);
    // } else {
    //   await sendApprovalNotification(storyId, role);
    // }

    console.log('[collaboration/stories/approve] Approved:', {
      storyId,
      role,
      newStatus,
      bothApproved,
    });

    return NextResponse.json({
      success: true,
      status: newStatus,
      bothApproved,
      message: bothApproved
        ? 'Both parties have approved! The story is ready to publish.'
        : `You have approved. Waiting for ${role === 'vendor' ? 'designer' : 'vendor'} approval.`,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.error('[collaboration/stories/approve] POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to approve story' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/collaboration/stories/[id]/approve
 * Get current approval status
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

    const storyId = params.id;

    // Check access
    try {
      await assertCollaborationStoryEdit(session.user.id, storyId);
    } catch (error: any) {
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      throw error;
    }

    const story = await prisma.collaborationStory.findUnique({
      where: { id: storyId },
      select: {
        status: true,
        generatedNarrative: true,
      },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    const narrative = story.generatedNarrative as { revisionFeedback?: any } | null;

    return NextResponse.json({
      status: story.status,
      vendorApproved: story.status === 'VENDOR_APPROVED' || story.status === 'PUBLISHED',
      designerApproved: story.status === 'DESIGNER_APPROVED' || story.status === 'PUBLISHED',
      bothApproved: story.status === 'PUBLISHED',
      revisionFeedback: narrative?.revisionFeedback || null,
    });
  } catch (error) {
    console.error('[collaboration/stories/approve] GET failed:', error);
    return NextResponse.json(
      { error: 'Failed to get approval status' },
      { status: 500 }
    );
  }
}

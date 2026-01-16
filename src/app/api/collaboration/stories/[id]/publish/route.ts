export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertCollaborationStoryEdit } from '@/lib/collaboration/auth';

/**
 * POST /api/collaboration/stories/[id]/publish
 * Publish the story (requires both approvals)
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

    // Check access
    try {
      await assertCollaborationStoryEdit(session.user.id, storyId);
    } catch (error: any) {
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      throw error;
    }

    // Get the story
    const story = await prisma.collaborationStory.findUnique({
      where: { id: storyId },
      include: {
        vendorOrg: { select: { id: true, name: true } },
        designer: { select: { id: true, name: true } },
      },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Already published
    if (story.status === 'PUBLISHED') {
      return NextResponse.json({
        success: true,
        alreadyPublished: true,
        slug: story.slug,
        publishedAt: story.publishedAt,
      });
    }

    // Check if story has been approved by both parties
    // The approval process sets status to PUBLISHED when both approve
    // But we also accept if publishedAt is set (meaning both approved)
    const isReady =
      story.status === 'PUBLISHED' ||
      (story.publishedAt !== null);

    if (!isReady) {
      // Determine what's missing
      let missing: string[] = [];
      if (story.status === 'REVIEW') {
        missing = ['vendor approval', 'designer approval'];
      } else if (story.status === 'VENDOR_APPROVED') {
        missing = ['designer approval'];
      } else if (story.status === 'DESIGNER_APPROVED') {
        missing = ['vendor approval'];
      } else {
        missing = ['both approvals'];
      }

      return NextResponse.json(
        {
          error: 'Story requires approval from both parties before publishing',
          currentStatus: story.status,
          missing,
        },
        { status: 400 }
      );
    }

    // Publish the story
    const publishedStory = await prisma.collaborationStory.update({
      where: { id: storyId },
      data: {
        status: 'PUBLISHED',
        publishedAt: story.publishedAt || new Date(),
      },
      include: {
        vendorOrg: { select: { id: true, name: true, logo: true } },
        designer: { select: { id: true, name: true, profileImage: true } },
      },
    });

    // TODO: Send publish notifications
    // await sendStoryPublishedNotification(storyId);

    // TODO: Create any necessary search index entries
    // await indexCollaborationStory(storyId);

    console.log('[collaboration/stories/publish] Published:', {
      storyId,
      slug: story.slug,
      vendorOrg: story.vendorOrg.name,
      designer: story.designer.name,
    });

    return NextResponse.json({
      success: true,
      slug: publishedStory.slug,
      publishedAt: publishedStory.publishedAt,
      title: publishedStory.title,
      url: `/magazine/collaborations/${publishedStory.slug}`,
    });
  } catch (error: any) {
    console.error('[collaboration/stories/publish] POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to publish story' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/collaboration/stories/[id]/publish
 * Unpublish a story (move to archived)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storyId = params.id;

    // Check access - must be vendor (initiator) or admin
    const { role } = await assertCollaborationStoryEdit(session.user.id, storyId);

    if (role !== 'vendor' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only the vendor who initiated or an admin can unpublish' },
        { status: 403 }
      );
    }

    // Get the story
    const story = await prisma.collaborationStory.findUnique({
      where: { id: storyId },
      select: { status: true },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    if (story.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Story is not published' },
        { status: 400 }
      );
    }

    // Archive the story
    await prisma.collaborationStory.update({
      where: { id: storyId },
      data: {
        status: 'ARCHIVED',
      },
    });

    console.log('[collaboration/stories/publish] Unpublished:', { storyId });

    return NextResponse.json({
      success: true,
      status: 'ARCHIVED',
    });
  } catch (error: any) {
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.error('[collaboration/stories/publish] DELETE failed:', error);
    return NextResponse.json(
      { error: 'Failed to unpublish story' },
      { status: 500 }
    );
  }
}

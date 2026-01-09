export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  assertCollaborationStoryView,
  assertCollaborationStoryEdit,
} from '@/lib/collaboration/auth';

// Schema for updating story metadata
const UpdateStorySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  excerpt: z.string().max(500).optional(),
  heroImageUrl: z.string().url().optional(),
  taggedProductIds: z.array(z.string().uuid()).optional(),
  taggedProjectId: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/collaboration/stories/[id]
 * Get a specific collaboration story
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
      await assertCollaborationStoryView(session.user.id, storyId);
    } catch (error: any) {
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      throw error;
    }

    const story = await prisma.collaborationStory.findUnique({
      where: { id: storyId },
      include: {
        vendorOrg: {
          select: {
            id: true,
            name: true,
            logo: true,
            description: true,
          },
        },
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            bio: true,
            studio: true,
          },
        },
      },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    return NextResponse.json(story);
  } catch (error) {
    console.error('[collaboration/stories/[id]] GET failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collaboration story' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/collaboration/stories/[id]
 * Update story metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storyId = params.id;

    // Check edit access
    try {
      await assertCollaborationStoryEdit(session.user.id, storyId);
    } catch (error: any) {
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      throw error;
    }

    const body = await request.json();
    const input = UpdateStorySchema.parse(body);

    const story = await prisma.collaborationStory.update({
      where: { id: storyId },
      data: {
        ...input,
        updatedAt: new Date(),
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

    return NextResponse.json(story);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[collaboration/stories/[id]] PATCH failed:', error);
    return NextResponse.json(
      { error: 'Failed to update collaboration story' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/collaboration/stories/[id]
 * Delete a collaboration story (only if not published)
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

    // Check edit access
    const { role } = await assertCollaborationStoryEdit(session.user.id, storyId);

    // Get story to check status
    const story = await prisma.collaborationStory.findUnique({
      where: { id: storyId },
      select: { status: true },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Only allow deletion of non-published stories
    if (story.status === 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Published stories cannot be deleted' },
        { status: 400 }
      );
    }

    // Only vendor (initiator) or admin can delete
    if (role !== 'vendor' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only the vendor who initiated can delete the story' },
        { status: 403 }
      );
    }

    await prisma.collaborationStory.delete({
      where: { id: storyId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.error('[collaboration/stories/[id]] DELETE failed:', error);
    return NextResponse.json(
      { error: 'Failed to delete collaboration story' },
      { status: 500 }
    );
  }
}

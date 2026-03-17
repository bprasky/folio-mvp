export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { formatRoomName } from '@/lib/utils/formatRoomName';
import { inferRoomType } from '@/lib/rooms/utils';

const prisma = new PrismaClient();

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const { id: projectId, roomId } = params;

    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        projectId: projectId,
      },
      include: {
        selections: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const { id: projectId, roomId } = params;
    const body = await request.json();

    // Build update data - only include fields that are provided
    const updateData: { name?: string; type?: string | null } = {};
    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    if (body.type !== undefined) {
      updateData.type = body.type; // Can be null to clear the type
    }

    // Check if the name is changing so we can cascade the rename
    const existingRoom = await prisma.room.findFirst({
      where: { id: roomId, projectId },
      select: { name: true },
    });

    const nameChanged =
      body.name !== undefined &&
      existingRoom &&
      existingRoom.name.toLowerCase().trim() !== body.name.toLowerCase().trim();

    if (nameChanged) {
      const oldName = existingRoom.name;
      const newName = body.name as string;

      // Re-infer room type from new name if user didn't explicitly set a type
      if (body.type === undefined) {
        updateData.type = inferRoomType(newName); // null clears stale type
      }

      const room = await prisma.$transaction(async (tx) => {
        // 1. Update the Room record
        const updated = await tx.room.update({
          where: { id: roomId, projectId },
          data: updateData,
          include: { selections: { orderBy: { createdAt: 'desc' } } },
        });

        // 2. Cascade to ProjectImage.room (case-insensitive match)
        await tx.projectImage.updateMany({
          where: {
            projectId,
            room: { equals: oldName, mode: 'insensitive' },
          },
          data: { room: newName },
        });

        // 3. Cascade to ProjectPost.expandedBlocks galleryChapters titles
        const post = await tx.projectPost.findFirst({
          where: { projectId },
          select: { id: true, expandedBlocks: true },
        });

        const oldFormatted = formatRoomName(oldName);
        const newFormatted = formatRoomName(newName);

        if (post?.expandedBlocks) {
          const blocks = post.expandedBlocks as Record<string, unknown>;
          const chapters = blocks.galleryChapters;
          if (Array.isArray(chapters)) {
            let changed = false;

            for (const chapter of chapters) {
              if (typeof chapter.title === 'string' && new RegExp(escapeRegExp(oldFormatted), 'i').test(chapter.title)) {
                chapter.title = chapter.title.replace(new RegExp(escapeRegExp(oldFormatted), 'gi'), newFormatted);
                changed = true;
              }
            }

            if (changed) {
              await tx.projectPost.update({
                where: { id: post.id },
                data: { expandedBlocks: blocks },
              });
            }
          }
        }

        // 3b. Cascade to ProjectPost.provenance interview answer roomNames
        if (post) {
          const postWithProv = await tx.projectPost.findFirst({
            where: { projectId },
            select: { id: true, provenance: true },
          });
          if (postWithProv?.provenance) {
            const prov = postWithProv.provenance as any;
            const payloadAnswers = prov?.interview?.payload?.answers;
            if (Array.isArray(payloadAnswers)) {
              let provChanged = false;
              for (const ans of payloadAnswers) {
                if (ans.roomName && ans.roomName.toLowerCase() === oldName.toLowerCase()) {
                  ans.roomName = newName;
                  provChanged = true;
                }
              }
              if (provChanged) {
                await tx.projectPost.update({
                  where: { id: postWithProv.id },
                  data: { provenance: prov },
                });
              }
            }
          }
        }

        // 4. Cascade to InstagramCampaignPost.roomName
        await tx.instagramCampaignPost.updateMany({
          where: {
            campaign: { projectId },
            roomName: oldFormatted,
          },
          data: { roomName: newFormatted },
        });

        // 5. Cascade to EditorialDraft.rawState galleryChapters titles
        const drafts = await tx.editorialDraft.findMany({
          where: { projectId },
          select: { id: true, rawState: true },
        });
        for (const draft of drafts) {
          if (!draft.rawState) continue;
          const state = draft.rawState as Record<string, unknown>;
          const draftChapters = state.galleryChapters;
          if (Array.isArray(draftChapters)) {
            let changed = false;
            for (const chapter of draftChapters) {
              if (typeof chapter.title === 'string' && new RegExp(escapeRegExp(oldFormatted), 'i').test(chapter.title)) {
                chapter.title = chapter.title.replace(new RegExp(escapeRegExp(oldFormatted), 'gi'), newFormatted);
                changed = true;
              }
            }
            if (changed) {
              await tx.editorialDraft.update({
                where: { id: draft.id },
                data: { rawState: state },
              });
            }
          }
        }

        return updated;
      });

      return NextResponse.json(room);
    }

    // No name change — simple update (type-only change, etc.)
    const room = await prisma.room.update({
      where: { id: roomId, projectId },
      data: updateData,
      include: { selections: { orderBy: { createdAt: 'desc' } } },
    });

    return NextResponse.json(room);
  } catch (error) {
    console.error('Error updating room:', error);
    return NextResponse.json(
      { error: 'Failed to update room' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const { id: projectId, roomId } = params;

    // Delete all selections in the room first
    await prisma.selection.deleteMany({
      where: {
        roomId: roomId,
      },
    });

    // Delete the room
    await prisma.room.delete({
      where: {
        id: roomId,
        projectId: projectId,
      },
    });

    return NextResponse.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    return NextResponse.json(
      { error: 'Failed to delete room' },
      { status: 500 }
    );
  }
} 
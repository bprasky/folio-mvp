export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { formatRoomName } from '@/lib/utils/formatRoomName';

const prisma = new PrismaClient();

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

        if (post?.expandedBlocks) {
          const blocks = post.expandedBlocks as Record<string, unknown>;
          const chapters = blocks.galleryChapters;
          if (Array.isArray(chapters)) {
            const oldFormatted = formatRoomName(oldName);
            const newFormatted = formatRoomName(newName);
            let changed = false;

            for (const chapter of chapters) {
              if (chapter.title === oldFormatted) {
                chapter.title = newFormatted;
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

        // 4. Cascade to InstagramCampaignPost.roomName
        await tx.instagramCampaignPost.updateMany({
          where: {
            campaign: { projectId },
            roomName: formatRoomName(oldName),
          },
          data: { roomName: formatRoomName(newName) },
        });

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
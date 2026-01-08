export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { isUuid } from '@/lib/rooms/utils';
import { ensureRoomByName } from '@/lib/rooms/ensure';

/**
 * One-time repair endpoint to backfill existing images with room name strings
 * Converts room name strings to room IDs (UUIDs) by upserting rooms and updating images
 * 
 * DEV ONLY - Guarded by NODE_ENV check
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Guard: Only allow in development or for admin users
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const userId = session.user.id;

    // Check project access
    await assertProjectView(userId, projectId);

    // Find all images with room values that are NOT UUIDs (i.e., room name strings)
    const imagesWithRoomNames = await prisma.projectImage.findMany({
      where: {
        projectId,
        room: {
          not: null,
        },
      },
      select: {
        id: true,
        room: true,
        name: true,
      },
    });

    // Filter to images where room is NOT a UUID (i.e., it's a room name string)
    const imagesToRepair = imagesWithRoomNames.filter(img => 
      img.room && !isUuid(img.room)
    );

    if (imagesToRepair.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No images need repair - all room values are already UUIDs',
        updatedCount: 0,
        createdRoomsCount: 0,
        mapping: {},
      });
    }

    // Group by room name to batch upsert rooms
    const roomNameToImages = new Map<string, string[]>();
    for (const img of imagesToRepair) {
      const roomName = img.room!;
      const existing = roomNameToImages.get(roomName) || [];
      existing.push(img.id);
      roomNameToImages.set(roomName, existing);
    }

    // Upsert rooms and collect mapping
    const roomNameToRoomId = new Map<string, string>();
    const createdRooms: string[] = [];

    for (const [roomName, imageIds] of roomNameToImages.entries()) {
      try {
        // Check if room exists before upserting
        const roomBefore = await prisma.room.findFirst({
          where: {
            projectId,
            name: {
              equals: roomName,
              mode: 'insensitive',
            },
          },
        });
        
        const roomRecord = await ensureRoomByName(projectId, roomName);
        roomNameToRoomId.set(roomName, roomRecord.id);
        
        // If room didn't exist before, it was just created
        if (!roomBefore) {
          createdRooms.push(roomRecord.name);
        }
      } catch (error) {
        console.error(`[repair-room-ids] Failed to upsert room "${roomName}":`, error);
        // Continue with other rooms
      }
    }

    // Update all images with room name strings to use room IDs
    let updatedCount = 0;
    for (const [roomName, imageIds] of roomNameToImages.entries()) {
      const roomId = roomNameToRoomId.get(roomName);
      if (!roomId) continue; // Skip if room upsert failed

      try {
        const result = await prisma.projectImage.updateMany({
          where: {
            id: { in: imageIds },
            projectId,
          },
          data: {
            room: roomId,
          },
        });
        updatedCount += result.count;
      } catch (error) {
        console.error(`[repair-room-ids] Failed to update images for room "${roomName}":`, error);
      }
    }

    // Build mapping for response
    const mapping: Record<string, { roomId: string; roomName: string; imageCount: number }> = {};
    for (const [roomName, imageIds] of roomNameToImages.entries()) {
      const roomId = roomNameToRoomId.get(roomName);
      if (roomId) {
        mapping[roomName] = {
          roomId,
          roomName: roomName,
          imageCount: imageIds.length,
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: `Repaired ${updatedCount} images across ${roomNameToRoomId.size} rooms`,
      updatedCount,
      createdRoomsCount: createdRooms.length,
      createdRooms,
      mapping,
    });

  } catch (error: any) {
    console.error('[repair-room-ids] Error:', error);
    return NextResponse.json(
      { error: 'Failed to repair room IDs: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}


export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectEdit } from '@/lib/authz/access';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { skeletonItemId, roomName } = await request.json();

    if (!skeletonItemId) {
      return NextResponse.json({ error: 'skeletonItemId is required' }, { status: 400 });
    }

    if (!roomName) {
      return NextResponse.json({ error: 'roomName is required' }, { status: 400 });
    }

    const skeletonItem = await prisma.skeletonItem.findUnique({
      where: { id: skeletonItemId },
      select: {
        id: true,
        projectId: true,
      }
    });

    if (!skeletonItem) {
      return NextResponse.json({ error: 'Skeleton item not found' }, { status: 404 });
    }

    // Ensure user has edit access to the project
    await assertProjectEdit(userId, skeletonItem.projectId);

    // Resolve the room within this project.
    //
    // This route used to write `roomName` straight onto the SkeletonItem, but
    // there is no such column — the item's room is the required `roomId` FK — so
    // every move threw PrismaClientValidationError and returned a 500. The client
    // (SkeletonSidePanel.handleMoveRoom) actually holds the room id and converts
    // it to a name before sending, falling back to the raw id when the lookup
    // misses, so accept either and resolve back to the row.
    const targetRoom = await prisma.room.findFirst({
      where: {
        projectId: skeletonItem.projectId,
        OR: [{ id: roomName }, { name: roomName }],
      },
      select: { id: true, name: true },
    });

    if (!targetRoom) {
      return NextResponse.json(
        { error: `No room "${roomName}" in this project` },
        { status: 404 },
      );
    }

    // Move the item only (do NOT mutate ProjectImage.room)
    await prisma.skeletonItem.update({
      where: { id: skeletonItemId },
      data: {
        roomId: targetRoom.id,
      }
    });

    return NextResponse.json({
      success: true,
      skeletonItem: { id: skeletonItem.id, roomId: targetRoom.id, roomName: targetRoom.name },
    }, { status: 200 });

  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[POST /api/living/skeleton/move] Error:', error);
    return NextResponse.json(
      { error: 'Failed to move skeleton item: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}









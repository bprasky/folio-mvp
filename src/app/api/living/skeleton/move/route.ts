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

    // Update roomName only (do NOT mutate ProjectImage.room)
    await prisma.skeletonItem.update({
      where: { id: skeletonItemId },
      data: {
        roomName: roomName,
        updatedAt: new Date(),
      }
    });

    return NextResponse.json({
      success: true,
      skeletonItem: { id: skeletonItem.id, roomName: roomName },
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









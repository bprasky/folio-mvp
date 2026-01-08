export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roomId = params.id;
  const userId = session.user.id;

  // Get room and verify access
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      project: {
        select: { id: true, ownerId: true, designerId: true },
      },
    },
  });

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const project = room.project;
  if (project.ownerId !== userId && project.designerId !== userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    // Get images for this room
    const images = await prisma.projectImage.findMany({
      where: {
        projectId: project.id,
        room: { equals: room.name, mode: 'insensitive' },
      },
      select: { id: true, url: true },
    });

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images found for this room' },
        { status: 400 }
      );
    }

    // Check if skeletons already exist (idempotent)
    const existingSkeletons = await prisma.skeletonItem.count({
      where: {
        projectId: project.id,
        roomName: room.name,
      },
    });

    if (existingSkeletons > 0) {
      return NextResponse.json({
        generated: false,
        message: 'Skeletons already exist for this room',
        skeletonCount: existingSkeletons,
      });
    }

    // For demo: Create placeholder skeletons
    // In production, this would call an AI service for object detection
    const skeletonsToCreate = images.slice(0, 3).map((image, idx) => ({
      projectId: project.id,
      projectImageId: image.id,
      roomName: room.name,
      bbox: { x: 0.1 + idx * 0.2, y: 0.1, w: 0.15, h: 0.2 },
      label: `Item ${idx + 1}`,
      confidence: 0.85,
      status: 'DETECTED' as const,
    }));

    const created = await prisma.skeletonItem.createMany({
      data: skeletonsToCreate,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[generate-skeletons] Created:', {
        roomId,
        roomName: room.name,
        count: created.count,
      });
    }

    return NextResponse.json({
      generated: true,
      message: `Generated ${created.count} skeleton(s) for ${room.name}`,
      skeletonCount: created.count,
    });
  } catch (error) {
    console.error('[generate-skeletons] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate skeletons' },
      { status: 500 }
    );
  }
}






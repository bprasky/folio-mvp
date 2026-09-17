export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { socialGenerationFailure, publishedRoomSource } from '@/lib/instagram-export/generation';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { generateInstagramCaption } from '@/lib/instagram-export/generate-caption';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, roomId, headline, pitch, beats } = body;

    if (typeof projectId !== 'string' || !projectId.trim()) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        post: true,
        designer: true,
        rooms: true,
        images: { select: { id: true, roomId: true, room: true,
          tags: { select: { finishRaw: true, product: { select: { name: true, brand: true } } } } } },
      },
    });

    if (!project || !project.post || project.post.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Published project not found' }, { status: 404 });
    }

    try {
      await assertProjectWrite(session.user.id, project.id);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const room = roomId
      ? project.rooms.find((r) => r.id === roomId)
      : undefined;

    if (roomId && !room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    const source = room ? publishedRoomSource(project.post.expandedBlocks, room.id,
      project.images.filter(image => image.roomId === room.id || (!image.roomId && (image.room === room.id || image.room === room.name))).map(image => image.id))
      : project.post.expandedBlocks;
    if (!source) return NextResponse.json({ error: 'This room has no published story to develop yet.', retryable: false }, { status: 422 });

    const caption = await generateInstagramCaption({
      postTitle: project.title,
      headline: typeof headline === 'string' ? headline : '',
      expandedBlocks: source,
      roomName: room?.name,
      designerName: project.designer?.name || 'Designer',
      pitch: typeof pitch === 'string' ? pitch : undefined,
      beats: Array.isArray(beats) ? beats.filter((beat): beat is string => typeof beat === 'string') : undefined,
      productTags: project.images.filter(image => !room || image.roomId === room.id ||
        (!image.roomId && (image.room === room.id || image.room === room.name)))
        .flatMap(image => image.tags.map(tag => ({ name: tag.product.name, brand: tag.product.brand, finish: tag.finishRaw }))),
    });

    return NextResponse.json({ caption, captions: [caption] });
  } catch (error: unknown) {
    const failure = socialGenerationFailure(error);
    console.error('[instagram-export/generate-caption]', failure.body.code);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}

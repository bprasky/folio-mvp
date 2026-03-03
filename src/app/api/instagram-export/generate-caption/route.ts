export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { generateInstagramCaption } from '@/lib/instagram-export/generate-caption';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, roomId, headline } = body;

    if (!projectId || !headline) {
      return NextResponse.json(
        { error: 'projectId and headline are required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        post: true,
        designer: true,
        rooms: true,
      },
    });

    if (!project || !project.post || project.post.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Published project not found' }, { status: 404 });
    }

    if (project.designerId !== session.user.id && project.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const room = roomId
      ? project.rooms.find((r) => r.id === roomId)
      : undefined;

    const caption = await generateInstagramCaption({
      postTitle: project.title,
      headline,
      expandedBlocks: project.post.expandedBlocks,
      roomName: room?.name,
      designerName: project.designer?.name || 'Designer',
    });

    return NextResponse.json({ caption });
  } catch (error: any) {
    console.error('[instagram-export/generate-caption]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate caption' },
      { status: 500 }
    );
  }
}

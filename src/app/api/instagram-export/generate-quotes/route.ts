export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { generatePullQuotes } from '@/lib/instagram-export/generate-quotes';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, roomId, feedback } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Fetch project with post
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        post: true,
        rooms: true,
      },
    });

    if (!project || !project.post || project.post.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Published project not found' }, { status: 404 });
    }

    // Auth: must be the project owner/designer
    if (project.designerId !== session.user.id && project.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const room = roomId
      ? project.rooms.find((r) => r.id === roomId)
      : undefined;

    const quotes = await generatePullQuotes({
      postTitle: project.title,
      expandedBlocks: project.post.expandedBlocks,
      roomName: room?.name,
      feedback,
    });

    return NextResponse.json({ quotes });
  } catch (error: any) {
    console.error('[instagram-export/generate-quotes]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate quotes' },
      { status: 500 }
    );
  }
}

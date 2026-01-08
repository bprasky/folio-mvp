export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  getProjectApprovals, 
  getProjectRoomsWithReadiness, 
  getRecentNotes
} from '@/lib/approvals';
import { getEditorialHint } from '@/lib/approvals-utils';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;

  // Verify project access
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, designerId: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const userId = session.user.id;
  const isOwner = project.ownerId === userId || project.designerId === userId;
  
  if (!isOwner) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    // Get project stats for editorial hint
    const projectStats = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        isPublic: true,
        publishedAt: true,
        images: {
          select: {
            id: true,
            tags: { select: { id: true } },
          },
        },
      },
    });

    const imageCount = projectStats?.images.length || 0;
    const tagCount = projectStats?.images.reduce((sum, img) => sum + img.tags.length, 0) || 0;
    const isPublished = !!(projectStats?.isPublic && projectStats?.publishedAt);

    // Fetch all overview data in parallel
    const [approvals, rooms, recentNotes] = await Promise.all([
      getProjectApprovals(projectId),
      getProjectRoomsWithReadiness(projectId),
      getRecentNotes(projectId, 3),
    ]);

    // Get editorial hint if not ready
    const editorialHint = getEditorialHint(imageCount, tagCount, isPublished);

    // Disable caching to ensure fresh data
    return NextResponse.json({
      approvals,
      rooms,
      recentNotes,
      stats: {
        imageCount,
        tagCount,
        isPublished,
      },
      editorialHint,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[overview] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overview' },
      { status: 500 }
    );
  }
}


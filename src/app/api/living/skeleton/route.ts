// src/app/api/living/skeleton/route.ts
//
// Get skeleton items for an image (owner/admin only)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const projectImageId = searchParams.get('projectImageId');
    const projectId = searchParams.get('projectId');

    if (!projectImageId && !projectId) {
      return NextResponse.json(
        { error: 'Either projectImageId or projectId is required' },
        { status: 400 }
      );
    }

    // Load image or project to get projectId for authorization
    let targetProjectId: string;
    
    if (projectImageId) {
      const image = await prisma.projectImage.findUnique({
        where: { id: projectImageId },
        select: { projectId: true },
      });
      if (!image) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
      }
      targetProjectId = image.projectId;
    } else {
      targetProjectId = projectId!;
    }

    // Check project access (owner/admin only)
    await assertProjectView(userId, targetProjectId);

    // Query skeleton items
    const where: any = {
      projectId: targetProjectId,
      status: {
        in: ['UNCONFIRMED', 'CONFIRMED'],
      },
    };

    if (projectImageId) {
      where.projectImageId = projectImageId;
    }

    const items = await prisma.skeletonItem.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ skeletonItems: items, items }, { status: 200 });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[GET /api/living/skeleton] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch skeleton items' },
      { status: 500 }
    );
  }
}


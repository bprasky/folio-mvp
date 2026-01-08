export const dynamic = 'force-dynamic';

// src/app/api/living/skeleton/dismiss/route.ts
//
// Dismiss a skeleton item

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { skeletonId } = body;

    if (!skeletonId) {
      return NextResponse.json({ error: 'skeletonId is required' }, { status: 400 });
    }

    // Load skeleton with project for authorization
    const skeleton = await prisma.skeletonItem.findUnique({
      where: { id: skeletonId },
      include: {
        project: {
          select: {
            id: true,
            ownerId: true,
            designerId: true,
          },
        },
      },
    });

    if (!skeleton) {
      return NextResponse.json({ error: 'Skeleton item not found' }, { status: 404 });
    }

    // Check project access (owner/admin only)
    await assertProjectView(userId, skeleton.projectId);

    // Update skeleton status to DISMISSED
    await prisma.skeletonItem.update({
      where: { id: skeletonId },
      data: {
        status: 'DISMISSED',
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[POST /api/living/skeleton/dismiss] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to dismiss skeleton' },
      { status: 500 }
    );
  }
}









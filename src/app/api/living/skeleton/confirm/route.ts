// src/app/api/living/skeleton/confirm/route.ts
//
// Confirm a skeleton item as a product or label

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { applyDynamicHeroForProject } from '@/lib/living/applyDynamicHero';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { skeletonId, productId, label } = body;

    if (!skeletonId) {
      return NextResponse.json({ error: 'skeletonId is required' }, { status: 400 });
    }

    if (!productId && !label) {
      return NextResponse.json(
        { error: 'Either productId or label is required' },
        { status: 400 }
      );
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

    // Verify product exists if productId provided
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
    }

    // Get bbox center for x,y coordinates
    const bbox = skeleton.bbox as { x: number; y: number; w: number; h: number };
    const x = bbox.x + bbox.w / 2;
    const y = bbox.y + bbox.h / 2;

    // Create ProjectProductTag
    await prisma.projectProductTag.create({
      data: {
        projectId: skeleton.projectId,
        projectImageId: skeleton.projectImageId,
        productId: productId || undefined,
        x,
        y,
        roomName: skeleton.roomName || undefined,
        notes: 'confirmed from skeleton',
      },
    });

    // Update skeleton status
    await prisma.skeletonItem.update({
      where: { id: skeletonId },
      data: {
        status: 'CONFIRMED',
        confirmedProductId: productId || null,
        confirmedLabel: label || null,
      },
    });

    // Optionally trigger dynamic hero update (since room richness changed)
    try {
      await applyDynamicHeroForProject(skeleton.projectId);
    } catch (error) {
      // Non-blocking
      console.error('[POST /api/living/skeleton/confirm] Dynamic hero update failed:', error);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[POST /api/living/skeleton/confirm] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to confirm skeleton' },
      { status: 500 }
    );
  }
}









export const dynamic = 'force-dynamic';

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

    // Load skeleton with project and room for authorization
    const skeleton = await prisma.skeletonItem.findUnique({
      where: { id: skeletonId },
      include: {
        project: {
          select: {
            id: true,
            ownerId: true,
            designerId: true,
            images: {
              select: { id: true, room: true },
            },
          },
        },
        room: {
          select: { name: true },
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

    // Place tag at center of image (skeletons don't store bounding boxes)
    const x = 0.5;
    const y = 0.5;

    // Find the best image in this room to place the tag on
    const roomName = skeleton.room?.name?.toLowerCase();
    const targetImage = skeleton.project.images.find(
      img => img.room?.toLowerCase() === roomName
    ) || skeleton.project.images[0];

    // Create ProductTag on the matching image
    if (targetImage && productId) {
      await prisma.productTag.create({
        data: {
          // Finish is deliberately NULL here (spec 21 delta D3). A skeleton
          // confirmation records that a product belongs in a room, not what
          // finish was specified — there is no specification event to read one
          // from, and inventing one is worse than having none. This becomes a
          // capture site if the tag is later opened in the tagging UI.
          productId,
          imageId: targetImage.id,
          x,
          y,
        },
      });
    }

    // Update skeleton status
    await prisma.skeletonItem.update({
      where: { id: skeletonId },
      data: {
        status: 'CONFIRMED',
        confirmedProductId: productId || null,
        description: label || undefined,
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









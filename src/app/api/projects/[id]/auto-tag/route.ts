export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';

/**
 * POST /api/projects/[id]/auto-tag
 *
 * Auto-tag products from design board selections onto project images.
 * Uses AI-detected skeletons and fuzzy matching to place tags.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const userId = session.user.id;

    // Check project access
    await assertProjectView(userId, projectId);

    // Get project with rooms, selections, and images
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        rooms: {
          include: {
            selections: {
              where: {
                OR: [
                  { vendorProductId: { not: null } },
                  { productUrl: { not: null } },
                ],
              },
              select: {
                id: true,
                productName: true,
                vendorProductId: true,
                productUrl: true,
                photo: true,
                roomId: true,
              },
            },
          },
        },
        images: {
          select: {
            id: true,
            room: true,
            url: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all selections with vendorProductId (these are linked to actual products)
    const selectionsWithProducts = project.rooms.flatMap(room =>
      room.selections
        .filter(s => s.vendorProductId)
        .map(s => ({
          ...s,
          roomName: room.name,
        }))
    );

    if (selectionsWithProducts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products in design boards to tag',
        tagged: 0,
        selections: 0,
      });
    }

    // Get existing tags to avoid duplicates
    const existingTags = await prisma.productTag.findMany({
      where: {
        image: { projectId },
      },
      select: {
        productId: true,
        imageId: true,
      },
    });

    const existingTagSet = new Set(
      existingTags.map(t => `${t.productId}-${t.imageId}`)
    );

    // Get unconfirmed skeletons for matching
    const skeletons = await prisma.skeletonItem.findMany({
      where: {
        projectId,
        status: 'UNCONFIRMED',
        confirmedProductId: null,
      },
      select: {
        id: true,
        projectImageId: true,
        bbox: true,
        predictedCategory: true,
        confidence: true,
      },
    });

    let taggedCount = 0;
    const tagsCreated: Array<{ productId: string; imageId: string; productName: string }> = [];

    // For each selection with a linked product, try to tag it on images
    for (const selection of selectionsWithProducts) {
      if (!selection.vendorProductId) continue;

      // Find images that match this room (or all images if no room match)
      const matchingImages = project.images.filter(img => {
        if (!selection.roomId) return true;
        // Match by room name (case-insensitive)
        const roomName = project.rooms.find(r => r.id === selection.roomId)?.name;
        return !img.room || img.room.toLowerCase() === roomName?.toLowerCase();
      });

      for (const image of matchingImages) {
        // Skip if already tagged
        const tagKey = `${selection.vendorProductId}-${image.id}`;
        if (existingTagSet.has(tagKey)) continue;

        // Find a matching skeleton for this image
        const imageSkeletons = skeletons.filter(s => s.projectImageId === image.id);

        // Simple matching: use first unconfirmed skeleton or center of image
        let x = 0.5;
        let y = 0.5;

        if (imageSkeletons.length > 0) {
          // Use the first unconfirmed skeleton's center
          const skeleton = imageSkeletons[0];
          const bbox = skeleton.bbox as { x: number; y: number; w: number; h: number };
          x = bbox.x + bbox.w / 2;
          y = bbox.y + bbox.h / 2;

          // Mark skeleton as confirmed
          await prisma.skeletonItem.update({
            where: { id: skeleton.id },
            data: {
              status: 'CONFIRMED',
              confirmedProductId: selection.vendorProductId,
            },
          });

          // Remove from available skeletons
          const idx = skeletons.findIndex(s => s.id === skeleton.id);
          if (idx >= 0) skeletons.splice(idx, 1);
        }

        // Create the product tag
        await prisma.productTag.create({
          data: {
            x,
            y,
            productId: selection.vendorProductId,
            imageId: image.id,
          },
        });

        existingTagSet.add(tagKey);
        taggedCount++;
        tagsCreated.push({
          productId: selection.vendorProductId,
          imageId: image.id,
          productName: selection.productName || 'Unknown',
        });

        // Only tag each product once per project (on first matching image)
        break;
      }
    }

    return NextResponse.json({
      success: true,
      message: taggedCount > 0
        ? `Auto-tagged ${taggedCount} products from your design boards`
        : 'No new products to tag',
      tagged: taggedCount,
      selections: selectionsWithProducts.length,
      tags: tagsCreated,
    });

  } catch (error: any) {
    console.error('[auto-tag] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-tag products' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/auto-tag
 *
 * Check auto-tag status - returns counts for checklist UI
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const userId = session.user.id;

    // Check project access
    await assertProjectView(userId, projectId);

    // Get counts
    const [imageCount, analyzedCount, tagCount, selectionCount] = await Promise.all([
      // Total images
      prisma.projectImage.count({ where: { projectId } }),
      // Images with analysis (have skeletons or image analysis)
      prisma.projectImage.count({
        where: {
          projectId,
          OR: [
            { skeletons: { some: {} } },
            { analysis: { isNot: null } },
          ],
        },
      }),
      // Images with product tags
      prisma.productTag.count({
        where: {
          image: { projectId },
        },
      }),
      // Selections in design boards with linked products
      prisma.selection.count({
        where: {
          room: { projectId },
          vendorProductId: { not: null },
        },
      }),
    ]);

    return NextResponse.json({
      images: {
        total: imageCount,
        analyzed: analyzedCount,
      },
      tags: tagCount,
      selections: selectionCount,
      canAutoTag: selectionCount > 0 && tagCount === 0,
    });

  } catch (error: any) {
    console.error('[auto-tag GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get auto-tag status' },
      { status: 500 }
    );
  }
}

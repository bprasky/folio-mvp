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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
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
                // Include any selection with product info
                OR: [
                  { vendorProductId: { not: null } },
                  { productName: { not: null } },
                  { photo: { not: null } },
                ],
              },
              select: {
                id: true,
                productName: true,
                vendorProductId: true,
                vendorName: true,
                productUrl: true,
                photo: true,
                roomId: true,
                unitPrice: true,
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

    // Get all selections with any product info
    const allSelections = project.rooms.flatMap(room =>
      room.selections
        .filter(s => s.productName || s.vendorProductId || s.photo)
        .map(s => ({
          ...s,
          roomName: room.name,
        }))
    );

    if (allSelections.length === 0) {
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
    let productsCreated = 0;
    const tagsCreated: Array<{ productId: string; imageId: string; productName: string }> = [];

    // For each selection, try to tag it on images
    for (const selection of allSelections) {
      let productId = selection.vendorProductId;

      // If no vendorProductId, create a Product record from selection data
      if (!productId && (selection.productName || selection.photo)) {
        const newProduct = await prisma.product.create({
          data: {
            name: selection.productName || 'Untitled Product',
            imageUrl: selection.photo,
            url: selection.productUrl,
            brand: selection.vendorName,
            price: selection.unitPrice ? Number(selection.unitPrice) : null,
          },
        });
        productId = newProduct.id;
        productsCreated++;

        // Link the selection to this new product
        await prisma.selection.update({
          where: { id: selection.id },
          data: { vendorProductId: productId },
        });
      }

      if (!productId) continue;

      // Find images that match this room (or all images if no room match)
      const matchingImages = project.images.filter(img => {
        if (!selection.roomId) return true;
        // Match by room name (case-insensitive)
        const roomName = project.rooms.find(r => r.id === selection.roomId)?.name;
        return !img.room || img.room.toLowerCase() === roomName?.toLowerCase();
      });

      for (const image of matchingImages) {
        // Skip if already tagged
        const tagKey = `${productId}-${image.id}`;
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
              confirmedProductId: productId,
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
            productId,
            imageId: image.id,
          },
        });

        existingTagSet.add(tagKey);
        taggedCount++;
        tagsCreated.push({
          productId,
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
        ? `Auto-tagged ${taggedCount} products from your design boards${productsCreated > 0 ? ` (created ${productsCreated} new product records)` : ''}`
        : 'No new products to tag',
      tagged: taggedCount,
      selections: allSelections.length,
      productsCreated,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
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
      // Selections in design boards with ANY product info (not just vendorProductId)
      prisma.selection.count({
        where: {
          room: { projectId },
          OR: [
            { vendorProductId: { not: null } },
            { productName: { not: null } },
            { photo: { not: null } },
          ],
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

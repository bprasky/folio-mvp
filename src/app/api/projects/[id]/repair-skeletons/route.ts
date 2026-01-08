export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { ensureSkeletonItemsForImage } from '@/lib/living/skeleton';
import { normalizeTagPoint, pickMatchingSkeleton } from '@/lib/living/skeletonMatch';

/**
 * Dev-only endpoint to backfill SkeletonItems for existing project images
 * Optionally reconciles existing ProductTags with skeletons
 * 
 * DEV ONLY - Guarded by NODE_ENV check
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Guard: Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const userId = session.user.id;

    // Check project access
    await assertProjectView(userId, projectId);

    // Parse optional query param for reconciliation
    const { searchParams } = new URL(request.url);
    const reconcile = searchParams.get('reconcile') === 'true';

    // Fetch all images for this project
    const images = await prisma.projectImage.findMany({
      where: { projectId },
      select: {
        id: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (images.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No images found for this project',
        imagesProcessed: 0,
        skeletonsCreatedTotal: 0,
        reconciledCount: 0,
        perImage: [],
      });
    }

    const perImage: Array<{ imageId: string; createdCount: number; reconciledCount: number }> = [];
    let skeletonsCreatedTotal = 0;
    let reconciledTotal = 0;

    // Process each image
    for (const image of images) {
      try {
        // Get skeleton count before
        const skeletonsBefore = await prisma.skeletonItem.count({
          where: {
            projectImageId: image.id,
            status: { in: ['UNCONFIRMED', 'CONFIRMED'] },
          },
        });

        // Generate skeletons for this image
        await ensureSkeletonItemsForImage(image.id);

        // Get skeleton count after
        const skeletonsAfter = await prisma.skeletonItem.count({
          where: {
            projectImageId: image.id,
            status: { in: ['UNCONFIRMED', 'CONFIRMED'] },
          },
        });

        const createdCount = skeletonsAfter - skeletonsBefore;
        skeletonsCreatedTotal += createdCount;

        let reconciledCount = 0;

        // Optional: Reconcile existing ProductTags with skeletons
        if (reconcile && createdCount > 0) {
          try {
            // Fetch ProductTags for this image
            const productTags = await prisma.productTag.findMany({
              where: { imageId: image.id },
              select: {
                id: true,
                x: true,
                y: true,
                productId: true,
              },
            });

            if (productTags.length > 0) {
              // Fetch unresolved skeletons for this image
              const unresolvedSkeletons = await prisma.skeletonItem.findMany({
                where: {
                  projectImageId: image.id,
                  status: { in: ['UNCONFIRMED', 'CONFIRMED'] },
                  confirmedProductId: null,
                },
                select: {
                  id: true,
                  bbox: true,
                },
              });

              if (unresolvedSkeletons.length > 0) {
                // For each ProductTag, try to match it to a skeleton
                for (const tag of productTags) {
                  // Normalize tag point (ProductImage has no width/height, so check if already normalized)
                  const normalizedPoint = normalizeTagPoint(
                    tag.x,
                    tag.y,
                    null, // imageWidth not available
                    null // imageHeight not available
                  );

                  if (normalizedPoint) {
                    // Pick matching skeleton
                    const matchingSkeleton = pickMatchingSkeleton(
                      unresolvedSkeletons.map((s) => ({
                        id: s.id,
                        bbox: s.bbox as { x: number; y: number; w: number; h: number },
                      })),
                      normalizedPoint
                    );

                    if (matchingSkeleton) {
                      // Update skeleton to mark as resolved
                      await prisma.skeletonItem.update({
                        where: { id: matchingSkeleton.id },
                        data: {
                          confirmedProductId: tag.productId,
                          status: 'CONFIRMED',
                        },
                      });

                      reconciledCount++;

                      // Remove from unresolved list for next iteration
                      const index = unresolvedSkeletons.findIndex(
                        (s) => s.id === matchingSkeleton.id
                      );
                      if (index >= 0) {
                        unresolvedSkeletons.splice(index, 1);
                      }
                    }
                  }
                }
              }
            }
          } catch (reconcileError) {
            console.error(`[repair-skeletons] Failed to reconcile tags for image ${image.id}:`, reconcileError);
            // Continue with other images
          }
        }

        reconciledTotal += reconciledCount;

        perImage.push({
          imageId: image.id,
          createdCount,
          reconciledCount,
        });
      } catch (error) {
        console.error(`[repair-skeletons] Failed to process image ${image.id}:`, error);
        // Continue with other images
        perImage.push({
          imageId: image.id,
          createdCount: 0,
          reconciledCount: 0,
        });
      }
    }

    console.log('[repair-skeletons] done', {
      projectId,
      imagesProcessed: images.length,
      skeletonsCreatedTotal,
      reconciledTotal,
      reconcileEnabled: reconcile,
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${images.length} images. Created ${skeletonsCreatedTotal} skeletons${reconcile ? `, reconciled ${reconciledTotal} tags` : ''}.`,
      imagesProcessed: images.length,
      skeletonsCreatedTotal,
      reconciledCount: reconciledTotal,
      reconcileEnabled: reconcile,
      perImage,
    });
  } catch (error: any) {
    console.error('[repair-skeletons] Error:', error);
    return NextResponse.json(
      { error: 'Failed to repair skeletons: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}






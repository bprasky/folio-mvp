import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { isWorkspaceImport } from '@/lib/workspace-import/types';
import type { PendingProductTag } from '@prisma/client';

interface ProductAttribution {
  productUrl: string;
  vendorName: string;
  productName: string;
  price?: string;
}

/**
 * POST /api/import/[sessionId]/batch-verify
 * Batch verify multiple pending tags
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await req.json();
    const { action, tagIds } = body;

    // Verify session ownership
    const importSession = await prisma.importSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!importSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    let tagsToProcess: PendingProductTag[];
    if (isWorkspaceImport(importSession.processingMeta)) return NextResponse.json({ error: 'Manage this import from your workspace.' }, { status: 409 });

    switch (action) {
      case 'confirm_all_high_confidence':
        tagsToProcess = await prisma.pendingProductTag.findMany({
          where: {
            importSessionId: sessionId,
            status: 'UNREVIEWED',
            attributionConfidence: 'high',
          },
        });
        break;

      case 'dismiss_all_low_confidence':
        tagsToProcess = await prisma.pendingProductTag.findMany({
          where: {
            importSessionId: sessionId,
            status: 'UNREVIEWED',
            attributionConfidence: 'low',
          },
        });
        break;

      case 'confirm_selected':
        if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
          return NextResponse.json(
            { error: 'tagIds array is required for confirm_selected action' },
            { status: 400 }
          );
        }
        tagsToProcess = await prisma.pendingProductTag.findMany({
          where: {
            id: { in: tagIds },
            importSessionId: sessionId,
            status: 'UNREVIEWED',
          },
        });
        break;

      case 'dismiss_selected':
        if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
          return NextResponse.json(
            { error: 'tagIds array is required for dismiss_selected action' },
            { status: 400 }
          );
        }
        tagsToProcess = await prisma.pendingProductTag.findMany({
          where: {
            id: { in: tagIds },
            importSessionId: sessionId,
            status: 'UNREVIEWED',
          },
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use confirm_all_high_confidence, dismiss_all_low_confidence, confirm_selected, or dismiss_selected' },
          { status: 400 }
        );
    }

    if (tagsToProcess.length === 0) {
      return NextResponse.json({
        processed: 0,
        confirmed: 0,
        dismissed: 0,
        message: 'No tags found matching criteria',
      });
    }

    const isDismissAction = action.includes('dismiss');
    const results: { tagId: string; status: string; productId?: string }[] = [];

    // Process in transaction
    await prisma.$transaction(async (tx) => {
      for (const tag of tagsToProcess) {
        if (isDismissAction) {
          await tx.pendingProductTag.update({
            where: { id: tag.id },
            data: {
              status: 'DISMISSED',
              reviewedAt: new Date(),
            },
          });
          results.push({ tagId: tag.id, status: 'dismissed' });
        } else {
          // Confirm with top suggestion
          const topSuggestion = tag.topSuggestion as ProductAttribution | null;

          if (topSuggestion && topSuggestion.productName) {
            // Get or create product from suggestion
            let product = await tx.product.findFirst({
              where: {
                OR: [
                  { url: topSuggestion.productUrl },
                  {
                    name: topSuggestion.productName,
                    brand: topSuggestion.vendorName,
                  },
                ],
              },
            });

            if (!product) {
              product = await tx.product.create({
                data: {
                  name: topSuggestion.productName,
                  brand: topSuggestion.vendorName,
                  url: topSuggestion.productUrl,
                  category: tag.category,
                  isPending: true, // Needs vendor claim
                },
              });
            }

            // Create ProductTag if we have a project image
            let productTagId: string | undefined;
            if (tag.projectImageId) {
              const productTag = await tx.productTag.create({
                data: {
                  // Finish is deliberately NULL here (spec 21 delta D3). A tag arriving
                  // through an import has no specification event behind it, and a
                  // fabricated finish is indistinguishable from an observed one once
                  // stored. If this tag is later opened in the tagging UI it becomes a
                  // capture site like any other. Do not "fix" this by proposing a value.
                  imageId: tag.projectImageId,
                  productId: product.id,
                  x: tag.x,
                  y: tag.y,
                },
              });
              productTagId = productTag.id;
            }

            await tx.pendingProductTag.update({
              where: { id: tag.id },
              data: {
                status: 'CONFIRMED',
                confirmedProductId: product.id,
                resultingTagId: productTagId,
                reviewedAt: new Date(),
              },
            });

            results.push({ tagId: tag.id, status: 'confirmed', productId: product.id });
          } else {
            // No suggestion to confirm, skip
            results.push({ tagId: tag.id, status: 'skipped' });
          }
        }
      }
    });

    // Update session metrics
    const confirmedCount = results.filter(r => r.status === 'confirmed').length;
    const dismissedCount = results.filter(r => r.status === 'dismissed').length;

    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        verifiedTags: { increment: confirmedCount },
      },
    });

    return NextResponse.json({
      processed: results.length,
      confirmed: confirmedCount,
      dismissed: dismissedCount,
      skipped: results.filter(r => r.status === 'skipped').length,
      results,
    });
  } catch (error) {
    console.error('Error batch verifying tags:', error);
    return NextResponse.json(
      { error: 'Failed to batch verify tags' },
      { status: 500 }
    );
  }
}

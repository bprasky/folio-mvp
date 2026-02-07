export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { resolveSelectionToProduct } from '@/lib/tagging/resolveSelectionToProduct';

type CreatedTag = {
  productTagId: string;
  selectionId: string;
  imageId: string;
  productId: string;
  productName: string;
  x: number;
  y: number;
};

type SkippedSelection = {
  selectionId: string;
  productName: string | null;
  reason: 'no_product_match' | 'no_untagged_images' | 'already_linked';
};

/**
 * Compute evenly-distributed tag coordinates for N tags on an image.
 * Returns percentage-based (0-100) positions in a grid layout.
 */
function computeTagPositions(count: number): Array<{ x: number; y: number }> {
  if (count === 1) return [{ x: 50, y: 50 }];

  // Spread tags in a horizontal row at the center, spaced evenly
  const yCenter = 50;
  const positions: Array<{ x: number; y: number }> = [];
  const padding = 15; // percent from edges
  const span = 100 - 2 * padding;

  for (let i = 0; i < count; i++) {
    const x = count === 1 ? 50 : padding + (span * i) / (count - 1);
    positions.push({ x: Math.round(x * 100) / 100, y: yCenter });
  }
  return positions;
}

/**
 * POST /api/posting/project/[projectId]/auto-tag
 *
 * Creates ProductTags from Selections and links them via Selection.productTagId.
 *
 * Body:
 *   roomIds?: string[]  — filter to specific rooms (default: all)
 *   dryRun?: boolean    — preview what would be created without writing
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;
    await assertProjectView(session.user.id, projectId);

    const body = await request.json().catch(() => ({}));
    const roomIds: string[] | undefined = body.roomIds;
    const dryRun: boolean = body.dryRun === true;

    // Fetch project rooms with selections, and images
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        rooms: {
          where: roomIds ? { id: { in: roomIds } } : undefined,
          include: {
            selections: {
              select: {
                id: true,
                productName: true,
                vendorName: true,
                productTagId: true,
              },
            },
          },
        },
        images: {
          select: {
            id: true,
            room: true,
            aiSpaces: true,
            tags: { select: { id: true } },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const created: CreatedTag[] = [];
    const skipped: SkippedSelection[] = [];

    // Helper: check if an image matches a room by room field OR aiSpaces
    // Images with no room assignment are available for ANY room
    const imageMatchesRoom = (img: { room: string | null; aiSpaces: string[] }, roomName: string) => {
      if (!img.room && (!img.aiSpaces || img.aiSpaces.length === 0)) return true;
      const rn = roomName.toLowerCase();
      if (img.room && img.room.toLowerCase() === rn) return true;
      if (img.aiSpaces?.some((s) => s.toLowerCase() === rn)) return true;
      return false;
    };

    for (const room of project.rooms) {
      // Get untagged images that belong to this room (room field OR AI-detected spaces)
      const untaggedImages = project.images.filter(
        (img) => imageMatchesRoom(img, room.name) && img.tags.length === 0
      );

      // Get unlinked selections
      const unlinkedSelections = room.selections.filter((s) => s.productTagId == null);

      // Skip already-linked selections
      for (const s of room.selections.filter((s) => s.productTagId != null)) {
        skipped.push({
          selectionId: s.id,
          productName: s.productName,
          reason: 'already_linked',
        });
      }

      if (untaggedImages.length === 0) {
        for (const s of unlinkedSelections) {
          skipped.push({
            selectionId: s.id,
            productName: s.productName,
            reason: 'no_untagged_images',
          });
        }
        continue;
      }

      // Resolve selections to Products
      const resolved: Array<{
        selectionId: string;
        productId: string;
        productName: string | null;
      }> = [];

      for (const sel of unlinkedSelections) {
        const match = await resolveSelectionToProduct(sel);
        if (match) {
          resolved.push({
            selectionId: sel.id,
            productId: match.productId,
            productName: sel.productName,
          });
        } else {
          skipped.push({
            selectionId: sel.id,
            productName: sel.productName,
            reason: 'no_product_match',
          });
        }
      }

      if (resolved.length === 0) continue;

      // Distribute resolved selections across untagged images.
      // Strategy: assign all resolved products to each untagged image
      // (each image gets tagged with all room products).
      for (const image of untaggedImages) {
        const positions = computeTagPositions(resolved.length);

        for (let i = 0; i < resolved.length; i++) {
          const { selectionId, productId, productName } = resolved[i];
          const { x, y } = positions[i];

          if (dryRun) {
            created.push({
              productTagId: `dry-run-${selectionId}-${image.id}`,
              selectionId,
              imageId: image.id,
              productId,
              productName: productName ?? '',
              x,
              y,
            });
          } else {
            // Wrap each tag + link in a transaction
            const result = await prisma.$transaction(async (tx) => {
              const tag = await tx.productTag.create({
                data: { x, y, productId, imageId: image.id },
              });
              await tx.selection.update({
                where: { id: selectionId },
                data: { productTagId: tag.id },
              });
              return tag;
            });

            created.push({
              productTagId: result.id,
              selectionId,
              imageId: image.id,
              productId,
              productName: productName ?? '',
              x,
              y,
            });
          }
        }
      }
    }

    console.log(
      `[auto-tag] project=${projectId} created=${created.length} skipped=${skipped.length} dryRun=${dryRun}`
    );

    return NextResponse.json({
      created,
      skipped,
      summary: {
        created: created.length,
        skipped: skipped.length,
      },
    });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[auto-tag] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

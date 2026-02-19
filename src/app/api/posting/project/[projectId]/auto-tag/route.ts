export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { resolveSelectionToProduct } from '@/lib/tagging/resolveSelectionToProduct';
import { ensureProductForSelection } from '@/lib/tagging/ensureProductForSelection';
import { estimateProductCoordinates, matchProductsToLocations } from '@/lib/tagging/estimateProductCoordinates';

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
 * Parse generated image metadata from the name field.
 * Generated images store JSON in `name` with type, selectionIds, etc.
 */
function parseGeneratedMetadata(name: string | null): { type: string; selectionIds: string[] } | null {
  if (!name) return null;
  try {
    const meta = JSON.parse(name);
    if (meta.type === 'GENERATED' && Array.isArray(meta.selectionIds)) {
      return meta;
    }
  } catch {
    // Not JSON metadata, just a regular filename
  }
  return null;
}

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
                uiMeta: true,
              },
            },
          },
        },
        images: {
          select: {
            id: true,
            url: true,
            room: true,
            name: true,
            aiSpaces: true,
            tags: { select: { id: true } },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Backfill: ensure Product records exist for selections that don't have one.
    // Uses shared ensureProductForSelection utility for consistency.
    for (const room of project.rooms) {
      for (const sel of room.selections) {
        if (!sel.productName) continue;
        const selMeta = sel.uiMeta as Record<string, unknown> | null;
        if (selMeta?.productId) {
          // Verify the Product actually exists (guard against dangling refs)
          const exists = await prisma.product.findUnique({
            where: { id: selMeta.productId as string },
            select: { id: true },
          });
          if (exists) continue;
          console.log(`[auto-tag] Dangling uiMeta.productId ${selMeta.productId} for "${sel.productName}" — will backfill`);
        }

        const productId = await ensureProductForSelection({
          productName: sel.productName,
          vendorName: sel.vendorName,
        });

        if (productId) {
          const currentMeta = (selMeta as Record<string, unknown>) || {};
          await prisma.selection.update({
            where: { id: sel.id },
            data: { uiMeta: { ...currentMeta, productId } },
          });
          console.log(`[auto-tag] Backfilled Product "${sel.productName}" (${productId}) for Selection ${sel.id}`);
        }
      }
    }

    console.log(`[auto-tag] Project ${projectId}: ${project.rooms.length} rooms, ${project.images.length} images`);
    for (const img of project.images) {
      let isGen = false;
      try { isGen = JSON.parse(img.name || '').type === 'GENERATED'; } catch {}
      console.log(`[auto-tag]   Image ${img.id.slice(0, 8)}... room="${img.room}" gen=${isGen} tags=${img.tags.length}`);
    }
    for (const room of project.rooms) {
      const unlinked = room.selections.filter((s) => s.productTagId == null);
      console.log(`[auto-tag]   Room "${room.name}" (${room.id.slice(0, 8)}...): ${room.selections.length} sels, ${unlinked.length} unlinked`);
    }

    const created: CreatedTag[] = [];
    const skipped: SkippedSelection[] = [];

    // Helper: check if an image matches a room by room field, room ID, or aiSpaces
    // Generated images store roomId in the room field; uploaded photos store the room name
    // Images with no room assignment are available for ANY room
    const imageMatchesRoom = (img: { room: string | null; aiSpaces: string[] }, roomId: string, roomName: string) => {
      if (!img.room && (!img.aiSpaces || img.aiSpaces.length === 0)) return true;
      if (img.room && img.room === roomId) return true;
      const rn = roomName.toLowerCase();
      if (img.room && img.room.toLowerCase() === rn) return true;
      if (img.aiSpaces?.some((s) => s.toLowerCase() === rn)) return true;
      return false;
    };

    for (const room of project.rooms) {
      // Get untagged images that belong to this room (room ID, room name, or AI-detected spaces)
      const untaggedImages = project.images.filter(
        (img) => imageMatchesRoom(img, room.id, room.name) && img.tags.length === 0
      );

      console.log(`[auto-tag]   Room "${room.name}" (${room.id.slice(0, 8)}...): ${untaggedImages.length} untagged images match`);

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

      // Pre-resolve all unlinked selections to Products (cached for reuse across images)
      const resolutionCache = new Map<string, { productId: string; matchMethod: string } | null>();
      for (const sel of unlinkedSelections) {
        const match = await resolveSelectionToProduct(sel);
        resolutionCache.set(sel.id, match);
        console.log(`[auto-tag]     Resolve "${sel.productName}" → ${match ? `${match.matchMethod} (${match.productId.slice(0, 8)})` : 'NULL'}`);
      }

      // Track which selections have been linked to avoid double-linking
      const linkedSelectionIds = new Set<string>();

      // Process each untagged image
      for (const image of untaggedImages) {
        // For generated images, only tag the specific selections from metadata.
        // For uploaded photos, tag all room selections.
        const genMeta = parseGeneratedMetadata(image.name);
        const candidateSelections = genMeta?.selectionIds
          ? unlinkedSelections.filter((s) => genMeta.selectionIds.includes(s.id))
          : unlinkedSelections;

        // Filter out already-linked selections (linked on a previous image)
        const selectionsForImage = candidateSelections.filter(
          (s) => !linkedSelectionIds.has(s.id)
        );

        // Resolve to products
        const resolved: Array<{
          selectionId: string;
          productId: string;
          productName: string | null;
        }> = [];

        for (const sel of selectionsForImage) {
          const match = resolutionCache.get(sel.id);
          if (match) {
            resolved.push({
              selectionId: sel.id,
              productId: match.productId,
              productName: sel.productName,
            });
          }
        }

        if (resolved.length === 0) continue;

        // Use vision API to estimate product coordinates on this image
        const productNamesForImage = resolved.map((r) => r.productName ?? 'unknown product');
        let positions: Array<{ x: number; y: number }>;
        try {
          const detections = await estimateProductCoordinates(image.url, productNamesForImage);
          positions = matchProductsToLocations(productNamesForImage, detections);
          console.log(`[auto-tag] Vision estimated ${detections.length} detections for image ${image.id.slice(0, 8)}`);
        } catch (visionErr) {
          console.warn('[auto-tag] Vision estimation failed, using fallback positions:', visionErr);
          positions = computeTagPositions(resolved.length);
        }

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

          linkedSelectionIds.add(selectionId);
        }
      }

      // Track unresolved selections as skipped
      for (const sel of unlinkedSelections) {
        if (!resolutionCache.get(sel.id) && !linkedSelectionIds.has(sel.id)) {
          skipped.push({
            selectionId: sel.id,
            productName: sel.productName,
            reason: 'no_product_match',
          });
        }
      }
    }

    // Second pass: handle generated images that weren't matched to any room.
    // Generated images embed their selectionIds in metadata, so we can create
    // tags directly without relying on room-image matching.
    const allLinkedSelIds = new Set(created.map((t) => t.selectionId));
    const allSelections = project.rooms.flatMap((r) => r.selections);

    for (const image of project.images) {
      if (image.tags.length > 0) continue; // already tagged
      if (created.some((t) => t.imageId === image.id)) continue; // tagged in first pass

      const genMeta = parseGeneratedMetadata(image.name);
      if (!genMeta?.selectionIds?.length) continue;

      console.log(`[auto-tag] Second pass: generated image ${image.id.slice(0, 8)} has ${genMeta.selectionIds.length} selectionIds`);

      // Find unlinked selections from metadata
      const metaSelections = allSelections.filter(
        (s) => genMeta.selectionIds.includes(s.id) && s.productTagId == null && !allLinkedSelIds.has(s.id)
      );

      // Resolve to products
      const resolved: Array<{ selectionId: string; productId: string; productName: string | null }> = [];
      for (const sel of metaSelections) {
        const match = await resolveSelectionToProduct(sel);
        if (match) {
          resolved.push({ selectionId: sel.id, productId: match.productId, productName: sel.productName });
          console.log(`[auto-tag]   "${sel.productName}" → ${match.matchMethod}`);
        }
      }

      if (resolved.length === 0) continue;

      // Use vision API for second-pass generated images too
      const productNamesForGen = resolved.map((r) => r.productName ?? 'unknown product');
      let positions: Array<{ x: number; y: number }>;
      try {
        const detections = await estimateProductCoordinates(image.url, productNamesForGen);
        positions = matchProductsToLocations(productNamesForGen, detections);
        console.log(`[auto-tag] Second pass: vision estimated ${detections.length} detections for image ${image.id.slice(0, 8)}`);
      } catch (visionErr) {
        console.warn('[auto-tag] Second pass: vision estimation failed, using fallback:', visionErr);
        positions = computeTagPositions(resolved.length);
      }
      for (let i = 0; i < resolved.length; i++) {
        const { selectionId, productId, productName } = resolved[i];
        const { x, y } = positions[i];

        if (dryRun) {
          created.push({
            productTagId: `dry-run-${selectionId}-${image.id}`,
            selectionId, imageId: image.id, productId,
            productName: productName ?? '', x, y,
          });
        } else {
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
            selectionId, imageId: image.id, productId,
            productName: productName ?? '', x, y,
          });
        }
        allLinkedSelIds.add(selectionId);
      }
      console.log(`[auto-tag] Second pass: created ${resolved.length} tags for image ${image.id.slice(0, 8)}`);
    }

    // Remove skipped entries for selections that were resolved in the second pass
    const finalSkipped = skipped.filter((s) => !allLinkedSelIds.has(s.selectionId));

    console.log(
      `[auto-tag] project=${projectId} created=${created.length} skipped=${finalSkipped.length} dryRun=${dryRun}`
    );

    return NextResponse.json({
      created,
      skipped: finalSkipped,
      summary: {
        created: created.length,
        skipped: finalSkipped.length,
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

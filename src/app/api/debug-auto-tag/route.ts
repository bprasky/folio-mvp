export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureProductForSelection } from '@/lib/tagging/ensureProductForSelection';
import { resolveSelectionToProduct } from '@/lib/tagging/resolveSelectionToProduct';

/**
 * GET /api/debug-auto-tag?projectId=xxx
 *
 * Standalone diagnostic: backfills Products, resolves selections, creates tags.
 * Returns verbose step-by-step output so we can see exactly where things break.
 *
 * DELETE THIS ENDPOINT after debugging.
 */
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId query param required' }, { status: 400 });
  }

  const log: string[] = [];
  const push = (msg: string) => { log.push(msg); console.log(`[debug-auto-tag] ${msg}`); };

  try {
    push(`Starting for project ${projectId}`);

    // 1. Fetch project data
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        rooms: {
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
            room: true,
            name: true,
            aiSpaces: true,
            tags: { select: { id: true } },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found', log });
    }

    push(`Found ${project.rooms.length} rooms, ${project.images.length} images`);

    // 2. Log image details
    for (const img of project.images) {
      let isGen = false;
      let genSelIds: string[] = [];
      try {
        const meta = JSON.parse(img.name || '');
        isGen = meta.type === 'GENERATED';
        genSelIds = meta.selectionIds || [];
      } catch {}
      push(`  Image ${img.id}: room="${img.room}" gen=${isGen} tags=${img.tags.length} selectionIds=${JSON.stringify(genSelIds)}`);
    }

    // 3. Backfill Products for each selection
    const backfillResults: Array<{ selId: string; name: string | null; action: string; productId: string | null }> = [];

    for (const room of project.rooms) {
      push(`  Room "${room.name}" (${room.id}): ${room.selections.length} selections`);

      for (const sel of room.selections) {
        const selMeta = sel.uiMeta as Record<string, unknown> | null;
        const existingProductId = selMeta?.productId as string | undefined;

        push(`    Selection "${sel.productName}" (${sel.id}): uiMeta.productId=${existingProductId || 'NONE'} productTagId=${sel.productTagId || 'NONE'}`);

        if (!sel.productName) {
          push(`      SKIP: no productName`);
          backfillResults.push({ selId: sel.id, name: sel.productName, action: 'skip_no_name', productId: null });
          continue;
        }

        // Check if existing productId is valid
        if (existingProductId) {
          const exists = await prisma.product.findUnique({
            where: { id: existingProductId },
            select: { id: true, name: true },
          });
          if (exists) {
            push(`      OK: Product exists (${exists.name})`);
            backfillResults.push({ selId: sel.id, name: sel.productName, action: 'already_valid', productId: existingProductId });
            continue;
          }
          push(`      DANGLING: Product ${existingProductId} does NOT exist in DB`);
        }

        // Backfill
        try {
          const productId = await ensureProductForSelection({
            productName: sel.productName,
            vendorName: sel.vendorName,
          });
          push(`      BACKFILLED: Product ${productId}`);

          if (productId) {
            const currentMeta = (selMeta as Record<string, unknown>) || {};
            await prisma.selection.update({
              where: { id: sel.id },
              data: { uiMeta: { ...currentMeta, productId } },
            });
            push(`      UPDATED uiMeta.productId = ${productId}`);
          }

          backfillResults.push({ selId: sel.id, name: sel.productName, action: productId ? 'backfilled' : 'backfill_null', productId });
        } catch (err: any) {
          push(`      ERROR: ${err.message}`);
          backfillResults.push({ selId: sel.id, name: sel.productName, action: `error: ${err.message}`, productId: null });
        }
      }
    }

    // 4. Resolve selections to Products
    const resolutionResults: Array<{ selId: string; name: string | null; resolved: string | null; method: string | null }> = [];

    for (const room of project.rooms) {
      for (const sel of room.selections) {
        if (sel.productTagId) {
          resolutionResults.push({ selId: sel.id, name: sel.productName, resolved: 'already_tagged', method: null });
          continue;
        }
        try {
          const match = await resolveSelectionToProduct(sel);
          push(`    Resolve "${sel.productName}" → ${match ? `${match.matchMethod} (${match.productId})` : 'NULL'}`);
          resolutionResults.push({
            selId: sel.id,
            name: sel.productName,
            resolved: match?.productId || null,
            method: match?.matchMethod || null,
          });
        } catch (err: any) {
          push(`    Resolve "${sel.productName}" → ERROR: ${err.message}`);
          resolutionResults.push({ selId: sel.id, name: sel.productName, resolved: `error: ${err.message}`, method: null });
        }
      }
    }

    // 5. Check image-room matching
    const imageRoomMatches: Array<{ imageId: string; roomId: string; roomName: string; matches: boolean }> = [];
    for (const room of project.rooms) {
      for (const img of project.images) {
        const matches = (() => {
          if (!img.room && (!img.aiSpaces || img.aiSpaces.length === 0)) return true;
          if (img.room && img.room === room.id) return true;
          const rn = room.name.toLowerCase();
          if (img.room && img.room.toLowerCase() === rn) return true;
          if (img.aiSpaces?.some((s) => s.toLowerCase() === rn)) return true;
          return false;
        })();
        imageRoomMatches.push({ imageId: img.id, roomId: room.id, roomName: room.name, matches });
        push(`  Image ${img.id.slice(0, 8)} → Room "${room.name}": ${matches ? 'MATCH' : 'NO MATCH'}`);
      }
    }

    // 6. Try creating tags (dry run info only)
    const resolved = resolutionResults.filter((r) => r.resolved && !r.resolved.startsWith('error') && r.resolved !== 'already_tagged');
    const matchingImages = imageRoomMatches.filter((m) => m.matches);
    const untaggedMatchingImages = matchingImages.filter((m) => {
      const img = project.images.find((i) => i.id === m.imageId);
      return img && img.tags.length === 0;
    });

    push(`Summary: ${resolved.length} selections resolved, ${untaggedMatchingImages.length} untagged images match rooms`);

    return NextResponse.json({
      log,
      backfillResults,
      resolutionResults,
      imageRoomMatches,
      summary: {
        totalSelections: project.rooms.reduce((n, r) => n + r.selections.length, 0),
        totalImages: project.images.length,
        selectionsResolved: resolved.length,
        untaggedMatchingImages: untaggedMatchingImages.length,
        canCreateTags: resolved.length > 0 && untaggedMatchingImages.length > 0,
      },
    });
  } catch (error: any) {
    push(`FATAL ERROR: ${error.message}`);
    return NextResponse.json({ error: error.message, log }, { status: 500 });
  }
}

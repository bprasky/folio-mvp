export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { analyzeImage, shouldAnalyzeImage } from '@/lib/import-agent/analyze';
import { ensureProductForSelection } from '@/lib/tagging/ensureProductForSelection';
import { ROOM_TYPE_TO_ENUM, ROOM_TYPE_DISPLAY_NAMES } from '@/lib/import-agent/roomTypes';
import type { RoomAnalysis, DetectedProduct } from '@/lib/import-agent/types';

export const runtime = 'nodejs';
// Allow up to 5 minutes for analyzing many images
export const maxDuration = 300;

type AnalysisResult = {
  imageId: string;
  analysis: RoomAnalysis;
  products: DetectedProduct[];
};

type ImageError = {
  imageId: string;
  error: string;
};

/**
 * POST /api/projects/[id]/analyze-images
 *
 * Analyzes uploaded project images using Claude vision to:
 * 1. Detect room types and update ProjectImage metadata
 * 2. Create Room records for each unique detected room type
 * 3. Create Selection records with linked Product records for each detected product
 * 4. Create ProductTag records positioning products on their source images
 *
 * Body (optional):
 *   imageIds?: string[]  — analyze only these images (default: all unanalyzed)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    await assertProjectView(userId, projectId);

    const body = await request.json().catch(() => ({}));
    const requestedImageIds: string[] | undefined = body.imageIds;

    // Fetch project images
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        images: {
          select: {
            id: true,
            url: true,
            name: true,
            room: true,
            aiSpaces: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Filter to target images: specific IDs or all unanalyzed
    let targetImages = project.images;
    if (requestedImageIds?.length) {
      targetImages = targetImages.filter(img => requestedImageIds.includes(img.id));
    } else {
      // Only analyze images that haven't been analyzed yet
      targetImages = targetImages.filter(img => !img.aiSpaces || img.aiSpaces.length === 0);
    }

    if (targetImages.length === 0) {
      return NextResponse.json({
        analyzed: 0,
        skipped: project.images.length,
        roomsCreated: 0,
        selectionsCreated: 0,
        tagsCreated: 0,
        rooms: [],
        errors: [],
      });
    }

    console.log(`[analyze-images] Project ${projectId}: analyzing ${targetImages.length} of ${project.images.length} images`);

    // ── Phase 1: Image Analysis ──
    const results: AnalysisResult[] = [];
    const errors: ImageError[] = [];
    let skipped = 0;

    for (const image of targetImages) {
      try {
        // Check if image should be analyzed (skip title slides, etc.)
        const check = await shouldAnalyzeImage({ type: 'url', url: image.url });
        if (!check.shouldAnalyze) {
          console.log(`[analyze-images] Skipping ${image.id.slice(0, 8)}: ${check.reason}`);
          skipped++;
          continue;
        }

        // Analyze with Claude vision
        const analysis = await analyzeImage({ type: 'url', url: image.url });
        console.log(`[analyze-images] Image ${image.id.slice(0, 8)}: ${analysis.roomType}, ${analysis.products.length} products`);

        // Update ProjectImage with analysis metadata
        await prisma.projectImage.update({
          where: { id: image.id },
          data: {
            room: analysis.roomType,
            aiSpaces: [analysis.roomType],
            aiTags: analysis.styleIndicators,
            aiMaterials: analysis.materials,
            aiColors: analysis.dominantColors,
            indexedAt: new Date(),
          },
        });

        results.push({
          imageId: image.id,
          analysis,
          products: analysis.products,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[analyze-images] Image ${image.id.slice(0, 8)} failed:`, msg);
        errors.push({ imageId: image.id, error: msg });
      }
    }

    // ── Phase 2: Room Creation ──
    // Collect unique room types from all analyses
    const roomTypeSet = new Set(results.map(r => r.analysis.roomType));
    const roomMap = new Map<string, string>(); // roomType -> roomId

    for (const roomType of roomTypeSet) {
      const enumType = ROOM_TYPE_TO_ENUM[roomType] || 'OTHER';
      const displayName = ROOM_TYPE_DISPLAY_NAMES[roomType] || 'Other';

      // Check if room already exists for this project + type
      const existing = await prisma.room.findFirst({
        where: { projectId, type: enumType },
        select: { id: true },
      });

      if (existing) {
        roomMap.set(roomType, existing.id);
      } else {
        const newRoom = await prisma.room.create({
          data: {
            projectId,
            name: displayName,
            type: enumType,
          },
          select: { id: true },
        });
        roomMap.set(roomType, newRoom.id);
        console.log(`[analyze-images] Created room "${displayName}" (${enumType}) -> ${newRoom.id.slice(0, 8)}`);
      }
    }

    // ── Phase 3 & 4: Selection + Product + Tag Creation ──
    let selectionsCreated = 0;
    let tagsCreated = 0;

    for (const result of results) {
      const roomId = roomMap.get(result.analysis.roomType);
      if (!roomId) continue;

      for (const product of result.products) {
        try {
          const productName = product.extractedProductName || product.description;

          // Ensure Product record exists
          const productId = await ensureProductForSelection({
            productName,
            vendorName: product.extractedVendor || null,
            unitPrice: product.extractedPrice
              ? parseFloat(product.extractedPrice.replace(/[$,]/g, ''))
              : null,
          });

          if (!productId) {
            console.warn(`[analyze-images] Could not create product for "${productName}"`);
            continue;
          }

          // Convert position from 0-1 to 0-100 percentage, clamped to 5-95
          const x = Math.max(5, Math.min(95, product.position.x * 100));
          const y = Math.max(5, Math.min(95, product.position.y * 100));

          // Create ProductTag and Selection in a transaction
          const { tag, selection } = await prisma.$transaction(async (tx) => {
            const tag = await tx.productTag.create({
              data: {
                x,
                y,
                productId,
                imageId: result.imageId,
              },
            });

            const selection = await tx.selection.create({
              data: {
                projectId,
                roomId,
                productName,
                vendorName: product.extractedVendor || null,
                tags: [product.category.toLowerCase()],
                source: 'ai_analysis',
                productTagId: tag.id,
                uiMeta: {
                  productId,
                  position: product.position,
                  confidence: product.confidence,
                  analysisSource: 'import_agent',
                },
              },
            });

            return { tag, selection };
          });

          tagsCreated++;
          selectionsCreated++;
          console.log(`[analyze-images] Tagged "${productName}" at (${x.toFixed(1)}, ${y.toFixed(1)}) on image ${result.imageId.slice(0, 8)}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[analyze-images] Product creation failed for "${product.description}":`, msg);
        }
      }
    }

    // Build room summary
    const roomSummary = await Promise.all(
      Array.from(roomMap.entries()).map(async ([roomType, roomId]) => {
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          select: {
            id: true,
            name: true,
            type: true,
            _count: { select: { selections: true } },
          },
        });
        return room
          ? { id: room.id, name: room.name, type: room.type, selectionCount: room._count.selections }
          : null;
      })
    );

    const newRoomsCreated = roomTypeSet.size - Array.from(roomMap.values()).filter(async (id) => {
      // This is approximate — count is correct from roomMap creation logic
      return true;
    }).length;

    console.log(`[analyze-images] Done: analyzed=${results.length} skipped=${skipped} rooms=${roomMap.size} selections=${selectionsCreated} tags=${tagsCreated} errors=${errors.length}`);

    return NextResponse.json({
      analyzed: results.length,
      skipped,
      roomsCreated: roomMap.size,
      selectionsCreated,
      tagsCreated,
      rooms: roomSummary.filter(Boolean),
      errors: errors.map(e => `Image ${e.imageId.slice(0, 8)}: ${e.error}`),
    });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[analyze-images] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

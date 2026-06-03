export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { analyzeImagesBatch } from '@/lib/import-agent/analyze';
import { ROOM_TYPE_TO_ENUM, ROOM_TYPE_DISPLAY_NAMES } from '@/lib/import-agent/roomTypes';
import { IMPORT_AGENT_CONFIG } from '@/lib/import-agent/config';
import { recordLabelEvent } from '@/lib/vision/recordLabelEvent';
import type { RoomAnalysis, ConfidenceLevel } from '@/lib/import-agent/types';

// Auto-sort a photo into a room only when the model is at least this sure of
// the room call. Photos below the bar (cropped detail shots, ambiguous spaces,
// or an omitted confidence) are left unassigned for the designer to sort by
// hand — a confident-but-wrong auto-file erodes trust more than an empty slot.
const ROOM_SORT_MIN_CONFIDENCE: ConfidenceLevel = 'medium';
const ROOM_CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };
const meetsRoomSortBar = (a: RoomAnalysis): boolean =>
  ROOM_CONFIDENCE_RANK[a.roomConfidence ?? 'low'] >=
  ROOM_CONFIDENCE_RANK[ROOM_SORT_MIN_CONFIDENCE];

export const runtime = 'nodejs';
// Allow up to 5 minutes for analyzing many images
export const maxDuration = 300;

type AnalysisResult = {
  imageId: string;
  analysis: RoomAnalysis;
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
 * 2. Create Room records and auto-sort photos — but only for photos the model
 *    is confident about (>= ROOM_SORT_MIN_CONFIDENCE). Low-confidence photos are
 *    left unassigned for the designer to sort by hand.
 *
 * It intentionally does NOT create Selection/ProductTag "descriptor" guesses.
 * Boards shows real selections only, and those come from the designer's tagging
 * pass — not from auto-generated product descriptions.
 *
 * Body (optional):
 *   imageIds?: string[]  — analyze only these images (default: all unanalyzed)
 *   force?: boolean      — re-analyze already-analyzed images too (re-sort rooms).
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
    const force: boolean = body.force === true;

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

    // Filter to target images: specific IDs, all (force re-sort), or all unanalyzed
    let targetImages = project.images;
    if (requestedImageIds?.length) {
      targetImages = targetImages.filter(img => requestedImageIds.includes(img.id));
    } else if (!force) {
      // Only analyze images that haven't been analyzed yet (unless forcing a re-sort)
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

    console.log(`[analyze-images] Project ${projectId}: analyzing ${targetImages.length} of ${project.images.length} images (batch mode)`);

    // ── Phase 1: Batch Image Analysis ──
    // Uses a single Claude API call per batch of images instead of 2 calls per image
    const results: AnalysisResult[] = [];
    const errors: ImageError[] = [];
    let skipped = 0;

    try {
      const batchImages = targetImages.map(img => ({ id: img.id, url: img.url }));
      const analysisMap = await analyzeImagesBatch(batchImages);

      for (const image of targetImages) {
        const analysis = analysisMap.get(image.id);
        if (!analysis) {
          console.log(`[analyze-images] Skipping ${image.id.slice(0, 8)}: not an interior photo or batch skipped`);
          skipped++;
          continue;
        }

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

        // Record the model's room prediction — the "before" of the delta.
        await recordLabelEvent({
          projectId,
          imageId: image.id,
          source: 'MODEL',
          model: IMPORT_AGENT_CONFIG.model,
          taskType: 'ROOM',
          action: 'predict',
          value: {
            roomType: analysis.roomType,
            roomLabel: analysis.roomLabel ?? null,
            roomGroup: analysis.roomGroup ?? null,
          },
        });

        results.push({
          imageId: image.id,
          analysis,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[analyze-images] Batch analysis failed:`, msg);
      // Record error for all images
      for (const image of targetImages) {
        errors.push({ imageId: image.id, error: msg });
      }
    }

    // ── Phase 2: Room Creation (differentiated, spec 20 follow-up) ──
    // Group photos by PHYSICAL room (roomGroup), not just type, so two
    // different bathrooms become two rooms. Use the AI's descriptive label
    // as-is; number only when base names collide (Bathroom 1, Bathroom 2).
    // Then auto-assign each photo to its room (designer renames/refines later).
    const groupKeyFor = (a: { roomGroup?: string; roomLabel?: string; roomType: string }): string => {
      if (a.roomGroup) return `grp:${a.roomGroup}`;
      if (a.roomLabel) return `lbl:${a.roomLabel.toLowerCase().trim()}`;
      return `typ:${a.roomType}`;
    };

    // Only auto-sort photos the model is confident about. Low-confidence calls
    // are left unassigned (designer sorts them by hand) rather than guessed.
    const sortable = results.filter(r => meetsRoomSortBar(r.analysis));
    const heldBack = results.length - sortable.length;
    if (heldBack > 0) {
      console.log(`[analyze-images] Holding ${heldBack} low-confidence photo(s) back from auto-sort`);
    }

    interface GroupInfo { roomType: string; baseName: string; imageIds: string[]; }
    const groups = new Map<string, GroupInfo>();
    for (const r of sortable) {
      const a = r.analysis;
      const key = groupKeyFor(a);
      const baseName =
        (a.roomLabel && a.roomLabel.trim()) ||
        ROOM_TYPE_DISPLAY_NAMES[a.roomType] ||
        'Other';
      const g = groups.get(key);
      if (g) g.imageIds.push(r.imageId);
      else groups.set(key, { roomType: a.roomType, baseName, imageIds: [r.imageId] });
    }

    // Number only base names shared by more than one distinct room.
    const baseNameCounts = new Map<string, number>();
    for (const g of Array.from(groups.values())) {
      baseNameCounts.set(g.baseName, (baseNameCounts.get(g.baseName) || 0) + 1);
    }
    const baseNameSeq = new Map<string, number>();

    const roomMap = new Map<string, string>(); // groupKey -> roomId
    for (const [key, g] of Array.from(groups.entries())) {
      const enumType = ROOM_TYPE_TO_ENUM[g.roomType] || 'OTHER';
      let name = g.baseName;
      if ((baseNameCounts.get(g.baseName) || 0) > 1) {
        const n = (baseNameSeq.get(g.baseName) || 0) + 1;
        baseNameSeq.set(g.baseName, n);
        name = `${g.baseName} ${n}`;
      }

      // Reuse a same-named room if one already exists; otherwise create it.
      const existing = await prisma.room.findFirst({
        where: { projectId, name },
        select: { id: true },
      });
      const roomId =
        existing?.id ??
        (
          await prisma.room.create({
            data: { projectId, name, type: enumType },
            select: { id: true },
          })
        ).id;
      roomMap.set(key, roomId);

      // Auto-sort: assign every photo in this group to the room. Reversible
      // in the UI (reassign / leave out / rename).
      await prisma.projectImage.updateMany({
        where: { id: { in: g.imageIds }, projectId },
        data: { roomId },
      });
      console.log(`[analyze-images] Room "${name}" (${enumType}) <- ${g.imageIds.length} photo(s)`);
    }

    // Product detection is intentionally NOT persisted here. Boards shows real
    // selections only — those come from the designer's tagging pass, not from
    // auto-generated "descriptor" guesses. This route's job ends at room sorting.
    const selectionsCreated = 0;
    const tagsCreated = 0;

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

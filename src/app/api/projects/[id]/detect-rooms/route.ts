/**
 * POST /api/projects/[id]/detect-rooms
 *
 * Wizard helper: classify each project photo's room type with Claude vision and
 * set ProjectImage.room to a friendly label, so the "Label Rooms" step is
 * pre-filled and the designer only has to refine (e.g. split Bathroom into
 * Master/Powder). Intentionally room-typing ONLY — it does not create selections
 * or product tags (that's the spec/tag-review flow).
 */

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { analyzeImagesBatch } from '@/lib/import-agent/analyze';
import { ROOM_TYPE_TO_ENUM, ROOM_TYPE_DISPLAY_NAMES } from '@/lib/import-agent/roomTypes';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    try {
      await assertProjectWrite(userId, projectId);
    } catch {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedImageIds: string[] | undefined = Array.isArray(body.imageIds) ? body.imageIds : undefined;

    const images = await prisma.projectImage.findMany({
      where: {
        projectId,
        ...(requestedImageIds ? { id: { in: requestedImageIds } } : {}),
      },
      select: { id: true, url: true },
      orderBy: { createdAt: 'asc' },
    });

    if (images.length === 0) {
      return NextResponse.json({ assignments: {}, rooms: [] });
    }

    // Vision classification (batched). We only use roomType; product output is ignored.
    const analyses = await analyzeImagesBatch(images.map((i) => ({ id: i.id, url: i.url })));

    const assignments: Record<string, string> = {};
    const labelToType = new Map<string, string>(); // label -> roomType enum key

    for (const image of images) {
      const roomType = analyses.get(image.id)?.roomType || 'other';
      const label = ROOM_TYPE_DISPLAY_NAMES[roomType] || 'Other';
      assignments[image.id] = label;
      if (!labelToType.has(label)) labelToType.set(label, roomType);
    }

    // Persist labels on the images.
    await Promise.all(
      Object.entries(assignments).map(([imageId, room]) =>
        prisma.projectImage.update({ where: { id: imageId }, data: { room } })
      )
    );

    // Ensure a Room record exists for each detected label (parity with manual add).
    for (const [label, roomType] of Array.from(labelToType.entries())) {
      const enumType = ROOM_TYPE_TO_ENUM[roomType] || 'OTHER';
      const existing = await prisma.room.findFirst({
        where: { projectId, type: enumType },
        select: { id: true },
      });
      if (!existing) {
        await prisma.room.create({ data: { projectId, name: label, type: enumType } });
      }
    }

    return NextResponse.json({
      assignments,
      rooms: Array.from(labelToType.keys()),
    });
  } catch (error) {
    console.error('[detect-rooms] error:', error);
    return NextResponse.json({ error: 'Failed to detect rooms' }, { status: 500 });
  }
}

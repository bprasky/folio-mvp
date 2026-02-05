export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { resolveSelectionToProduct } from '@/lib/tagging/resolveSelectionToProduct';

/**
 * GET /api/posting/project/[projectId]/tag-diagnostic
 *
 * Returns a per-room breakdown of Selection ↔ ProductTag readiness:
 *   - How many selections exist per room
 *   - How many resolve to a Product record
 *   - How many images are tagged vs. untagged
 *   - Whether auto-tagging is possible
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;
    await assertProjectView(session.user.id, projectId);

    // Fetch everything in one query
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
              },
            },
          },
        },
        images: {
          select: {
            id: true,
            room: true,
            tags: { select: { id: true } },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build room diagnostics
    const roomDiagnostics = await Promise.all(
      project.rooms.map(async (room) => {
        // Match images to this room by string name (case-insensitive)
        const roomImages = project.images.filter(
          (img) => img.room && img.room.toLowerCase() === room.name.toLowerCase()
        );

        const taggedImages = roomImages.filter((img) => img.tags.length > 0);
        const untaggedImages = roomImages.filter((img) => img.tags.length === 0);
        const alreadyLinked = room.selections.filter((s) => s.productTagId != null);

        // Resolve each unlinked selection to a Product
        const unlinkedSelections = room.selections.filter((s) => s.productTagId == null);
        let withProductMatch = 0;

        for (const sel of unlinkedSelections) {
          const match = await resolveSelectionToProduct(sel);
          if (match) withProductMatch++;
        }

        const autoTaggable = withProductMatch > 0 && untaggedImages.length > 0;

        return {
          roomId: room.id,
          roomName: room.name,
          selections: {
            total: room.selections.length,
            withProductMatch,
            alreadyLinkedToTag: alreadyLinked.length,
          },
          images: {
            total: roomImages.length,
            tagged: taggedImages.length,
            untagged: untaggedImages.length,
          },
          autoTaggable,
        };
      })
    );

    const totalSelections = roomDiagnostics.reduce((n, r) => n + r.selections.total, 0);
    const totalImages = project.images.length;
    const taggedImages = project.images.filter((img) => img.tags.length > 0).length;
    const autoTaggableRooms = roomDiagnostics.filter((r) => r.autoTaggable).length;

    return NextResponse.json({
      rooms: roomDiagnostics,
      summary: {
        totalSelections,
        totalImages,
        taggedImages,
        autoTaggableRooms,
        needsAttention: autoTaggableRooms > 0,
      },
    });
  } catch (error: any) {
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[tag-diagnostic] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

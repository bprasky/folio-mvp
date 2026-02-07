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
            name: true,
            aiSpaces: true,
            tags: { select: { id: true } },
            aiClassification: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Helper: check if an image matches a room by room field, room ID, or aiSpaces
    // Generated images store roomId in the room field; uploaded photos store the room name
    // Images with no room assignment are available for ANY room
    const imageMatchesRoom = (img: { room: string | null; aiSpaces: string[] }, roomId: string, roomName: string) => {
      // No room assignment → available for any room
      if (!img.room && (!img.aiSpaces || img.aiSpaces.length === 0)) return true;
      // Generated images store the room UUID in img.room
      if (img.room && img.room === roomId) return true;
      // Uploaded photos store the room name string in img.room
      const rn = roomName.toLowerCase();
      if (img.room && img.room.toLowerCase() === rn) return true;
      // AI-detected spaces match (e.g., aiSpaces: ["kitchen"] matches Room "Kitchen")
      if (img.aiSpaces?.some((s) => s.toLowerCase() === rn)) return true;
      return false;
    };

    // Build room diagnostics
    const roomDiagnostics = await Promise.all(
      project.rooms.map(async (room) => {
        // Match images to this room by room ID, room name, or AI-detected spaces
        const roomImages = project.images.filter((img) => imageMatchesRoom(img, room.id, room.name));

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
    const classifiedImages = project.images.filter((img) => img.aiClassification != null).length;
    const autoTaggableRooms = roomDiagnostics.filter((r) => r.autoTaggable).length;
    // Also count images without a room assignment (can't be matched to selections)
    const imagesWithoutRoom = project.images.filter((img) => !img.room).length;
    // Detect generated images (planning-stage indicator)
    const generatedImages = project.images.filter((img) => {
      if (!img.name) return false;
      try { return JSON.parse(img.name).type === 'GENERATED'; } catch { return false; }
    }).length;

    // needsAttention is true when the project has gaps that hurt interview quality:
    // 1. Auto-taggable rooms exist (selections can become tags)
    // 2. Images exist but NONE are tagged (interview has no product context)
    // 3. Images exist but NONE are classified (interview can't generate contextual questions)
    const hasNoTags = totalImages > 0 && taggedImages === 0;
    const hasNoClassifications = totalImages > 0 && classifiedImages === 0;

    return NextResponse.json({
      rooms: roomDiagnostics,
      summary: {
        totalSelections,
        totalImages,
        taggedImages,
        classifiedImages,
        autoTaggableRooms,
        imagesWithoutRoom,
        generatedImages,
        needsAttention: autoTaggableRooms > 0 || hasNoTags,
        // Separate flags so the UI can show specific guidance
        hasNoTags,
        hasNoClassifications,
        hasAutoTaggable: autoTaggableRooms > 0,
        hasGeneratedImages: generatedImages > 0,
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

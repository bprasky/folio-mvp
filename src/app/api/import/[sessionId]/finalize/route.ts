import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const ROOM_TYPE_TO_ENUM: Record<string, string> = {
  'living_room': 'LIVING',
  'bedroom': 'BEDROOM',
  'kitchen': 'KITCHEN',
  'bathroom': 'BATHROOM',
  'dining_room': 'DINING',
  'office': 'OFFICE',
  'entry': 'ENTRY',
  'outdoor': 'OUTDOOR',
  'hallway': 'HALLWAY',
  'laundry': 'LAUNDRY',
  'closet': 'CLOSET',
  'other': 'OTHER',
};

/**
 * POST /api/import/[sessionId]/finalize
 * Create rooms and product tags from reviewed pending tags
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
    const { projectId, rooms, products } = body as {
      projectId: string;
      rooms: Array<{ type: string; name: string }>;
      products: Array<{ pendingTagId: string; roomType: string }>;
    };

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Verify session exists and belongs to user
    const importSession = await prisma.importSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!importSession) {
      return NextResponse.json({ error: 'Import session not found' }, { status: 404 });
    }

    // Verify user owns the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [{ ownerId: userId }, { designerId: userId }],
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Create rooms if they don't exist
    const roomIdMap = new Map<string, string>(); // roomType -> roomId

    for (const room of rooms) {
      // Check if room of this type already exists
      const existingRoom = await prisma.room.findFirst({
        where: {
          projectId,
          type: ROOM_TYPE_TO_ENUM[room.type] || 'OTHER',
        },
      });

      if (existingRoom) {
        roomIdMap.set(room.type, existingRoom.id);
      } else {
        // Create new room
        const newRoom = await prisma.room.create({
          data: {
            projectId,
            name: room.name,
            type: ROOM_TYPE_TO_ENUM[room.type] || 'OTHER',
          },
        });
        roomIdMap.set(room.type, newRoom.id);
      }
    }

    // Process selected products
    let confirmedCount = 0;
    let productTagsCreated = 0;

    for (const product of products) {
      const pendingTag = await prisma.pendingProductTag.findUnique({
        where: { id: product.pendingTagId },
      });

      if (!pendingTag) {
        console.warn(`Pending tag not found: ${product.pendingTagId}`);
        continue;
      }

      // Get or create the product from the suggestion
      const suggestion = pendingTag.topSuggestion as {
        productUrl?: string;
        vendorName?: string;
        productName?: string;
        price?: string;
      } | null;

      let productId: string | null = null;

      if (suggestion && suggestion.productUrl) {
        // Check if product already exists by URL
        const existingProduct = await prisma.product.findFirst({
          where: { url: suggestion.productUrl },
        });

        if (existingProduct) {
          productId = existingProduct.id;
        } else {
          // Create pending product
          const newProduct = await prisma.product.create({
            data: {
              name: suggestion.productName || pendingTag.description,
              brand: suggestion.vendorName || 'Unknown',
              url: suggestion.productUrl,
              isPending: true,
              pendingReason: 'Imported from presentation',
            },
          });
          productId = newProduct.id;
        }
      }

      // Get room ID for this product
      const roomId = roomIdMap.get(product.roomType);

      if (!roomId) {
        console.warn(`No room found for type: ${product.roomType}`);
        continue;
      }

      // Create project image if temp URL exists
      let projectImageId: string | null = pendingTag.projectImageId;

      if (!projectImageId && pendingTag.tempImageUrl) {
        // Create project image from temp URL
        const projectImage = await prisma.projectImage.create({
          data: {
            projectId,
            url: pendingTag.tempImageUrl,
            roomId,
            caption: `Imported from presentation - ${pendingTag.category}`,
          },
        });
        projectImageId = projectImage.id;
      }

      // Create product tag if we have both product and image
      if (productId && projectImageId) {
        await prisma.productTag.create({
          data: {
            projectImageId,
            productId,
            x: pendingTag.x,
            y: pendingTag.y,
            createdById: userId,
          },
        });
        productTagsCreated++;
      }

      // Update pending tag status
      await prisma.pendingProductTag.update({
        where: { id: pendingTag.id },
        data: {
          status: 'CONFIRMED',
          confirmedProductId: productId,
          projectImageId,
          reviewedAt: new Date(),
        },
      });
      confirmedCount++;
    }

    // Update import session
    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        projectId,
        verifiedTags: confirmedCount,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      roomsCreated: roomIdMap.size,
      productsConfirmed: confirmedCount,
      productsTagged: productTagsCreated,
    });
  } catch (error) {
    console.error('Error finalizing import:', error);
    return NextResponse.json(
      { error: 'Failed to finalize import' },
      { status: 500 }
    );
  }
}

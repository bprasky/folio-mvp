import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { isWorkspaceImport } from '@/lib/workspace-import/types';
import { ensureProductForSelection } from '@/lib/tagging/ensureProductForSelection';
import { ROOM_TYPE_TO_ENUM } from '@/lib/import-agent/roomTypes';

export const runtime = 'nodejs';

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
    if (isWorkspaceImport(importSession.processingMeta)) return NextResponse.json({ error: 'Manage this import from your workspace.' }, { status: 409 });
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
    let selectionsCreated = 0;

    for (const product of products) {
      const pendingTag = await prisma.pendingProductTag.findUnique({
        where: { id: product.pendingTagId },
      });

      if (!pendingTag) {
        console.warn(`Pending tag not found: ${product.pendingTagId}`);
        continue;
      }

      // Get the suggestion data
      const suggestion = pendingTag.topSuggestion as {
        productUrl?: string;
        vendorName?: string;
        productName?: string;
        price?: string;
        imageUrl?: string;
      } | null;

      // Get extracted spec data (from PDF text extraction)
      const extractedVendor = pendingTag.extractedVendor;
      const extractedPrice = pendingTag.extractedPrice; // in cents
      const extractedDimensions = pendingTag.extractedDimensions;
      const extractedSku = pendingTag.extractedSku;
      const extractedMaterial = pendingTag.extractedMaterial;
      const extractedProductUrl = pendingTag.extractedProductUrl;

      // Get room ID for this product
      const roomId = roomIdMap.get(product.roomType);

      if (!roomId) {
        console.warn(`No room found for type: ${product.roomType}`);
        continue;
      }

      // Parse dimensions string into structured format (e.g., "24W x 18D x 30H" -> {width: 24, depth: 18, height: 30})
      let dimensionsObj: { width?: number; depth?: number; height?: number } | undefined;
      if (extractedDimensions) {
        const dimMatch = extractedDimensions.match(/(\d+(?:\.\d+)?)\s*[Ww]?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[DdLl]?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[Hh]?/);
        if (dimMatch) {
          dimensionsObj = {
            width: parseFloat(dimMatch[1]),
            depth: parseFloat(dimMatch[2]),
            height: parseFloat(dimMatch[3]),
          };
        }
      }

      // Build notes with material info if available
      let notes = 'Imported from presentation';
      if (extractedMaterial) {
        notes += ` | Materials: ${extractedMaterial}`;
      }

      // Determine confidence level for uiMeta
      const hasVendor = !!(extractedVendor || suggestion?.vendorName);
      const hasPrice = !!(extractedPrice || suggestion?.price);
      const specConfidence = hasVendor && hasPrice ? 'high' : (hasVendor || hasPrice ? 'partial' : 'visual_only');

      // Ensure a Product record exists for the attribution chain
      const selProductName = suggestion?.productName || pendingTag.description;
      const selVendorName = extractedVendor || suggestion?.vendorName || null;
      const selUnitPrice = extractedPrice ? (extractedPrice / 100) : (suggestion?.price ? parseFloat(suggestion.price) : null);
      const linkedProductId = await ensureProductForSelection({
        productName: selProductName,
        vendorName: selVendorName,
        photo: pendingTag.tempImageUrl || suggestion?.imageUrl || null,
        unitPrice: selUnitPrice,
        productUrl: extractedProductUrl || suggestion?.productUrl || null,
      });

      // Create a Selection (this is what Designer Board displays)
      // Priority: extracted specs > suggestion data > defaults
      const selection = await prisma.selection.create({
        data: {
          projectId,
          roomId,
          photo: pendingTag.tempImageUrl || suggestion?.imageUrl || null,
          productName: selProductName,
          vendorName: selVendorName,
          productUrl: extractedProductUrl || suggestion?.productUrl || null,
          vendorProductId: extractedSku || null,
          unitPrice: selUnitPrice,
          tags: [pendingTag.category.toLowerCase()], // e.g., ["furniture", "lighting"]
          source: 'import',
          notes,
          uiMeta: {
            dimensions: dimensionsObj,
            specConfidence,
            importedAt: new Date().toISOString(),
            ...(linkedProductId ? { productId: linkedProductId } : {}),
          },
        },
      });
      selectionsCreated++;

      // Update pending tag status
      await prisma.pendingProductTag.update({
        where: { id: pendingTag.id },
        data: {
          status: 'CONFIRMED',
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
      selectionsCreated,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error finalizing import:', errorMsg);
    console.error('Stack:', errorStack);
    return NextResponse.json(
      {
        error: 'Failed to finalize import',
        details: errorMsg,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { recordAtelierSignal } from '@/lib/atelier/signals';
import { AtelierOwnerType, AtelierSignalSourceType } from '@prisma/client';

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
 * Helper: Find matching ProjectImage ID from temporary image URL
 */
function findProjectImageId(
  tempImageUrl: string | null,
  imageUrlToId: Map<string, string>
): string | null {
  if (!tempImageUrl) return null;

  // Direct match
  if (imageUrlToId.has(tempImageUrl)) {
    return imageUrlToId.get(tempImageUrl)!;
  }

  // Try base URL without query params
  const baseUrl = tempImageUrl.split('?')[0];
  if (imageUrlToId.has(baseUrl)) {
    return imageUrlToId.get(baseUrl)!;
  }

  // Try matching by filename
  const filename = tempImageUrl.split('/').pop()?.split('?')[0];
  if (filename) {
    for (const [url, id] of imageUrlToId) {
      if (url.includes(filename)) {
        return id;
      }
    }
  }

  return null;
}

/**
 * Helper: Find or create Product from PendingProductTag data
 */
async function findOrCreateProductFromPending(
  pendingTag: {
    description: string;
    extractedVendor: string | null;
    extractedPrice: number | null; // in cents
    category: string;
    topSuggestion: unknown;
  }
): Promise<string> {
  const suggestion = pendingTag.topSuggestion as {
    productUrl?: string;
    vendorName?: string;
    productName?: string;
    price?: string;
    imageUrl?: string;
  } | null;

  // Determine best name: suggestion name > description
  const productName = suggestion?.productName || pendingTag.description;
  const vendorName = pendingTag.extractedVendor || suggestion?.vendorName || null;

  // Try to find existing product by name + vendor (case-insensitive)
  const existing = await prisma.product.findFirst({
    where: {
      name: { equals: productName, mode: 'insensitive' },
      ...(vendorName ? { brand: { equals: vendorName, mode: 'insensitive' } } : {}),
    },
  });

  if (existing) {
    return existing.id;
  }

  // Create new pending product
  const price = pendingTag.extractedPrice
    ? pendingTag.extractedPrice / 100 // Convert cents to dollars
    : suggestion?.price
      ? parseFloat(suggestion.price)
      : null;

  const product = await prisma.product.create({
    data: {
      name: productName,
      brand: vendorName,
      price: price,
      category: pendingTag.category.toLowerCase(),
      imageUrl: suggestion?.imageUrl || null,
      url: suggestion?.productUrl || null,
      isPending: true,
    },
  });

  return product.id;
}

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
      select: {
        id: true,
        designerId: true,
        ownerId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Get designerId for Atelier signals (prefer project.designerId, fallback to ownerId)
    const designerId = project.designerId || project.ownerId;

    // Fetch project images for URL-to-ID mapping (needed for ProductTag creation)
    const projectImages = await prisma.projectImage.findMany({
      where: { projectId },
      select: { id: true, url: true },
    });

    // Create URL-to-ID mapping for fast lookup
    const imageUrlToId = new Map<string, string>();
    for (const img of projectImages) {
      imageUrlToId.set(img.url, img.id);
      // Also index by base URL without query params
      const baseUrl = img.url.split('?')[0];
      if (baseUrl !== img.url) {
        imageUrlToId.set(baseUrl, img.id);
      }
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
    let productTagsCreated = 0;

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

      // Create a Selection (this is what Designer Board displays)
      // Priority: extracted specs > suggestion data > defaults
      const selection = await prisma.selection.create({
        data: {
          projectId,
          roomId,
          photo: pendingTag.tempImageUrl || suggestion?.imageUrl || null,
          productName: suggestion?.productName || pendingTag.description,
          vendorName: extractedVendor || suggestion?.vendorName || null,
          productUrl: extractedProductUrl || suggestion?.productUrl || null,
          vendorProductId: extractedSku || null,
          unitPrice: extractedPrice ? (extractedPrice / 100) : (suggestion?.price ? parseFloat(suggestion.price) : null),
          tags: [pendingTag.category.toLowerCase()], // e.g., ["furniture", "lighting"]
          source: 'import',
          notes,
          uiMeta: {
            dimensions: dimensionsObj,
            specConfidence,
            importedAt: new Date().toISOString(),
          },
        },
      });
      selectionsCreated++;

      // NEW: Create ProductTag if we have coordinates (connects to Editorial flow)
      // This allows PDF-imported products to appear as visual tags and in materials ledger
      let createdProductTagId: string | null = null;
      if (pendingTag.x != null && pendingTag.y != null) {
        const projectImageId = findProjectImageId(pendingTag.tempImageUrl, imageUrlToId);

        if (projectImageId) {
          try {
            // Find or create Product from pending tag data
            const productId = await findOrCreateProductFromPending(pendingTag);

            // Create ProductTag (same entity as manual tagging creates)
            // Convert coordinates: PendingProductTag uses 0-1 normalized, ProductTag uses 0-100 percentage
            const tag = await prisma.productTag.create({
              data: {
                x: pendingTag.x * 100,
                y: pendingTag.y * 100,
                productId: productId,
                imageId: projectImageId,
              },
            });
            createdProductTagId = tag.id;
            productTagsCreated++;

            console.log('[PDF Import] Created ProductTag:', {
              tagId: tag.id,
              projectId,
              imageId: projectImageId,
              productId,
              position: { x: pendingTag.x * 100, y: pendingTag.y * 100 },
            });

            // Record Atelier signals (same as manual tagging for ML training)
            if (designerId) {
              try {
                // Get product details for signal recording
                const productDetails = await prisma.product.findUnique({
                  where: { id: productId },
                  select: { category: true, vendorId: true },
                });

                // Main signal: product tagged
                await recordAtelierSignal({
                  ownerType: AtelierOwnerType.DESIGNER,
                  designerId,
                  sourceType: AtelierSignalSourceType.PRODUCT_TAG,
                  sourceId: tag.id,
                  key: 'product_tagged',
                  value: productId,
                  weight: 1.0,
                });

                // Signal: product category preference
                if (productDetails?.category) {
                  await recordAtelierSignal({
                    ownerType: AtelierOwnerType.DESIGNER,
                    designerId,
                    sourceType: AtelierSignalSourceType.PRODUCT_TAG,
                    sourceId: tag.id,
                    key: `category:${productDetails.category}`,
                    value: productId,
                    weight: 1.0,
                  });
                }

                // Signal: vendor preference
                if (productDetails?.vendorId) {
                  await recordAtelierSignal({
                    ownerType: AtelierOwnerType.DESIGNER,
                    designerId,
                    sourceType: AtelierSignalSourceType.PRODUCT_TAG,
                    sourceId: tag.id,
                    key: `vendor:${productDetails.vendorId}`,
                    value: productId,
                    weight: 1.0,
                  });
                }

                // Signal: source indicator (distinguishes from manual tagging)
                await recordAtelierSignal({
                  ownerType: AtelierOwnerType.DESIGNER,
                  designerId,
                  sourceType: AtelierSignalSourceType.PRODUCT_TAG,
                  sourceId: tag.id,
                  key: 'source:pdf_import',
                  value: productId,
                  weight: 1.0,
                });

                console.log('[Atelier] Signals recorded for PDF import product tag:', {
                  tagId: tag.id,
                  designerId,
                });
              } catch (signalError) {
                // Log but don't fail the tag creation
                console.error('[Atelier] Failed to record signals for PDF import:', signalError);
              }
            }
          } catch (productTagError) {
            // Log error but don't fail Selection creation - existing flow continues
            console.error(`[PDF Import] Failed to create ProductTag for pending tag ${pendingTag.id}:`, productTagError);
          }
        } else {
          console.warn(`[PDF Import] Could not match image URL for ProductTag: ${pendingTag.tempImageUrl}`);
        }
      }

      // Update pending tag status
      await prisma.pendingProductTag.update({
        where: { id: pendingTag.id },
        data: {
          status: 'CONFIRMED',
          reviewedAt: new Date(),
          // Link to created ProductTag if successful
          ...(createdProductTagId ? { resultingTagId: createdProductTagId } : {}),
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
      productTagsCreated,
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

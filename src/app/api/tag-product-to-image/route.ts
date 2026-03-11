export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { recordAtelierSignal } from '@/lib/atelier/signals';
import { AtelierOwnerType, AtelierSignalSourceType } from '@prisma/client';
import { syncSingleTestimonial } from '@/lib/syncTestimonials';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      x,
      y,
      productId,
      projectId,
      imageId,
      // Optional decision capture fields
      decisionReasoning,
      alternativesConsidered,
      tradeoffs,
      convictionLevel,
      // Shop product fields
      addToShop,
      shopQuote,
      // Backfill option: create a Selection on the design board if none matches
      createSelection,
    } = await request.json();

    // Validate required fields
    if (x == null || y == null || !productId || !imageId) {
      return NextResponse.json(
        { error: 'Missing required fields: x, y, productId, imageId' },
        { status: 400 }
      );
    }

    // Check project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch (e: any) {
      return NextResponse.json(
        { error: 'Project not found or not permitted' },
        { status: 403 }
      );
    }

    // Fetch project for designerId
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        designerId: true,
        ownerId: true
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Verify image belongs to project
    const image = await prisma.projectImage.findFirst({
      where: {
        id: imageId,
        projectId: projectId
      },
      select: { id: true, room: true },
    });

    if (!image) {
      return NextResponse.json(
        { error: 'Image not found or does not belong to project' },
        { status: 404 }
      );
    }

    // Get product details for signal recording
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        vendorId: true,
        category: true,
        url: true,
        brand: true,
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Determine designerId (prefer project designerId, fallback to ownerId if user is owner)
    const designerId = project.designerId || 
                      (project.ownerId === session.user.id ? session.user.id : null);

    // Create product tag in database
    const tag = await prisma.productTag.create({
      data: {
        x: parseFloat(String(x)),
        y: parseFloat(String(y)),
        productId,
        imageId,
      },
      include: {
        product: true,
      }
    });

    console.log('[ProductTag] Created:', { tagId: tag.id, projectId, imageId, productId });

    // Backfill: link an existing Selection to this tag (or create one)
    let linkedSelectionId: string | null = null;
    try {
      if (image.room) {
        const room = await prisma.room.findFirst({
          where: {
            projectId,
            name: { equals: image.room, mode: 'insensitive' },
          },
        });

        if (room) {
          // Find an unlinked selection that matches this product
          const orConditions: any[] = [];
          if (product.url) {
            orConditions.push({ cachedProductLinks: { some: { cachedProduct: { url: product.url } } } });
          }
          if (product.name) {
            orConditions.push({ productName: { contains: product.name, mode: 'insensitive' } });
          }

          const matchingSelection = orConditions.length > 0
            ? await prisma.selection.findFirst({
                where: {
                  roomId: room.id,
                  productTagId: null,
                  OR: orConditions,
                },
              })
            : null;

          if (matchingSelection) {
            await prisma.selection.update({
              where: { id: matchingSelection.id },
              data: { productTagId: tag.id },
            });
            linkedSelectionId = matchingSelection.id;
            console.log('[ProductTag] Backfill linked selection:', { selectionId: matchingSelection.id, tagId: tag.id });
          } else if (createSelection) {
            // Optionally create a new Selection for this product
            const newSel = await prisma.selection.create({
              data: {
                projectId,
                roomId: room.id,
                productName: product.name,
                vendorName: product.brand ?? null,
                productTagId: tag.id,
                source: 'auto_tag',
              },
            });
            linkedSelectionId = newSel.id;
            console.log('[ProductTag] Backfill created selection:', { selectionId: newSel.id, tagId: tag.id });
          }
        }
      }
    } catch (backfillError) {
      // Log but don't fail the tag creation
      console.error('[ProductTag] Backfill error:', backfillError);
    }

    // Create ShopProduct if requested
    let shopProduct = null;
    if (addToShop && designerId) {
      try {
        // Check if ShopProduct already exists for this designer-product combo
        const existingShopProduct = await prisma.shopProduct.findUnique({
          where: {
            designerId_productId: {
              designerId,
              productId,
            },
          },
        });

        if (!existingShopProduct) {
          shopProduct = await prisma.shopProduct.create({
            data: {
              designerId,
              productId,
              projectId, // Link to source project
              quote: shopQuote || null,
              quoteApprovedAt: shopQuote ? new Date() : null,
              isActive: true,
              isFeatured: false,
            },
          });
          console.log('[ShopProduct] Created:', { shopProductId: shopProduct.id, designerId, productId });
        } else {
          // Update existing ShopProduct if quote provided
          if (shopQuote && !existingShopProduct.quote) {
            shopProduct = await prisma.shopProduct.update({
              where: { id: existingShopProduct.id },
              data: {
                quote: shopQuote,
                quoteApprovedAt: new Date(),
              },
            });
            console.log('[ShopProduct] Updated with quote:', { shopProductId: shopProduct.id });
          } else {
            shopProduct = existingShopProduct;
          }
        }

        // Sync testimonial if shop product has a quote
        if (shopProduct && shopProduct.quote) {
          try {
            await syncSingleTestimonial(shopProduct.id);
          } catch (syncError) {
            console.error('[ProductTestimonial] Failed to sync testimonial:', syncError);
          }
        }
      } catch (shopError) {
        // Log but don't fail tag creation
        console.error('[ShopProduct] Failed to create/update shop product:', shopError);
      }
    }

    // Record Atelier signals (non-blocking)
    if (designerId) {
      try {
        // Main signal: product tagged
        await recordAtelierSignal({
          ownerType: AtelierOwnerType.DESIGNER,
          designerId,
          sourceType: AtelierSignalSourceType.TAG,
          sourceId: tag.id,
          key: 'product_tagged',
          value: productId,
          weight: 1.0,
        });

        // Signal: product category preference
        if (product.category) {
          await recordAtelierSignal({
            ownerType: AtelierOwnerType.DESIGNER,
            designerId,
            sourceType: AtelierSignalSourceType.TAG,
            sourceId: tag.id,
            key: `category:${product.category}`,
            value: productId,
            weight: 1.0,
          });
        }

        // Signal: vendor preference
        if (product.vendorId) {
          await recordAtelierSignal({
            ownerType: AtelierOwnerType.DESIGNER,
            designerId,
            sourceType: AtelierSignalSourceType.TAG,
            sourceId: tag.id,
            key: `vendor:${product.vendorId}`,
            value: productId,
            weight: 1.0,
          });
        }

        // Optional decision capture signals
        if (decisionReasoning) {
          await recordAtelierSignal({
            ownerType: AtelierOwnerType.DESIGNER,
            designerId,
            sourceType: AtelierSignalSourceType.TAG,
            sourceId: tag.id,
            key: 'decision_reasoning',
            value: decisionReasoning,
            weight: 1.5, // Higher weight for explicit reasoning
          });
        }

        if (alternativesConsidered && Array.isArray(alternativesConsidered) && alternativesConsidered.length > 0) {
          await recordAtelierSignal({
            ownerType: AtelierOwnerType.DESIGNER,
            designerId,
            sourceType: AtelierSignalSourceType.TAG,
            sourceId: tag.id,
            key: 'alternatives_considered',
            value: JSON.stringify(alternativesConsidered),
            weight: 1.2,
          });
        }

        if (tradeoffs) {
          await recordAtelierSignal({
            ownerType: AtelierOwnerType.DESIGNER,
            designerId,
            sourceType: AtelierSignalSourceType.TAG,
            sourceId: tag.id,
            key: 'tradeoffs',
            value: tradeoffs,
            weight: 1.3,
          });
        }

        if (convictionLevel) {
          await recordAtelierSignal({
            ownerType: AtelierOwnerType.DESIGNER,
            designerId,
            sourceType: AtelierSignalSourceType.TAG,
            sourceId: tag.id,
            key: 'conviction_level',
            value: String(convictionLevel),
            weight: 1.0,
          });
        }

        console.log('[Atelier] Signals recorded for product tag:', { tagId: tag.id, designerId });
      } catch (signalError) {
        // Log but don't fail the tag creation
        console.error('[Atelier] Failed to record signals for product tag:', signalError);
      }
    } else {
      console.warn('[Atelier] No designerId found for project, skipping signal recording');
    }

    return NextResponse.json({
      success: true,
      id: tag.id,
      tag,
      shopProduct: shopProduct ? { id: shopProduct.id, hasQuote: !!shopProduct.quote } : null,
      linkedSelectionId,
    });

  } catch (error) {
    console.error('Failed to create product tag:', error);
    return NextResponse.json(
      { error: 'Failed to create product tag' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const imageId = searchParams.get('imageId');

    const whereClause: any = {};

    // Build query based on filters
    if (imageId) {
      whereClause.imageId = imageId;
    } else if (projectId) {
      whereClause.image = {
        projectId: projectId
      };
    }

    // Fetch tags from database
    const tags = await prisma.productTag.findMany({
      where: whereClause,
      include: {
        product: true,
        image: {
          select: {
            url: true,
            projectId: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(tags);

  } catch (error) {
    console.error('Failed to fetch product tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product tags' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('id');

    if (!tagId) {
      return NextResponse.json(
        { error: 'Tag ID required' },
        { status: 400 }
      );
    }

    // Verify tag belongs to user's project
    const tag = await prisma.productTag.findUnique({
      where: { id: tagId },
      include: {
        image: {
          select: { projectId: true }
        }
      }
    });

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Check project write access via the tag's project
    try {
      await assertProjectWrite(session.user.id, tag.image.projectId);
    } catch {
      return NextResponse.json(
        { error: 'Not authorized to delete this tag' },
        { status: 403 }
      );
    }

    // Delete the tag
    await prisma.productTag.delete({
      where: { id: tagId }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to delete product tag:', error);
    return NextResponse.json(
      { error: 'Failed to delete product tag' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, x, y } = await request.json();

    if (!id || x == null || y == null) {
      return NextResponse.json(
        { error: 'Missing required fields: id, x, y' },
        { status: 400 }
      );
    }

    // Verify tag exists and get project for authz
    const tag = await prisma.productTag.findUnique({
      where: { id },
      include: {
        image: { select: { projectId: true } }
      }
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    try {
      await assertProjectWrite(session.user.id, tag.image.projectId);
    } catch {
      return NextResponse.json(
        { error: 'Not authorized to update this tag' },
        { status: 403 }
      );
    }

    const updated = await prisma.productTag.update({
      where: { id },
      data: { x, y },
    });

    return NextResponse.json(updated);

  } catch (error) {
    console.error('Failed to update product tag:', error);
    return NextResponse.json(
      { error: 'Failed to update product tag' },
      { status: 500 }
    );
  }
}
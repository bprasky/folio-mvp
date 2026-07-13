export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { recordAtelierSignal } from '@/lib/atelier/signals';
import { AtelierOwnerType, AtelierSignalSourceType } from '@prisma/client';
import { syncSingleTestimonial } from '@/lib/syncTestimonials';
import { getServerProductCompleteness } from '@/lib/products/getProductById';
import { createInContextBoostOpportunity } from '@/lib/boost/inContextBoost';

/**
 * Fire-and-forget: notify a vendor rep that a designer tagged their product
 * with incomplete specs and needs help.
 */
async function notifyVendorRepOfIncompleteTag(params: {
  vendorEmail: string;
  repName?: string | null;
  vendorName: string;
  designerName: string;
  productName: string;
  productId: string;
  missingFields: string[];
}) {
  const { vendorName, designerName, productName, productId, missingFields } = params;

  const missingLabels = missingFields.map((f) => {
    if (f === 'image') return 'a product image';
    if (f === 'vendor') return 'brand/vendor info';
    if (f === 'url') return 'a product page URL';
    return f;
  });

  // Find vendor user to create notification (if they have an account)
  const vendorUser = await prisma.user.findFirst({
    where: { email: params.vendorEmail },
    select: { id: true },
  });

  if (vendorUser) {
    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId: vendorUser.id,
        type: 'REP_HELP_NEEDED',
        title: `${designerName} needs help with product specs`,
        body: `"${productName}" is missing ${missingLabels.join(', ')}. Complete the specs so designers can properly feature your product.`,
        actionUrl: `/vendor/products`,
        metadata: {
          productId,
          productName,
          designerName,
          missingFields,
        },
      },
    });
  }

  // Also log as VendorInviteSignal for tracking
  await prisma.vendorInviteSignal.create({
    data: {
      vendorName,
      signalType: 'REP_SPEC_HELP_REQUESTED',
      metadata: {
        productId,
        productName,
        designerName,
        vendorEmail: params.vendorEmail,
        repName: params.repName,
        missingFields,
      },
    },
  });

  console.log('[tag-product] Notified vendor rep of incomplete specs', {
    vendorName,
    productName,
    designerName,
  });
}

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

    // Get product details for signal recording + completeness check
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        vendorId: true,
        category: true,
        url: true,
        brand: true,
        imageUrl: true,
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

    // A tagged photo cannot be "no products" — clearing keeps the derived
    // review gate honest if this tag is later dismissed (spec 20 §3d).
    await prisma.projectImage.update({
      where: { id: imageId },
      data: { noProducts: false },
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

    // Track Save→Tag conversion (Flywheel 3)
    // If this designer previously saved this product, mark the conversion
    if (designerId) {
      try {
        const priorSave = await prisma.save.findUnique({
          where: { userId_productId: { userId: designerId, productId } },
          select: { id: true, converted: true },
        });
        if (priorSave && !priorSave.converted) {
          await prisma.save.update({
            where: { id: priorSave.id },
            data: { converted: true, convertedAt: new Date() },
          });
          // Record high-value conversion signal
          await recordAtelierSignal({
            ownerType: AtelierOwnerType.DESIGNER,
            designerId,
            sourceType: AtelierSignalSourceType.TAG,
            sourceId: tag.id,
            key: 'save_to_tag_conversion',
            value: productId,
            weight: 2.0, // High-value signal
          });
          console.log('[Conversion] Save→Tag:', { designerId, productId, saveId: priorSave.id });
        }
      } catch (conversionError) {
        console.error('[Conversion] Save→Tag tracking error:', conversionError);
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

    // Create In Context Boost opportunity (non-blocking)
    // This kicks off the vendor boost flywheel:
    // vendor review → boost approval → designer Q&A → In Context placement
    let inContextBoost: any = null;
    if (designerId) {
      try {
        inContextBoost = await createInContextBoostOpportunity({
          productTagId: tag.id,
          productId,
          designerId,
          projectId,
          // Rep email from existing contacts is looked up inside the function
        });
      } catch (boostError) {
        console.error('[InContextBoost] Failed to create boost opportunity:', boostError);
      }
    }

    // Check product completeness and suggest rep action if incomplete
    let incompleteProduct: any = null;
    const completeness = getServerProductCompleteness(product);
    if (completeness !== 'full') {
      const missingFields: string[] = [];
      if (!product.imageUrl) missingFields.push('image');
      if (!product.brand && !product.vendorId) missingFields.push('vendor');
      if (!product.url) missingFields.push('url');

      // Look up designer's rep contact for this vendor
      let repContact: any = null;
      if (product.brand && designerId) {
        repContact = await prisma.vendorRepContact.findFirst({
          where: {
            userId: designerId,
            vendorName: { equals: product.brand, mode: 'insensitive' },
            isActive: true,
          },
          select: {
            id: true,
            repName: true,
            repEmail: true,
            vendorName: true,
          },
        }).catch(() => null);
      }

      // If vendor has an email (via rep or vendor account), fire-and-forget notify them
      const vendorEmail = repContact?.repEmail || (product.vendorId ? (await prisma.user.findUnique({
        where: { id: product.vendorId },
        select: { email: true },
      }).catch(() => null))?.email : null);

      if (vendorEmail && designerId) {
        // Fire-and-forget: notify vendor that designer needs help completing specs
        notifyVendorRepOfIncompleteTag({
          vendorEmail,
          repName: repContact?.repName,
          vendorName: product.brand || repContact?.vendorName || 'Vendor',
          designerName: session.user.name || 'A designer',
          productName: product.name,
          productId: product.id,
          missingFields,
        }).catch(() => {});
      }

      incompleteProduct = {
        completeness,
        missingFields,
        repContact: repContact ? {
          id: repContact.id,
          repName: repContact.repName,
          hasEmail: !!repContact.repEmail,
          vendorName: repContact.vendorName,
        } : null,
        suggestTagRep: !repContact && !!product.brand,
        vendorName: product.brand || null,
      };
    }

    return NextResponse.json({
      success: true,
      id: tag.id,
      tag,
      shopProduct: shopProduct ? { id: shopProduct.id, hasQuote: !!shopProduct.quote } : null,
      linkedSelectionId,
      incompleteProduct,
      inContextBoost,
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

    const { id, x, y, reviewed, imageId: targetImageId } = await request.json();

    // Three modes: reposition (x, y), mark-reviewed (reviewed: true), or move to
    // another photo (imageId). The reviewed flag confirms a deferred-scrape tag.
    const isReviewMode = reviewed === true;
    const isMoveMode = typeof targetImageId === 'string' && !!targetImageId;
    if (!id || (!isReviewMode && !isMoveMode && (x == null || y == null))) {
      return NextResponse.json(
        { error: 'Missing required fields: id and either (x, y), imageId, or reviewed' },
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

    let data: { reviewedAt: Date } | { x: number; y: number } | { imageId: string; x: number; y: number };
    if (isReviewMode) {
      data = { reviewedAt: new Date() };
    } else if (isMoveMode) {
      // Move the tag to another photo in the SAME project. Keep x/y if given
      // (else center) so the designer can drag it into place on the new photo.
      const target = await prisma.projectImage.findFirst({
        where: { id: targetImageId, projectId: tag.image.projectId },
        select: { id: true },
      });
      if (!target) {
        return NextResponse.json(
          { error: 'Target photo not found in this project' },
          { status: 404 }
        );
      }
      data = { imageId: targetImageId, x: x ?? 50, y: y ?? 50 };
    } else {
      data = { x, y };
    }

    const updated = await prisma.productTag.update({ where: { id }, data });

    return NextResponse.json(updated);

  } catch (error) {
    console.error('Failed to update product tag:', error);
    return NextResponse.json(
      { error: 'Failed to update product tag' },
      { status: 500 }
    );
  }
}
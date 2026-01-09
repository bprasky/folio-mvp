export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { recordAtelierSignal } from '@/lib/atelier/signals';
import { AtelierOwnerType, AtelierSignalSourceType } from '@prisma/client';

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
      convictionLevel
    } = await request.json();

    // Validate required fields
    if (x == null || y == null || !productId || !imageId) {
      return NextResponse.json(
        { error: 'Missing required fields: x, y, productId, imageId' },
        { status: 400 }
      );
    }

    // Verify project ownership and get designerId
    const project = await prisma.project.findFirst({
      where: { 
        id: projectId,
        OR: [
          { ownerId: session.user.id },
          { designerId: session.user.id }
        ]
      },
      select: { 
        id: true,
        designerId: true,
        ownerId: true
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or not permitted' },
        { status: 403 }
      );
    }

    // Verify image belongs to project
    const image = await prisma.projectImage.findFirst({
      where: { 
        id: imageId,
        projectId: projectId 
      },
      select: { id: true },
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

    // Record Atelier signals (non-blocking)
    if (designerId) {
      try {
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
        if (product.category) {
          await recordAtelierSignal({
            ownerType: AtelierOwnerType.DESIGNER,
            designerId,
            sourceType: AtelierSignalSourceType.PRODUCT_TAG,
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
            sourceType: AtelierSignalSourceType.PRODUCT_TAG,
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
            sourceType: AtelierSignalSourceType.PRODUCT_TAG,
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
            sourceType: AtelierSignalSourceType.PRODUCT_TAG,
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
            sourceType: AtelierSignalSourceType.PRODUCT_TAG,
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
            sourceType: AtelierSignalSourceType.PRODUCT_TAG,
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
      tag 
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
          include: {
            project: {
              select: { ownerId: true, designerId: true }
            }
          }
        }
      }
    });

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    const isOwner = tag.image.project.ownerId === session.user.id ||
                    tag.image.project.designerId === session.user.id;

    if (!isOwner) {
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
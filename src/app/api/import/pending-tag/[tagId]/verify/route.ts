import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

interface ProductAttribution {
  productUrl: string;
  vendorName: string;
  productName: string;
  price?: string;
}

/**
 * POST /api/import/pending-tag/[tagId]/verify
 * Verify a single pending product tag
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tagId } = await params;
    const body = await req.json();
    const { action, productId, correctionNote } = body;

    // Validate action
    if (!['confirm', 'correct', 'dismiss'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use confirm, correct, or dismiss' },
        { status: 400 }
      );
    }

    // Get the pending tag and verify ownership
    const pendingTag = await prisma.pendingProductTag.findUnique({
      where: { id: tagId },
      include: {
        importSession: true,
      },
    });

    if (!pendingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    if (pendingTag.importSession.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (pendingTag.status !== 'UNREVIEWED') {
      return NextResponse.json(
        { error: 'Tag has already been reviewed' },
        { status: 400 }
      );
    }

    // Handle dismiss
    if (action === 'dismiss') {
      await prisma.pendingProductTag.update({
        where: { id: tagId },
        data: {
          status: 'DISMISSED',
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({ status: 'dismissed' });
    }

    // For confirm/correct, we need a product
    let product;

    if (action === 'confirm') {
      const topSuggestion = pendingTag.topSuggestion as ProductAttribution | null;

      if (!topSuggestion) {
        return NextResponse.json(
          { error: 'No suggestion to confirm. Use correct action with a productId instead.' },
          { status: 400 }
        );
      }

      // Get or create product from suggestion
      product = await prisma.product.findFirst({
        where: {
          OR: [
            { url: topSuggestion.productUrl },
            {
              name: topSuggestion.productName,
              brand: topSuggestion.vendorName,
            },
          ],
        },
      });

      if (!product) {
        product = await prisma.product.create({
          data: {
            name: topSuggestion.productName,
            brand: topSuggestion.vendorName,
            url: topSuggestion.productUrl,
            category: pendingTag.category,
            isPending: true, // Needs vendor claim
          },
        });
      }
    } else if (action === 'correct') {
      if (!productId) {
        return NextResponse.json(
          { error: 'productId is required for correct action' },
          { status: 400 }
        );
      }

      product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
    }

    if (!product) {
      return NextResponse.json({ error: 'No product available' }, { status: 400 });
    }

    // Create ProductTag if we have a project image
    let productTag;
    if (pendingTag.projectImageId) {
      productTag = await prisma.productTag.create({
        data: {
          imageId: pendingTag.projectImageId,
          productId: product.id,
          x: pendingTag.x,
          y: pendingTag.y,
        },
      });
    }

    // Update pending tag
    await prisma.pendingProductTag.update({
      where: { id: tagId },
      data: {
        status: action === 'confirm' ? 'CONFIRMED' : 'CORRECTED',
        confirmedProductId: product.id,
        correctionNote: correctionNote || null,
        resultingTagId: productTag?.id,
        reviewedAt: new Date(),
      },
    });

    // Update session metrics
    await prisma.importSession.update({
      where: { id: pendingTag.importSessionId },
      data: {
        verifiedTags: { increment: 1 },
      },
    });

    return NextResponse.json({
      status: 'verified',
      action,
      productId: product.id,
      productTagId: productTag?.id,
    });
  } catch (error) {
    console.error('Error verifying tag:', error);
    return NextResponse.json(
      { error: 'Failed to verify tag' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/import/pending-tag/[tagId]/verify
 * Get tag details for verification
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tagId } = await params;

    const pendingTag = await prisma.pendingProductTag.findUnique({
      where: { id: tagId },
      include: {
        importSession: true,
      },
    });

    if (!pendingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    if (pendingTag.importSession.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(pendingTag);
  } catch (error) {
    console.error('Error fetching tag:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tag' },
      { status: 500 }
    );
  }
}

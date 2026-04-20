// @idor-allow: public-read reason="Public shop product detail modal, viewable anonymously"
// @idor-allow: IDOR003 reason="Public lookup by shop product id for detail modal"
// @idor-allow: IDOR004 reason="Read-only public shop product; no mutations in this route"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/shop/products/[shopProductId]
 * Fetch detailed shop product data for the modal view
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { shopProductId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const shopProductId = resolvedParams.shopProductId;

    // Fetch shop product with relations
    const shopProduct = await prisma.shopProduct.findUnique({
      where: { id: shopProductId },
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            brand: true,
            vendorId: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!shopProduct) {
      return NextResponse.json(
        { error: 'Shop product not found' },
        { status: 404 }
      );
    }

    // Find all projects where this product is tagged by this designer
    const productTags = await prisma.productTag.findMany({
      where: {
        productId: shopProduct.productId,
        image: {
          project: {
            designerId: shopProduct.designerId,
            isPublic: true,
          },
        },
      },
      include: {
        image: {
          select: {
            id: true,
            url: true,
            project: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      take: 8, // Limit context images
    });

    // Extract unique context images
    const contextImages = productTags.map((tag) => ({
      id: tag.image.id,
      url: tag.image.url,
      projectTitle: tag.image.project.title || 'Untitled Project',
      projectId: tag.image.project.id,
    }));

    // Get unique featured projects
    const projectMap = new Map<string, { id: string; title: string }>();
    for (const tag of productTags) {
      if (!projectMap.has(tag.image.project.id)) {
        projectMap.set(tag.image.project.id, {
          id: tag.image.project.id,
          title: tag.image.project.title || 'Untitled Project',
        });
      }
    }
    const featuredProjects = Array.from(projectMap.values());

    return NextResponse.json({
      id: shopProduct.id,
      productId: shopProduct.productId,
      quote: shopProduct.quote,
      designer: shopProduct.designer,
      product: shopProduct.product,
      contextImages,
      featuredProjects,
    });
  } catch (error) {
    console.error('[shop/products/[id]] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shop product' },
      { status: 500 }
    );
  }
}

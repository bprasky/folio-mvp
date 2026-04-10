export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/products/[productId]/testimonials
 * Fetch designer testimonials for a product from the ProductTestimonial model
 *
 * Query params:
 * - limit: number (default 10, max 50)
 * - featuredOnly: boolean (default false)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const productId = resolvedParams.productId;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const featuredOnly = searchParams.get('featuredOnly') === 'true';

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Fetch testimonials with designer info
    const testimonials = await prisma.productTestimonial.findMany({
      where: {
        productId,
        ...(featuredOnly && { isFeatured: true }),
      },
      include: {
        shopProduct: {
          include: {
            designer: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                companyName: true,
              },
            },
            project: {
              select: {
                id: true,
                title: true,
                post: {
                  select: {
                    slug: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { isFeatured: 'desc' }, // Featured first
        { createdAt: 'desc' },  // Then by recency
      ],
      take: limit,
    });

    // Format response
    const formattedTestimonials = testimonials.map((t) => ({
      id: t.id,
      quote: t.quote,
      isFeatured: t.isFeatured,
      createdAt: t.createdAt,
      designer: {
        id: t.shopProduct.designer.id,
        name: t.shopProduct.designer.name,
        profileImage: t.shopProduct.designer.profileImage,
        companyName: t.shopProduct.designer.companyName,
      },
      project: t.shopProduct.project
        ? {
            id: t.shopProduct.project.id,
            title: t.shopProduct.project.title,
            articleSlug: t.shopProduct.project.post?.status === 'PUBLISHED'
              ? t.shopProduct.project.post.slug
              : null,
          }
        : null,
    }));

    return NextResponse.json({
      testimonials: formattedTestimonials,
      count: testimonials.length,
    });
  } catch (error) {
    console.error('[products/[productId]/testimonials] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch testimonials' },
      { status: 500 }
    );
  }
}

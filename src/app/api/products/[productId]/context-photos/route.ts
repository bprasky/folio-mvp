export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/products/[productId]/context-photos
 * Returns project photos where this product has been tagged.
 * Only returns photos from published/public projects.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const productId = resolvedParams.productId;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Fetch tags with project image, project data, and published post slug
    const tags = await prisma.productTag.findMany({
      where: {
        productId,
        image: {
          project: {
            isPublic: true,
          },
        },
      },
      select: {
        id: true,
        image: {
          select: {
            id: true,
            url: true,
            room: true,
            project: {
              select: {
                id: true,
                title: true,
                designer: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
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
      take: 12,
    });

    // Filter out tags with missing image/project data and format
    const photos = tags
      .filter(tag => tag.image?.url && tag.image?.project)
      .map(tag => {
        const post = tag.image!.project!.post;
        const hasPublishedPost = post?.status === 'PUBLISHED' && post?.slug;
        return {
          imageUrl: tag.image!.url!,
          room: tag.image!.room,
          projectId: tag.image!.project!.id,
          projectTitle: tag.image!.project!.title || 'Untitled Project',
          designerName: tag.image!.project!.designer?.name || 'Designer',
          // Public article slug — only if the post is published
          articleSlug: hasPublishedPost ? post!.slug : null,
        };
      });

    return NextResponse.json({ photos });
  } catch (error) {
    console.error('[products/[productId]/context-photos] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch context photos' },
      { status: 500 }
    );
  }
}

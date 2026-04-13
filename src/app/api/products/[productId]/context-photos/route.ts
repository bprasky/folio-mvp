// @idor-allow: public-read reason="Public in-context project photos for a product, viewable anonymously"
// @idor-allow: IDOR003 reason="Public lookup by product id for product detail page"
// @idor-allow: IDOR004 reason="Read-only public product photos; no mutations in this route"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/products/[productId]/context-photos
 * Returns project photos where this product has been tagged AND the vendor
 * has approved the boost. No boost = no In Context appearance.
 *
 * This is the gate: vendors must boost to earn placement on the product page.
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

    // Only return tags that have an APPROVED InContextBoost
    // This is the core gate: no boost = no In Context appearance
    const boosts = await prisma.inContextBoost.findMany({
      where: {
        productId,
        status: 'APPROVED',
        // Not expired
        OR: [
          { displayUntil: null },
          { displayUntil: { gt: new Date() } },
        ],
      },
      select: {
        id: true,
        followUpQuestion: true,
        followUpAnswer: true,
        followUpAnsweredAt: true,
        designerId: true,
        impressions: true,
        productTag: {
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
                        profileImage: true,
                      },
                    },
                    post: {
                      select: {
                        slug: true,
                        status: true,
                        expandedBlocks: true,
                        excerpt: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    // Format response with article context for modal
    const photos = boosts
      .filter(b => b.productTag?.image?.url && b.productTag?.image?.project)
      .map(b => {
        const tag = b.productTag!;
        const project = tag.image!.project!;
        const post = project.post;
        const hasPublishedPost = post?.status === 'PUBLISHED' && post?.slug;

        // Extract article excerpt from expandedBlocks if available
        let articleExcerpt: string | null = null;
        if (post?.expandedBlocks && typeof post.expandedBlocks === 'object') {
          const blocks = post.expandedBlocks as any;
          // Try to get the lead deck or first chapter body
          if (blocks.lead?.deck) {
            articleExcerpt = blocks.lead.deck;
          } else if (blocks.galleryChapters?.[0]?.body?.[0]) {
            articleExcerpt = blocks.galleryChapters[0].body[0];
          }
        }
        if (!articleExcerpt && post?.excerpt) {
          articleExcerpt = post.excerpt;
        }

        return {
          boostId: b.id,
          imageUrl: tag.image!.url!,
          imageId: tag.image!.id,
          room: tag.image!.room,
          projectId: project.id,
          projectTitle: project.title || 'Untitled Project',
          designerName: project.designer?.name || 'Designer',
          designerImage: project.designer?.profileImage || null,
          articleSlug: hasPublishedPost ? post!.slug : null,
          articleExcerpt,
          // Follow-up Q&A (if designer has answered)
          followUpQuestion: b.followUpQuestion,
          followUpAnswer: b.followUpAnsweredAt ? b.followUpAnswer : null,
        };
      });

    // Track impressions (fire-and-forget)
    if (photos.length > 0) {
      const boostIds = photos.map(p => p.boostId);
      prisma.inContextBoost.updateMany({
        where: { id: { in: boostIds } },
        data: { impressions: { increment: 1 } },
      }).catch(() => {});
    }

    return NextResponse.json({ photos });
  } catch (error) {
    console.error('[products/[productId]/context-photos] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch context photos' },
      { status: 500 }
    );
  }
}

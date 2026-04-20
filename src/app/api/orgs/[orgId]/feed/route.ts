export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/orgs/[orgId]/feed?type=all|projects|articles|products|media&page=1&limit=12
 *
 * Unified vendor feed aggregating:
 * - Boosted project mosaics (InContextBoost → product + project image)
 * - Collaboration articles (ProjectPost where vendor is collaborator)
 * - Vendor-authored articles (VendorPost)
 * - Product launches (newest products)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const orgId = resolvedParams.orgId;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 24);
    const skip = (page - 1) * limit;

    // Verify org exists and is a vendor type
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, type: true, name: true },
    });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get vendor user IDs for product lookup
    const orgUsers = await prisma.organizationUser.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { userId: true },
    });
    const vendorUserIds = orgUsers.map(u => u.userId);

    const feedItems: any[] = [];

    // 1. Boosted project mosaics
    if (type === 'all' || type === 'projects') {
      const boosts = await prisma.inContextBoost.findMany({
        where: {
          vendorId: orgId,
          status: 'APPROVED',
        },
        select: {
          id: true,
          createdAt: true,
          impressions: true,
          clicks: true,
          followUpAnswer: true,
          product: {
            select: { id: true, name: true, imageUrl: true, brand: true },
          },
          productTag: {
            select: {
              image: {
                select: {
                  url: true,
                  room: true,
                  project: {
                    select: {
                      id: true,
                      title: true,
                      designer: { select: { id: true, name: true, profileImage: true } },
                      post: { select: { slug: true, status: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: type === 'projects' ? limit : 6,
        skip: type === 'projects' ? skip : 0,
      });

      for (const b of boosts) {
        const project = b.productTag?.image?.project;
        const post = project?.post;
        feedItems.push({
          type: 'boosted_project',
          id: b.id,
          date: b.createdAt,
          productName: b.product.name,
          productImage: b.product.imageUrl,
          projectImage: b.productTag?.image?.url,
          room: b.productTag?.image?.room,
          projectTitle: project?.title,
          designerName: project?.designer?.name,
          designerImage: project?.designer?.profileImage,
          articleSlug: post?.status === 'PUBLISHED' ? post.slug : null,
          impressions: b.impressions,
          hasQA: !!b.followUpAnswer,
        });
      }
    }

    // 2. Collaboration articles
    if (type === 'all' || type === 'articles') {
      const collabPosts = await prisma.projectPost.findMany({
        where: {
          status: 'PUBLISHED',
          project: { vendorOrgId: orgId },
        },
        select: {
          id: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
          project: {
            select: {
              title: true,
              designer: { select: { name: true, profileImage: true } },
              images: { select: { url: true }, take: 1, orderBy: { displayOrder: 'asc' } },
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
        take: type === 'articles' ? limit : 4,
        skip: type === 'articles' ? skip : 0,
      });

      for (const p of collabPosts) {
        feedItems.push({
          type: 'collaboration_article',
          id: p.id,
          date: p.publishedAt || p.project.title,
          title: p.project.title,
          excerpt: p.excerpt,
          heroImage: p.project.images[0]?.url,
          designerName: p.project.designer?.name,
          designerImage: p.project.designer?.profileImage,
          articleSlug: p.slug,
        });
      }
    }

    // 3. Vendor-authored articles
    if (type === 'all' || type === 'articles') {
      try {
        const vendorPosts = await prisma.vendorPost.findMany({
          where: {
            organizationId: orgId,
            status: 'PUBLISHED',
          },
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            heroImageUrl: true,
            contentType: true,
            publishedAt: true,
            views: true,
            author: { select: { name: true, profileImage: true } },
          },
          orderBy: { publishedAt: 'desc' },
          take: type === 'articles' ? limit : 4,
          skip: type === 'articles' ? skip : 0,
        });

        for (const vp of vendorPosts) {
          feedItems.push({
            type: 'vendor_article',
            id: vp.id,
            date: vp.publishedAt,
            title: vp.title,
            excerpt: vp.excerpt,
            heroImage: vp.heroImageUrl,
            contentType: vp.contentType,
            authorName: vp.author.name,
            authorImage: vp.author.profileImage,
            slug: vp.slug,
            views: vp.views,
          });
        }
      } catch {
        // VendorPost table may not exist yet — skip gracefully
      }
    }

    // 4. Product launches (newest products)
    if (type === 'all' || type === 'products') {
      const products = await prisma.product.findMany({
        where: {
          vendorId: { in: vendorUserIds },
          imageUrl: { not: null },
        },
        select: {
          id: true,
          name: true,
          brand: true,
          imageUrl: true,
          category: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: type === 'products' ? limit : 4,
        skip: type === 'products' ? skip : 0,
      });

      for (const prod of products) {
        feedItems.push({
          type: 'product_launch',
          id: prod.id,
          date: prod.createdAt,
          productName: prod.name,
          productImage: prod.imageUrl,
          brand: prod.brand,
          category: prod.category,
        });
      }
    }

    // Sort all items by date descending
    feedItems.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    // Apply limit for 'all' type
    const sliced = type === 'all' ? feedItems.slice(skip, skip + limit) : feedItems;

    return NextResponse.json({
      items: sliced,
      page,
      hasMore: sliced.length === limit,
    });
  } catch (error) {
    console.error('[orgs/[orgId]/feed] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
  }
}

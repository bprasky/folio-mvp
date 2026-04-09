export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';

/**
 * GET /api/vendor/attribution-tree
 *
 * Returns product attribution funnel data for a vendor org.
 * Shows how products flow: Tagged → Saved → Specified → Quoted → Ordered
 * with designer attribution at each stage.
 *
 * Query params:
 *   productId?: string — single product detail view
 *   limit?:     number — max products for overview (default 10)
 *
 * Access: OWNER/ADMIN of a VENDOR/MANUFACTURER/SHOWROOM org
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve vendor org from user's operating context or memberships
    const memberships = await getUserOrgMemberships(session.user.id);
    const vendorMembership = memberships.find(
      (m) =>
        ['VENDOR', 'MANUFACTURER', 'SHOWROOM'].includes(m.org?.type || '') &&
        ['OWNER', 'ADMIN'].includes(m.role)
    );

    if (!vendorMembership) {
      return NextResponse.json({ error: 'Vendor admin access required' }, { status: 403 });
    }

    const orgId = vendorMembership.organizationId;
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

    // Find all products belonging to this vendor org's members
    const orgMembers = await prisma.organizationUser.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { userId: true },
    });
    const memberIds = orgMembers.map((m) => m.userId);

    if (productId) {
      // Single product detail view
      const data = await getProductAttribution(productId, memberIds, orgId);
      return NextResponse.json(data);
    }

    // Org-wide overview: top products by engagement
    const data = await getOrgAttribution(memberIds, orgId, limit);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[attribution-tree] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// --- Single product attribution ---

async function getProductAttribution(
  productId: string,
  vendorMemberIds: string[],
  orgId: string
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, imageUrl: true, category: true, brand: true },
  });

  if (!product) return { error: 'Product not found' };

  // 1. Tags — designers who tagged this product in project images
  const tags = await prisma.productTag.findMany({
    where: { productId },
    select: {
      id: true,
      createdAt: true,
      image: {
        select: {
          project: {
            select: {
              id: true,
              title: true,
              designerId: true,
              designer: { select: { id: true, name: true, profileImage: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // 2. Saves
  const saves = await prisma.save.findMany({
    where: { productId },
    select: {
      id: true,
      userId: true,
      source: true,
      converted: true,
      createdAt: true,
      user: { select: { id: true, name: true, profileImage: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // 3. Likes
  const likes = await prisma.like.findMany({
    where: { productId },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
  });

  // 4. Selections (specifications in project rooms)
  const selections = await prisma.selection.findMany({
    where: {
      OR: [
        { productTag: { productId } },
        { vendorProductId: productId },
      ],
    },
    select: {
      id: true,
      productName: true,
      createdAt: true,
      unitPrice: true,
      project: {
        select: {
          id: true,
          title: true,
          designerId: true,
          designer: { select: { id: true, name: true } },
        },
      },
      room: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // 5. Quotes
  const quotes = await prisma.quote.findMany({
    where: {
      selection: {
        OR: [
          { productTag: { productId } },
          { vendorProductId: productId },
        ],
      },
    },
    select: {
      id: true,
      totalAmount: true,
      createdAt: true,
      project: {
        select: { title: true, designer: { select: { name: true } } },
      },
    },
  });

  // 6. Orders
  const orders = await prisma.order.findMany({
    where: {
      vendorOrgId: orgId,
      items: { some: { productId } },
    },
    select: {
      id: true,
      status: true,
      retailAmountCents: true,
      designerCreditCents: true,
      repCreditCents: true,
      createdAt: true,
      attributedDesigner: { select: { id: true, name: true } },
      attributedRep: { select: { id: true, name: true } },
    },
  });

  // 7. Views from ContextSignal
  const viewCount = await prisma.contextSignal.count({
    where: { productId, action: 'view' },
  });

  // Build timeline
  const timeline: Array<{
    type: string;
    date: Date;
    actor?: string;
    detail?: string;
  }> = [];

  for (const tag of tags) {
    timeline.push({
      type: 'tagged',
      date: tag.createdAt,
      actor: tag.image?.project?.designer?.name || undefined,
      detail: `Tagged in "${tag.image?.project?.title || 'project'}"`,
    });
  }
  for (const save of saves) {
    timeline.push({
      type: 'saved',
      date: save.createdAt,
      actor: save.user?.name || undefined,
      detail: save.source ? `Saved from ${save.source}` : 'Saved',
    });
  }
  for (const sel of selections) {
    timeline.push({
      type: 'specified',
      date: sel.createdAt,
      actor: sel.project?.designer?.name || undefined,
      detail: `Specified in ${sel.room?.name || 'room'}, "${sel.project?.title || 'project'}"`,
    });
  }
  for (const quote of quotes) {
    timeline.push({
      type: 'quoted',
      date: quote.createdAt,
      detail: quote.totalAmount ? `Quote: $${Number(quote.totalAmount).toLocaleString()}` : 'Quote requested',
    });
  }
  for (const order of orders) {
    timeline.push({
      type: 'ordered',
      date: order.createdAt,
      actor: order.attributedDesigner?.name || undefined,
      detail: `Order: $${(order.retailAmountCents / 100).toLocaleString()}`,
    });
  }

  timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Build influencer rankings
  const influencerMap = new Map<string, {
    id: string;
    name: string;
    tags: number;
    saves: number;
    specs: number;
    orders: number;
    creditCents: number;
  }>();

  const addInfluencer = (id: string | undefined, name: string | undefined | null, field: 'tags' | 'saves' | 'specs' | 'orders', creditCents = 0) => {
    if (!id || !name) return;
    const existing = influencerMap.get(id) || { id, name, tags: 0, saves: 0, specs: 0, orders: 0, creditCents: 0 };
    existing[field]++;
    existing.creditCents += creditCents;
    influencerMap.set(id, existing);
  };

  for (const tag of tags) {
    addInfluencer(tag.image?.project?.designer?.id, tag.image?.project?.designer?.name, 'tags');
  }
  for (const save of saves) {
    addInfluencer(save.user?.id, save.user?.name, 'saves');
  }
  for (const sel of selections) {
    addInfluencer(sel.project?.designer?.id, sel.project?.designer?.name, 'specs');
  }
  for (const order of orders) {
    addInfluencer(order.attributedDesigner?.id, order.attributedDesigner?.name, 'orders', order.designerCreditCents);
  }

  const topInfluencers = Array.from(influencerMap.values())
    .map((inf) => ({
      ...inf,
      influenceScore: inf.tags * 1 + inf.saves * 2 + inf.specs * 5 + inf.orders * 20,
    }))
    .sort((a, b) => b.influenceScore - a.influenceScore);

  // Conversion rates
  const tagCount = tags.length;
  const saveCount = saves.length;
  const specCount = selections.length;
  const quoteCount = quotes.length;
  const orderCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.retailAmountCents, 0);

  return {
    product,
    stages: {
      tagged: { count: tagCount },
      viewed: { count: viewCount },
      liked: { count: likes.length },
      saved: { count: saveCount, convertedCount: saves.filter((s) => s.converted).length },
      specified: { count: specCount },
      quoted: { count: quoteCount, totalAmount: quotes.reduce((s, q) => s + Number(q.totalAmount || 0), 0) },
      ordered: { count: orderCount, totalRevenueCents: totalRevenue },
    },
    conversionRates: {
      tagToSave: tagCount > 0 ? saveCount / tagCount : 0,
      saveToSpec: saveCount > 0 ? specCount / saveCount : 0,
      specToQuote: specCount > 0 ? quoteCount / specCount : 0,
      quoteToOrder: quoteCount > 0 ? orderCount / quoteCount : 0,
      tagToOrder: tagCount > 0 ? orderCount / tagCount : 0,
    },
    timeline,
    topInfluencers,
  };
}

// --- Org-wide overview ---

async function getOrgAttribution(vendorMemberIds: string[], orgId: string, limit: number) {
  // Find all products owned by vendor org members
  const products = await prisma.product.findMany({
    where: { vendorId: { in: vendorMemberIds } },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      category: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const productIds = products.map((p) => p.id);

  // Count tags, likes, saves per product
  const [tagCounts, likeCounts, saveCounts] = await Promise.all([
    prisma.productTag.groupBy({ by: ['productId'], where: { productId: { in: productIds } }, _count: true }),
    prisma.like.groupBy({ by: ['productId'], where: { productId: { in: productIds } }, _count: true }),
    prisma.save.groupBy({ by: ['productId'], where: { productId: { in: productIds } }, _count: true }),
  ]);

  const tagMap = new Map(tagCounts.map((t) => [t.productId, t._count]));
  const likeMap = new Map(likeCounts.map((l) => [l.productId, l._count]));
  const saveMap = new Map(saveCounts.map((s) => [s.productId, s._count]));

  // Get selection counts per product
  const selectionCounts = await prisma.selection.groupBy({
    by: ['vendorProductId'],
    where: { vendorProductId: { in: productIds } },
    _count: true,
  });
  const selCountMap = new Map(selectionCounts.map((s) => [s.vendorProductId, s._count]));

  // Get order counts per product
  const orderItems = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      productId: { in: productIds },
      order: { vendorOrgId: orgId },
    },
    _count: true,
    _sum: { retailPriceCents: true },
  });
  const orderMap = new Map(orderItems.map((o) => [o.productId, { count: o._count, revenue: o._sum.retailPriceCents || 0 }]));

  // Rank products by total engagement
  const ranked = products
    .map((p) => {
      const tagCount = tagMap.get(p.id) || 0;
      const likeCount = likeMap.get(p.id) || 0;
      const saveCount = saveMap.get(p.id) || 0;
      const specCount = selCountMap.get(p.id) || 0;
      const orderData = orderMap.get(p.id) || { count: 0, revenue: 0 };

      return {
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        category: p.category,
        tags: tagCount,
        likes: likeCount,
        saves: saveCount,
        specs: specCount,
        orders: orderData.count,
        revenueCents: orderData.revenue,
        engagementScore: tagCount + likeCount * 1 + saveCount * 2 + specCount * 5 + orderData.count * 20,
      };
    })
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, limit);

  // Org-wide aggregates
  const totals = ranked.reduce(
    (acc, p) => ({
      tags: acc.tags + p.tags,
      likes: acc.likes + p.likes,
      saves: acc.saves + p.saves,
      specs: acc.specs + p.specs,
      orders: acc.orders + p.orders,
      revenueCents: acc.revenueCents + p.revenueCents,
    }),
    { tags: 0, likes: 0, saves: 0, specs: 0, orders: 0, revenueCents: 0 }
  );

  // Top influencers org-wide (designers who tag/spec the most of this vendor's products)
  const designerTags = await prisma.productTag.groupBy({
    by: ['imageId'],
    where: { product: { vendorId: { in: vendorMemberIds } } },
    _count: true,
  });

  // Get unique designers from those tags
  const tagImageIds = designerTags.map((t) => t.imageId);
  const designerProjects = await prisma.projectImage.findMany({
    where: { id: { in: tagImageIds } },
    select: {
      project: {
        select: {
          designerId: true,
          designer: { select: { id: true, name: true, profileImage: true } },
        },
      },
    },
  });

  const designerMap = new Map<string, { id: string; name: string; profileImage: string | null; tagCount: number }>();
  for (const di of designerProjects) {
    const d = di.project?.designer;
    if (!d?.id) continue;
    const existing = designerMap.get(d.id) || { id: d.id, name: d.name || '', profileImage: d.profileImage, tagCount: 0 };
    existing.tagCount++;
    designerMap.set(d.id, existing);
  }

  const topDesigners = Array.from(designerMap.values())
    .sort((a, b) => b.tagCount - a.tagCount)
    .slice(0, 10);

  return {
    orgOverview: {
      totals,
      conversionRates: {
        tagToSave: totals.tags > 0 ? totals.saves / totals.tags : 0,
        saveToSpec: totals.saves > 0 ? totals.specs / totals.saves : 0,
        specToOrder: totals.specs > 0 ? totals.orders / totals.specs : 0,
      },
    },
    topProducts: ranked,
    topDesigners,
  };
}

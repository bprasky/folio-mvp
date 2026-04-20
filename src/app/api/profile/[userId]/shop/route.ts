// @idor-allow: public-read reason="Public shop listing for a designer profile, viewable anonymously"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ShopProductResult {
  id: string;
  productId: string;
  quote: string | null;
  isFeatured: boolean;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    brand: string | null;
    category: string | null;
    vendorId: string | null;
  };
  projectCount: number;
  hasActiveBoost: boolean;
}

/**
 * GET /api/profile/[userId]/shop
 * Fetch shop products for a user's profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const userId = resolvedParams.userId;

    const { searchParams } = new URL(request.url);
    const productType = searchParams.get('productType') || 'all';
    const vendorId = searchParams.get('vendor') || 'all';
    const sort = searchParams.get('sort') || 'recent';

    // Build where clause for shop products
    const whereClause: any = {
      designerId: userId,
      isActive: true,
    };

    // Filter by product category
    if (productType !== 'all') {
      whereClause.product = {
        ...whereClause.product,
        category: productType,
      };
    }

    // Filter by vendor
    if (vendorId !== 'all') {
      whereClause.product = {
        ...whereClause.product,
        vendorId,
      };
    }

    // Build order clause
    let orderBy: any = { createdAt: 'desc' }; // default: recent
    if (sort === 'featured') {
      orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
    }
    // 'popular' would need engagement tracking which we don't have yet

    // Fetch shop products
    const shopProducts = await prisma.shopProduct.findMany({
      where: whereClause,
      orderBy,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            brand: true,
            category: true,
            vendorId: true,
          },
        },
        boosts: {
          where: {
            status: 'ACTIVE',
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
          take: 1,
        },
      },
    });

    // Get project counts for each product (via ProductTag)
    const productIds = shopProducts.map(sp => sp.productId);
    const projectCounts = await prisma.productTag.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        image: {
          project: {
            designerId: userId,
            isPublic: true,
          },
        },
      },
      _count: {
        _all: true,
      },
    });

    // Create a map of productId -> projectCount
    const projectCountMap = new Map<string, number>();
    for (const pc of projectCounts) {
      projectCountMap.set(pc.productId, pc._count._all);
    }

    // Format results
    const products: ShopProductResult[] = shopProducts.map(sp => ({
      id: sp.id,
      productId: sp.productId,
      quote: sp.quote,
      isFeatured: sp.isFeatured,
      product: sp.product,
      projectCount: projectCountMap.get(sp.productId) || 0,
      hasActiveBoost: sp.boosts.length > 0,
    }));

    // Get unique vendors for filter dropdown
    const vendorIds = [...new Set(shopProducts.map(sp => sp.product.vendorId).filter(Boolean))];
    let vendors: { id: string; name: string }[] = [];

    if (vendorIds.length > 0) {
      const vendorUsers = await prisma.user.findMany({
        where: { id: { in: vendorIds as string[] } },
        select: { id: true, name: true },
      });
      vendors = vendorUsers.map(v => ({ id: v.id, name: v.name }));
    }

    return NextResponse.json({
      products,
      vendors,
      total: products.length,
    });
  } catch (error) {
    console.error('[profile/shop] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shop products' },
      { status: 500 }
    );
  }
}

// @idor-allow: public-read reason="Public shop listing for a designer profile, viewable anonymously"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { resolveProductImage, PRODUCT_PROVENANCE_SELECT } from '@/lib/products/imageProvenance';

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

    // Provenance gate (spec 17): the public shop suppresses VENDOR_REFERENCE
    // images and substitutes the designer's own in-situ crop. The owner viewing
    // their own shop keeps the workspace (vendor-image) view.
    const session = await getServerSession(authOptions);
    const renderContext = session?.user?.id === userId ? 'INTERNAL' : 'PUBLIC';

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
            ...PRODUCT_PROVENANCE_SELECT,
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

    // A representative in-situ crop (a crop of the designer's own room photo) per
    // product — the public substitute when the vendor image is suppressed.
    const cropMap = new Map<string, string>();
    if (renderContext === 'PUBLIC' && productIds.length > 0) {
      const crops = await prisma.productTag.findMany({
        where: {
          productId: { in: productIds },
          cropUrl: { not: null },
          image: { project: { designerId: userId, isPublic: true } },
        },
        select: { productId: true, cropUrl: true },
      });
      for (const c of crops) {
        if (c.cropUrl && !cropMap.has(c.productId)) cropMap.set(c.productId, c.cropUrl);
      }
    }

    // Format results
    const products: ShopProductResult[] = shopProducts.map(sp => ({
      id: sp.id,
      productId: sp.productId,
      quote: sp.quote,
      isFeatured: sp.isFeatured,
      product: {
        id: sp.product.id,
        name: sp.product.name,
        imageUrl: resolveProductImage(
          sp.product,
          cropMap.get(sp.productId) ?? null,
          renderContext,
        ),
        brand: sp.product.brand,
        category: sp.product.category,
        vendorId: sp.product.vendorId,
      },
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

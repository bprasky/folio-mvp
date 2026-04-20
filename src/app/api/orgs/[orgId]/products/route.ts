export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/orgs/[orgId]/products?sort=curated|featured|collection:Name|type:Name&limit=24
 *
 * Returns vendor's product catalog with Atelier-ranked "Curated for You" default.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const orgId = resolvedParams.orgId;
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'curated';
    const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 48);

    // Get vendor user IDs
    const orgUsers = await prisma.organizationUser.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { userId: true },
    });
    const vendorUserIds = orgUsers.map(u => u.userId);

    if (vendorUserIds.length === 0) {
      return NextResponse.json({ products: [], collections: [] });
    }

    // Fetch all vendor products
    const rawProducts = await prisma.product.findMany({
      where: { vendorId: { in: vendorUserIds } },
      select: {
        id: true,
        name: true,
        brand: true,
        imageUrl: true,
        category: true,
        url: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // Pool for scoring
    });

    // Enrich with CachedProduct data
    const urls = rawProducts.map(p => p.url).filter(Boolean) as string[];
    const cachedMap = new Map<string, any>();
    if (urls.length > 0) {
      const cached = await prisma.cachedProduct.findMany({
        where: { url: { in: urls } },
        select: {
          url: true,
          materialType: true,
          style: true,
          categories: true,
          tags: true,
          widthIn: true,
          depthIn: true,
          heightIn: true,
          priceCents: true,
        },
      });
      for (const c of cached) {
        cachedMap.set(c.url, c);
      }
    }

    // Build enriched product list
    let products = rawProducts.map(p => {
      const c = p.url ? cachedMap.get(p.url) : null;
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        imageUrl: p.imageUrl,
        category: p.category || (c?.categories?.[0] ?? null),
        materials: c?.materialType ? [c.materialType] : [],
        style: c?.style || null,
        price: c?.priceCents ? c.priceCents / 100 : null,
        dimensions: c?.widthIn ? { w: Number(c.widthIn), d: Number(c.depthIn || 0), h: Number(c.heightIn || 0) } : null,
        tags: c?.tags || [],
        createdAt: p.createdAt,
      };
    });

    // Extract unique collections (categories) for filter pills
    const collectionSet = new Set<string>();
    for (const p of products) {
      if (p.category) collectionSet.add(p.category);
    }
    const collections = Array.from(collectionSet).sort();

    // Apply sort/filter
    if (sort === 'featured') {
      // TODO: use a "featured" flag when available. For now, sort by most tags.
      // Just return newest
    } else if (sort.startsWith('collection:')) {
      const col = sort.slice('collection:'.length);
      products = products.filter(p => p.category?.toLowerCase() === col.toLowerCase());
    } else if (sort.startsWith('type:')) {
      const type = sort.slice('type:'.length);
      products = products.filter(p => p.materials.some(m => m.toLowerCase() === type.toLowerCase()));
    } else if (sort === 'curated') {
      // Atelier-ranked: use taste signals for logged-in user
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        try {
          const inferences = await prisma.tasteInference.findMany({
            where: {
              userId: session.user.id,
              confidence: { gte: 0.5 },
              dismissedAt: null,
            },
            select: { attribute: true, attributeType: true, confidence: true },
          });

          if (inferences.length > 0) {
            const attrMap = new Map(inferences.map(i => [i.attribute.toLowerCase(), i.confidence]));

            products = products.map(p => {
              let score = 0;
              if (p.style) score += (attrMap.get(p.style.toLowerCase()) || 0) * 1.2;
              for (const m of p.materials) score += (attrMap.get(m.toLowerCase()) || 0) * 1.5;
              for (const t of p.tags) score += (attrMap.get(t.toLowerCase()) || 0) * 0.5;
              return { ...p, score };
            });

            products.sort((a, b) => (b as any).score - (a as any).score);
          }
        } catch {
          // Taste scoring failed, use default order
        }
      }
    }

    return NextResponse.json({
      products: products.slice(0, limit),
      collections,
    });
  } catch (error) {
    console.error('[orgs/[orgId]/products] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

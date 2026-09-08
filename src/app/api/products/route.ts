// @idor-allow: public-read reason="Public product catalog browsing"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { triggerMeshGeneration } from '@/lib/three-d/triggerMeshGeneration';
import { resolveProductImage } from '@/lib/products/imageProvenance';
import { normalizeProductUrl } from '@/lib/products/normalizeProductUrl';
import { rateLimit } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  try {
    // Provenance gate (spec 17): this endpoint is public-read but its UI
    // consumers are authenticated workspace tools. Anonymous callers get the
    // public view (VENDOR_REFERENCE images suppressed); authenticated callers
    // keep the workspace view (vendor image preferred). No anonymous leak.
    const session = await getServerSession(authOptions);
    const renderContext = session?.user?.id ? 'INTERNAL' : 'PUBLIC';

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase();
    const category = searchParams.get('category');
    const vendor = searchParams.get('vendor');
    const limit = searchParams.get('limit');

    // Build where clause for database query
    const whereClause: any = {};

    // Apply search filter
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Apply category filter
    if (category) {
      whereClause.category = { equals: category, mode: 'insensitive' };
    }

    // Apply vendor filter
    if (vendor) {
      whereClause.vendor = {
        name: { contains: vendor, mode: 'insensitive' }
      };
    }

    // Load products from database
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        }
      },
      take: limit ? parseInt(limit, 10) : undefined,
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform data to match expected format
    const formattedProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      image: resolveProductImage(product, null, renderContext),
      category: product.category,
      brand: product.brand,
      vendor: product.vendor?.name || product.vendor?.companyName || product.brand,
      url: product.url,
      isPending: product.isPending
    }));

    return NextResponse.json({
      success: true,
      products: formattedProducts,
      total: formattedProducts.length
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const limit = await rateLimit({ userId: session.user.id, scope: 'product-create', limit: 60, windowMs: 3600000 });
    if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const body = await request.json();
    const { name, imageUrl, price, brand, category, url, isPending, description, scrapeStatus } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    // Store the canonical (query-stripped) URL so product identity matches the
    // CachedProduct cache key — getProductById enriches via
    // cachedProduct.findUnique({ url: product.url }), which only hits when
    // product.url is normalized. This is also the dedup key below.
    const normalizedUrl = url ? normalizeProductUrl(url) : null;

    // Canonical dedup: one Product per normalized URL. When a URL was already
    // tagged, reuse that row so every tag of the same product shares it (the
    // vendor's later edits then cascade to all tags) and we never spawn
    // duplicates. Tags are created separately by the caller and are never
    // touched here — tag count and attribution are fully preserved.
    // (Concurrent first-time pastes can still race to two rows; a future unique
    // index on the normalized URL + the historical backfill close that gap —
    // see tasks/PRODUCT_TAG_LIFECYCLE_SPEC.md.)
    if (normalizedUrl) {
      const existing = await prisma.product.findFirst({
        where: { url: normalizedUrl },
        orderBy: { createdAt: 'asc' }, // oldest row is canonical
      });
      if (existing) {
        // Add-only merge: fill fields this paste supplies that are still blank,
        // but NEVER overwrite a value already present (it may be another
        // designer's contribution) and NEVER edit a CLAIMED product (the vendor
        // owns it). Vendors overwrite via PUT; designers may only enrich.
        if (existing.vendorId === null) {
          const addOnly: Record<string, any> = {};
          const incoming: Record<string, any> = {
            description: description || null,
            imageUrl: imageUrl || null,
            price: price ? parseFloat(String(price)) : null,
            brand: brand || null,
            category: category || null,
          };
          for (const [field, value] of Object.entries(incoming)) {
            if (value != null && value !== '' && (existing as any)[field] == null) {
              addOnly[field] = value;
            }
          }
          // Only replace a placeholder name, never a real one another designer set.
          if (name?.trim() && (!existing.name || existing.name === 'Untitled product')) {
            addOnly.name = name.trim();
          }
          if (Object.keys(addOnly).length > 0) {
            const mergedFields = await prisma.product.updateMany({
              where: { id: existing.id, vendorId: null, AND: Object.keys(addOnly).map(field => ({ [field]: existing[field] })) },
              data: addOnly,
            });
            // Generate a mesh if this paste supplied the product's first image.
            if (mergedFields.count && addOnly.imageUrl) triggerMeshGeneration(existing.id, addOnly.imageUrl);
          }
        }
        const merged = await prisma.product.findUnique({ where: { id: existing.id } });
        return NextResponse.json(
          { success: true, id: existing.id, product: merged, deduped: true },
          { status: 200 }
        );
      }
    }

    // Create product in database
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        description: description || null,
        imageUrl: imageUrl || null,
        price: price ? parseFloat(String(price)) : null,
        brand: brand || null,
        category: category || null,
        url: normalizedUrl,
        isPending: isPending ?? false,
        // Flagged-domain BQL lifecycle: the tagging UI creates the product as
        // 'pending' for hard domains, then fires the scrape-bql route to fill it.
        scrapeStatus: scrapeStatus ?? null,
        vendorId: null, // Can be set later if needed
      },
    });

    // Fire-and-forget mesh generation if product has an image
    if (imageUrl) {
      triggerMeshGeneration(product.id, imageUrl);
    }

    return NextResponse.json({
      success: true,
      id: product.id,
      product,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

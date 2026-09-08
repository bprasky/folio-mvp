// @idor-allow: public-read reason="Public product detail page viewable anonymously"
// @idor-allow: IDOR003 reason="Public lookup by product id"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { logSignal, extractTags } from '@/lib/telemetry/context-signal';
import { triggerMeshGeneration } from '@/lib/three-d/triggerMeshGeneration';
import { normalizeProductUrl } from '@/lib/products/normalizeProductUrl';
import { assessProductHealth, isHealthRegression } from '@/lib/products/productHealth';
import { resolveProductImage } from '@/lib/products/imageProvenance';

export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        }
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const session = await getServerSession(authOptions);
    // Apply the same public image gate as catalog browsing.
    const formattedProduct = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      priceCents: product.price ? Math.round(Number(product.price) * 100) : null,
      imageUrl: resolveProductImage(product, null, session?.user?.id ? 'INTERNAL' : 'PUBLIC'),
      category: product.category,
      brand: product.brand,
      vendorName: product.vendor?.name || product.vendor?.companyName || product.brand,
      url: product.url,
      currency: 'USD', // Default currency
      // Flagged-domain BQL scrape lifecycle, for the tagging UI to poll on.
      scrapeStatus: product.scrapeStatus,
    };

    // Log context signal for product view (async, non-blocking)
    if (session?.user?.id) {
      logSignal({
        userId: session.user.id,
        productId: product.id,
        vendorId: product.vendorId || undefined,
        action: 'view',
        tags: extractTags(product),
      }).catch(err => console.error('[ContextSignal] Failed to log view:', err));
    }

    return NextResponse.json(formattedProduct);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify product exists and check permissions. Pull the current fields too so
    // we can health-check the edit (did this change make the record worse?).
    const existingProduct = await prisma.product.findUnique({
      where: { id: params.productId },
      select: {
        vendorId: true,
        threeDAssetUrl: true,
        name: true,
        brand: true,
        price: true,
        imageUrl: true,
        description: true,
      },
    });
    if (!existingProduct) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'ADMIN';
    const isClaimed = existingProduct.vendorId !== null;
    const isVendorOwner = existingProduct.vendorId === session.user.id;
    // Ownership model (see PRODUCT_TAG_LIFECYCLE spec): an UNCLAIMED product
    // (vendorId null) is collaboratively editable by any signed-in user — this
    // is the designer enrichment phase, where a designer who tags a product can
    // fill in details. Once a vendor CLAIMS it (vendorId set), edit rights turn
    // over to that vendor (or an admin) and designers can no longer change it.
    if (isClaimed && !isAdmin && !isVendorOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      priceCents,
      imageUrl,
      brand,
      category,
      url
    } = body;

    // Convert priceCents back to decimal
    const price = priceCents ? priceCents / 100 : null;

    // Keep product.url canonical (query-stripped) so it stays the dedup key and
    // matches the CachedProduct cache key. See products/route.ts POST.
    const normalizedUrl = url ? normalizeProductUrl(url) : url;

    // Vendor ownership is assigned by the claim workflow, never by a client-supplied display name.

    // Submit safeguard: health-check the edit. If it made the record meaningfully
    // worse, flag it (structured, admin-visible log) — without blocking the save,
    // so a genuine fix is never stopped, but a reckless/degrading edit is on the
    // record. A persistent admin review queue + per-user capability revocation is
    // the planned Phase 3; this is the lightweight signal it will build on.
    const before = assessProductHealth(existingProduct);
    const after = assessProductHealth({ name, brand, price, imageUrl, description });
    const healthRegressed = isHealthRegression(before, after);
    if (healthRegressed) {
      console.warn(
        '[product-health] edit degraded the record',
        JSON.stringify({
          productId: params.productId,
          userId: session.user.id,
          isAdmin,
          scoreBefore: before.score,
          scoreAfter: after.score,
          newSuspicious: after.flags
            .filter((f) => f.severity === 'suspicious')
            .map((f) => `${f.field}: ${f.message}`),
        }),
      );
    }

    // Update the product
    const updatedProduct = await prisma.product.update({
      where: { id: params.productId, vendorId: existingProduct.vendorId },
      data: {
        name,
        description,
        price,
        imageUrl,
        brand,
        category,
        url: normalizedUrl,
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        }
      }
    });

    // Transform response
    const formattedProduct = {
      id: updatedProduct.id,
      name: updatedProduct.name,
      description: updatedProduct.description,
      price: updatedProduct.price,
      imageUrl: updatedProduct.imageUrl,
      brand: updatedProduct.brand,
      url: updatedProduct.url,
      vendorName: updatedProduct.vendor?.name || updatedProduct.vendor?.companyName || updatedProduct.brand
    };

    // Fire-and-forget mesh generation if imageUrl was set/changed and no mesh exists
    if (imageUrl && !existingProduct.threeDAssetUrl) {
      triggerMeshGeneration(updatedProduct.id, imageUrl);
    }

    return NextResponse.json({
      success: true,
      product: formattedProduct
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

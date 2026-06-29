// @idor-allow: public-read reason="Authenticated designer dedup lookup; returns a product summary by URL so the tagger can offer to reuse an existing product instead of silently creating/duplicating one"
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { normalizeProductUrl } from '@/lib/products/normalizeProductUrl';
import { assessProductHealth } from '@/lib/products/productHealth';

/**
 * GET /api/products/lookup?url=...
 *
 * Dedup probe for the tagger. Normalizes the URL the same way the canonical
 * dedup in POST /api/products does (query string + trailing slashes dropped),
 * then returns a summary of the existing Product for that URL — or { match: null }.
 *
 * This lets the tagger offer "we already have this product, use it?" before it
 * creates anything, instead of the server silently reusing the row (and quietly
 * inheriting a faulty earlier scrape). The summary includes a completeness read
 * so the UI can route an incomplete reuse into the edit/enrich flow.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get('url')?.trim();
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  const normalized = normalizeProductUrl(url);
  if (!normalized) {
    return NextResponse.json({ match: null });
  }

  const existing = await prisma.product.findFirst({
    where: { url: normalized },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      price: true,
      brand: true,
      description: true,
      vendorId: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ match: null });
  }

  // Health check: surface BOTH missing and suspicious fields (e.g. an HTML
  // description), so the dedup card can say *why* the existing data looks off and
  // a re-scan decision is informed rather than blind.
  const health = assessProductHealth({
    name: existing.name,
    brand: existing.brand,
    price: existing.price != null ? Number(existing.price) : null,
    imageUrl: existing.imageUrl,
    description: existing.description,
  });

  return NextResponse.json({
    match: {
      id: existing.id,
      name: existing.name,
      imageUrl: existing.imageUrl,
      // Decimal serializes oddly over JSON; hand back a plain number.
      price: existing.price != null ? Number(existing.price) : null,
      brand: existing.brand,
      // A vendor-claimed product is canonical and shouldn't be edited here.
      claimed: existing.vendorId != null,
      complete: health.ok,
      flags: health.flags,
    },
  });
}

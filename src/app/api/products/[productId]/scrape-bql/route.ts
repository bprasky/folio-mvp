export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Keep the caller-facing escalation URL. All live rendering must use the protected
// path; the old unrestricted BQL navigation is no longer permitted here.
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { protectedProductHtml } from '@/lib/browserless/protected-product';
import { validateProductUrl, UnsafeProductUrl } from '@/lib/server/safe-product-url';
import { checkMultipleRateLimits } from '@/lib/rateLimit';
import { recordScrapeAttempt, hasRecentBlockedAttempt } from '@/lib/browserless/record';
import { isFlaggedDomain } from '@/lib/browserless/flaggedDomains';
import { normalizeProductUrl } from '@/lib/products/normalizeProductUrl';
import { assessProductHealth } from '@/lib/products/productHealth';
import {
  extractProductFromHtml,
  parsePriceNumber,
  generateTags,
  determineCategory,
} from '@/lib/products/extractProductFields';

/**
 * POST /api/products/[productId]/scrape-bql
 *
 * Runs protected rendering for a product tagged from a flagged hard
 * domain, then writes the result back onto the product and flips scrapeStatus to
 * 'complete' (or 'failed' on no usable content). Mirrors the create-then-run
 * shape of src/app/api/import/website/route.ts: the product row already exists in
 * a pending state, this route does the slow work inline under a raised
 * maxDuration and persists the outcome.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { productId: string } },
) {
  const { productId } = params;

  // `?force=1` re-runs the scrape over a product that's already 'complete' or
  // cached, overwriting stale fields. Used by the "refresh from the web" action
  // when a shared product's scrape is wrong/stale (e.g. an old HTML description
  // before the cleanup landed). Without it the rung is idempotent.
  const force = req.nextUrl.searchParams.get('force') === '1';

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, url: true, scrapeStatus: true, vendorId: true },
  });

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Unclaimed products are collaborative catalog records; claimed products belong to their vendor.
  if (product.vendorId !== null && product.vendorId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const limits = await checkMultipleRateLimits([
    { identifier: `product-render-user:${session.user.id}`, config: { max: 20, windowMs: 3600000 } },
    { identifier: `product-render-target:${productId}`, config: { max: 3, windowMs: 3600000 } },
  ]);
  if (!limits.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  if (product.url) {
    try { await validateProductUrl(product.url); }
    catch (error) {
      if (error instanceof UnsafeProductUrl) return NextResponse.json({ error: 'This URL cannot be scraped' }, { status: 400 });
      return NextResponse.json({ error: 'Renderer unavailable' }, { status: 503 });
    }
  }

  // Idempotent: a completed scrape is never re-run unless forced.
  if (!force && product.scrapeStatus === 'complete') {
    return NextResponse.json({ status: 'complete', cached: true });
  }

  if (!product.url) {
    await prisma.product.update({ where: { id: productId, vendorId: product.vendorId, url: product.url }, data: { scrapeStatus: 'failed' } });
    return NextResponse.json({ status: 'failed', error: 'Product has no URL to scrape' }, { status: 422 });
  }

  // Cost gate: the renderer runs JavaScript and pulls multi-megabyte
  // pages, so it is allowed only when the spend is justified — either the domain
  // is statically flagged (a known-hard retailer, fast-pathed in the UI) or the
  // cheap path recently recorded a block for this exact URL (auto-escalation).
  // Enforced here, not just in the UI, so a direct call cannot spend the rung on
  // the default path.
  const authorized =
    isFlaggedDomain(product.url) || (await hasRecentBlockedAttempt(product.url));
  if (!authorized) {
    return NextResponse.json(
      { error: 'This domain does not use the escalation rung. Use the standard scrape path.' },
      { status: 400 },
    );
  }

  // Mark in-progress so a concurrent caller / poller sees the pending state.
  await prisma.product.update({ where: { id: productId, vendorId: product.vendorId, url: product.url }, data: { scrapeStatus: 'pending' } });

  const normalizedUrl = normalizeProductUrl(product.url);

  // Caching: do not re-run the expensive rung for a URL already extracted. The
  // CachedProduct table is keyed on the normalized URL and shared with the AI
  // extractor, so a prior scrape of the same product fills this one for free.
  try {
    const cached = force
      ? null
      : await prisma.cachedProduct.findUnique({ where: { url: normalizedUrl } });
    if (cached && (cached.productName || cached.imageUrl)) {
      await prisma.product.update({
        where: { id: productId, vendorId: product.vendorId, url: product.url },
        data: {
          name: cached.productName ?? undefined,
          brand: cached.brand ?? undefined,
          imageUrl: cached.imageUrl ?? undefined,
          price: cached.priceCents != null ? cached.priceCents / 100 : undefined,
          description: cached.description ?? undefined,
          scrapeStatus: 'complete',
        },
      });
      return NextResponse.json({ status: 'complete', cached: true });
    }
  } catch (err) {
    console.error('[scrape-bql] cache read failed:', err);
    // proceed to a live scrape
  }

  // No unrestricted BQL fallback: all escalation uses the protected renderer.
  const started = Date.now();
  let html: string | null = null;
  try { html = await protectedProductHtml(product.url); } catch { /* Fail closed, no provider exception/URL in response. */ }
  const res = { ok: !!html, status: html ? 200 : 503, targetStatus: null,
    payload: html || '', endpoint: 'function' as const, durationMs: Date.now() - started,
    error: html ? undefined : 'Protected renderer unavailable' };

  const fields = res.ok ? extractProductFromHtml(res.payload, product.url) : null;
  const usable = !!(fields && (fields.name || fields.image));

  // Record one attempt. No response body or provider credential is logged.
  await recordScrapeAttempt({
    url: product.url,
    consumer: 'PRODUCT_SCRAPE',
    result: res,
    productId,
    emptyResult: !usable,
  });

  if (!res.ok || !fields || !usable) {
    await prisma.product.update({ where: { id: productId, vendorId: product.vendorId, url: product.url }, data: { scrapeStatus: 'failed' } });
    return NextResponse.json(
      { status: 'failed', error: res.error || 'No usable content from the page' },
      { status: 502 },
    );
  }

  const name = (fields.name || '').trim();
  const description = fields.description?.trim() || '';
  const price = parsePriceNumber(fields.price);
  const tags = generateTags(name || product.url, description, product.url);
  const category = determineCategory(tags, name);

  // Write-through to the shared cache so the next tag of this URL skips the rung.
  // Upsert (not create) so a forced refresh replaces stale cached fields instead
  // of leaving the old row to re-serve them on the next non-forced scrape.
  try {
    const cacheData = {
      productName: name || null,
      brand: fields.brand ?? null,
      imageUrl: fields.image ?? null,
      priceCents: price != null ? Math.round(price * 100) : null,
      currency: fields.currency || 'USD',
      description: fields.description ?? null,
      // No finish. This rung runs the deterministic extractor only, and that no
      // longer derives one — the JSON-LD color read was wrong on both corpus
      // pages that published it (spec 21 delta D3). Leaving the column untouched
      // is correct: a wrong finish is worse than an absent one.
      extractionConfidence: 'medium',
    };
    await prisma.cachedProduct.upsert({
      where: { url: normalizedUrl },
      create: { url: normalizedUrl, ...cacheData },
      update: cacheData,
    });
  } catch (err: any) {
    console.error('[scrape-bql] cache write failed:', err);
  }

  // Pre-flag a bad import: a scrape can "succeed" yet land suspicious fields
  // (raw-HTML description, homepage name). Surface it now so it's visible the
  // record needs attention rather than discovered later. Non-blocking.
  const health = assessProductHealth({
    name: name || undefined,
    brand: fields.brand,
    price,
    imageUrl: fields.image,
    description: fields.description,
  });
  if (!health.ok) {
    console.warn(
      '[product-health] import flagged',
      JSON.stringify({
        productId,
        url: product.url,
        score: health.score,
        flags: health.flags.map((f) => `${f.field}: ${f.message}`),
      }),
    );
  }

  // Fill the product. Only overwrite name when the scrape found one, so a useful
  // placeholder is never blanked by a thin result.
  await prisma.product.update({
    where: { id: productId, vendorId: product.vendorId, url: product.url },
    data: {
      name: name || undefined,
      brand: fields.brand ?? undefined,
      imageUrl: fields.image ?? undefined,
      price: price ?? undefined,
      description: fields.description ?? undefined,
      category,
      scrapeStatus: 'complete',
    },
  });

  return NextResponse.json({ status: 'complete', health });
}

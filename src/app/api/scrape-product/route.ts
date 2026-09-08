export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { aiExtractProduct } from '@/lib/products/aiExtractProduct';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { safeProductFetch, validateProductUrl, UnsafeProductUrl } from '@/lib/server/safe-product-url';
import { looksLikeBotWall } from '@/lib/browserless/classify';
import { renderProductPage } from '@/lib/server/render-product';
import {
  type ProductFields,
  EMPTY_FIELDS,
  extractProductFromHtml,
  formatPrice,
  extractDimensionsFromText,
  extractMaterials,
  extractColors,
  generateTags,
  determineCategory,
} from '@/lib/products/extractProductFields';

// The cheap path uses pinned transport; Chromium has independent kernel egress.
async function fetchHtml(url: string): Promise<{ html: string | null; blocked: boolean }> {
  const result = await safeProductFetch(url);
  return { html: result.status >= 200 && result.status < 300 ? result.html : null,
    blocked: result.status === 403 || result.status === 429 || looksLikeBotWall(result.html) };
}

/* ------------------------------------------------------------------------- */

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const limit = await rateLimit({ userId: session.user.id, scope: 'scrape-product', limit: 20, windowMs: 60000 });
    if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    let input: unknown;
    try { input = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
    const { url: parsed } = await validateProductUrl((input as { url?: unknown })?.url);
    const url = parsed.href;

    // Static HTML through the address-pinned transport, then deterministic extraction.
    const { html, blocked: tier1Blocked } = await fetchHtml(url);
    let fields: ProductFields = html ? extractProductFromHtml(html, url) : { ...EMPTY_FIELDS };

    // Track whether any tier saw the target actively block us (status 403/429,
    // a challenge/captcha, or a denial-page signature). A block means the cheap
    // path can't read this retailer and we should escalate to the stealth rung,
    // not surface the denial page's title as a $0 product.
    const blocked =
      tier1Blocked ||
      looksLikeBotWall(html) ||
      looksLikeBotWall(fields.name) ||
      looksLikeBotWall(fields.description);
    // If Tier 1 hit a wall, the extracted name/description are the denial page,
    // not the product. Discard them so the later tiers get a clean shot.
    if (blocked) {
      fields = { ...EMPTY_FIELDS };
    }

    if (!fields.name || !fields.image) {
      try {
        const rendered = await renderProductPage(url);
        if (rendered && !looksLikeBotWall(rendered.html)) {
          const extracted = extractProductFromHtml(rendered.html, rendered.finalUrl);
          for (const key of Object.keys(fields) as Array<keyof ProductFields>) fields[key] = fields[key] || extracted[key];
        }
      } catch {
        // Never fall back to unprotected Browserless navigation.
        console.warn('[scrape-product] Protected renderer unavailable');
      }
    }

    // Tier 3 — AI (Claude + web_search), only when the result is still thin
    // (no name or no price). Cached + key-gated, so most scrapes never reach it.
    let aiConfidence: string | null = null;
    let aiFinish: string | null = null;
    if (!fields.name || !fields.price) {
      const ai = await aiExtractProduct(url);
      if (ai) {
        aiConfidence = ai.confidence;
        aiFinish = ai.finish ?? null;
        fields = {
          name: fields.name || ai.name,
          image: fields.image, // AI is text-only; image stays with the cheap tiers
          description: fields.description || ai.description,
          brand: fields.brand || ai.brand,
          price: fields.price || (ai.price != null ? String(ai.price) : null),
          currency: fields.currency || ai.currency,
        };
      }
    }

    // Derive a brand label up front; the escalation hand-off uses it as the
    // pending product's name ("<Brand> product") while the rung fills the rest.
    let brand = fields.brand?.trim() || null;
    if (!brand) {
      try {
        const host = new URL(url).hostname.replace('www.', '').split('.')[0];
        brand = host.charAt(0).toUpperCase() + host.slice(1);
      } catch {
        brand = null;
      }
    }

    // Blocked with no stealth rung available (Browserless unconfigured) and
    // nothing recovered: fall back to guided manual capture, not a denial title.
    if (blocked && !fields.name && !fields.price && !fields.image) {
      return NextResponse.json(
        {
          error:
            'This retailer blocked automated access to that page. Please enter the product details manually.',
          blocked: true,
        },
        { status: 422 },
      );
    }

    if (!fields.name && !fields.image && !fields.price) {
      return NextResponse.json(
        { error: 'Could not read product details from that link.' },
        { status: 502 },
      );
    }

    const name = (fields.name || 'Untitled Product').trim();
    const description = fields.description?.trim() || '';
    const enrichHtml = html || '';
    const tags = generateTags(name, description, url);

    const image = fields.image || '';

    return NextResponse.json({
      name,
      price: formatPrice(fields.price, fields.currency),
      image,
      imageUrls: image ? [image] : [],
      description,
      brand,
      category: determineCategory(tags, name),
      tags,
      materials: extractMaterials(enrichHtml, name),
      dimensions: extractDimensionsFromText(enrichHtml),
      colors: extractColors(enrichHtml, name),
      // Finish (spec 21 delta D3) comes from the AI tier only. The deterministic
      // JSON-LD read was removed after the corpus probe found it wrong on both
      // pages that published a color — a wrong finish is worse than none.
      finish: aiFinish,
      // Present only when Tier 3 (AI) ran; lets the UI flag low-confidence scrapes.
      confidence: aiConfidence,
    });
  } catch (error) {
    if (error instanceof UnsafeProductUrl) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('[scrape-product] fetch failed');
    return NextResponse.json(
      { error: 'Failed to scrape product data. Please check the URL and try again.' },
      { status: 500 },
    );
  }
}

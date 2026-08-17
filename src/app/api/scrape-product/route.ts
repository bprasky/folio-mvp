// @idor-allow: public-read reason="Public product metadata scraper used during onboarding flows"
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { aiExtractProduct } from '@/lib/products/aiExtractProduct';
import { getContent, runFunction, directFetch, hasBrowserlessKey } from '@/lib/browserless/client';
import { looksLikeBotWall, classifyScrapeOutcome, isBlockedOutcome } from '@/lib/browserless/classify';
import { recordScrapeAttempt } from '@/lib/browserless/record';
import {
  type ProductFields,
  EMPTY_FIELDS,
  resolveUrl,
  extractProductFromHtml,
  deriveFinish,
  formatPrice,
  extractDimensionsFromText,
  extractMaterials,
  extractColors,
  generateTags,
  determineCategory,
} from '@/lib/products/extractProductFields';

const FETCH_TIMEOUT_MS = 15000;
const RENDER_TIMEOUT_MS = 45000;

/* ----------------------------------------------------------------------------
 * Layered fetch — same approach as the designer-website photo scraper
 * (src/app/api/import/website/route.ts): Browserless rendered HTML when
 * configured, direct fetch otherwise. Field extraction lives in the shared
 * @/lib/products/extractProductFields module so the BQL rung reuses it verbatim.
 * ------------------------------------------------------------------------- */

/**
 * Tier 1 fetch: rendered HTML via Browserless /content if configured, else a
 * direct fetch (works for server-rendered product pages).
 */
async function fetchHtml(url: string): Promise<{ html: string | null; blocked: boolean }> {
  let blocked = false;
  if (hasBrowserlessKey()) {
    const res = await getContent(url, { timeoutMs: FETCH_TIMEOUT_MS });
    await recordScrapeAttempt({ url, consumer: 'PRODUCT_SCRAPE', result: res });
    if (res.ok) {
      // /content returns 200 even for a denial page, so classify the body.
      if (isBlockedOutcome(classifyScrapeOutcome(res))) blocked = true;
      else return { html: res.payload, blocked };
      // Blocked content: fall through to a direct fetch but keep the flag.
    } else {
      console.error('[scrape-product] Browserless /content failed:', res.status);
    }
  }
  const direct = await directFetch(url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });
  await recordScrapeAttempt({ url, consumer: 'PRODUCT_SCRAPE', result: direct });
  // directFetch carries the real target status, so a 403/429 surfaces here.
  if (isBlockedOutcome(classifyScrapeOutcome(direct))) blocked = true;
  if (!direct.ok) return { html: null, blocked };
  return { html: direct.payload, blocked };
}

/* ----------------------------------------------------------------------------
 * Tier 2: rendered DOM via Browserless /function (JS-hydrated product pages)
 * ------------------------------------------------------------------------- */

const PRODUCT_HARVEST_CODE = `export default async function ({ page, context }) {
  const { url } = context;
  const navResponse = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null);
  const httpStatus = navResponse ? navResponse.status() : null;
  await new Promise((r) => setTimeout(r, 600));
  const data = await page.evaluate(() => {
    const metaC = (sel) => { const e = document.querySelector(sel); return e ? e.getAttribute('content') : null; };
    let ld = null;
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      if (ld) return;
      try {
        const j = JSON.parse(s.textContent || '{}');
        const nodes = Array.isArray(j) ? j : (Array.isArray(j['@graph']) ? j['@graph'] : [j]);
        for (const n of nodes) {
          const t = n && n['@type'];
          if (t === 'Product' || (Array.isArray(t) && t.indexOf('Product') !== -1)) { ld = n; break; }
        }
      } catch (e) {}
    });
    const ldImg = ld && ld.image
      ? (Array.isArray(ld.image)
          ? (typeof ld.image[0] === 'string' ? ld.image[0] : (ld.image[0] && ld.image[0].url))
          : (typeof ld.image === 'string' ? ld.image : ld.image.url))
      : null;
    const offer = ld && ld.offers ? (Array.isArray(ld.offers) ? ld.offers[0] : ld.offers) : null;
    const h1 = document.querySelector('h1');
    return {
      name: (ld && ld.name) || metaC('meta[property="og:title"]') || (h1 && h1.textContent ? h1.textContent.trim() : null) || (document.title || '').trim() || null,
      image: ldImg || metaC('meta[property="og:image"]') || metaC('meta[name="twitter:image"]') || null,
      description: (ld && ld.description) || metaC('meta[property="og:description"]') || metaC('meta[name="description"]') || null,
      brand: (ld && ld.brand && (ld.brand.name || ld.brand)) || metaC('meta[property="product:brand"]') || null,
      price: (offer && (offer.price != null ? offer.price : offer.lowPrice)) || metaC('meta[property="product:price:amount"]') || metaC('meta[property="og:price:amount"]') || null,
      currency: (offer && offer.priceCurrency) || metaC('meta[property="product:price:currency"]') || null,
      color: (ld && ld.color) || metaC('meta[property="product:color"]') || null,
      material: (ld && (ld.material && (ld.material.name || ld.material))) || null,
    };
  });
  data._httpStatus = httpStatus;
  return { data, type: 'application/json' };
}`;

/** Tier 2: only runs when Browserless is configured and Tier 1 missed. */
async function renderedExtract(url: string): Promise<{ fields: ProductFields; blocked: boolean }> {
  if (!hasBrowserlessKey()) return { fields: { ...EMPTY_FIELDS }, blocked: false };

  const res = await runFunction(PRODUCT_HARVEST_CODE, { url }, { timeoutMs: RENDER_TIMEOUT_MS });
  if (!res.ok) {
    await recordScrapeAttempt({ url, consumer: 'PRODUCT_SCRAPE', result: res });
    console.error('[scrape-product] Browserless /function failed:', res.status);
    return { fields: { ...EMPTY_FIELDS }, blocked: false };
  }
  let payload: any;
  try {
    payload = JSON.parse(res.payload);
  } catch {
    await recordScrapeAttempt({ url, consumer: 'PRODUCT_SCRAPE', result: res });
    return { fields: { ...EMPTY_FIELDS }, blocked: false };
  }
  const d = payload?.data ?? payload ?? {};
  const fields: ProductFields = {
    name: d.name ? String(d.name).trim() : null,
    image: resolveUrl(d.image, url),
    description: d.description ? String(d.description).trim() : null,
    brand: d.brand ? String(d.brand).trim() : null,
    price: d.price != null ? String(d.price) : null,
    currency: d.currency ?? null,
    color: d.color ? String(d.color).trim() : null,
    material: d.material ? String(d.material).trim() : null,
    finish: deriveFinish(
      d.color ? String(d.color).trim() : null,
      d.material ? String(d.material).trim() : null,
    ),
  };
  // The harvest captures the real navigation status, so classify against it —
  // a 403/429 denial page (whose <title> would otherwise become the product
  // name) is recognized as a block here, not surfaced as a $0 product.
  const targetStatus = typeof d._httpStatus === 'number' ? d._httpStatus : null;
  const blocked =
    isBlockedOutcome(classifyScrapeOutcome({ ...res, targetStatus })) ||
    looksLikeBotWall(fields.name) ||
    looksLikeBotWall(fields.description);
  await recordScrapeAttempt({
    url,
    consumer: 'PRODUCT_SCRAPE',
    result: res,
    targetStatus,
    emptyResult: !(fields.name || fields.image),
  });
  return { fields, blocked };
}

/** Prefer the primary field, fall back to the secondary one. */
function merge(primary: ProductFields, secondary: ProductFields): ProductFields {
  return {
    name: primary.name || secondary.name,
    image: primary.image || secondary.image,
    description: primary.description || secondary.description,
    brand: primary.brand || secondary.brand,
    price: primary.price || secondary.price,
    currency: primary.currency || secondary.currency,
    color: primary.color || secondary.color,
    material: primary.material || secondary.material,
    finish: primary.finish || secondary.finish,
  };
}

/* ------------------------------------------------------------------------- */

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Tier 1 — static / Browserless-rendered HTML + cheerio.
    const { html, blocked: tier1Blocked } = await fetchHtml(url);
    let fields: ProductFields = html ? extractProductFromHtml(html, url) : { ...EMPTY_FIELDS };

    // Track whether any tier saw the target actively block us (status 403/429,
    // a challenge/captcha, or a denial-page signature). A block means the cheap
    // path can't read this retailer and we should escalate to the stealth rung,
    // not surface the denial page's title as a $0 product.
    let blocked =
      tier1Blocked ||
      looksLikeBotWall(html) ||
      looksLikeBotWall(fields.name) ||
      looksLikeBotWall(fields.description);
    // If Tier 1 hit a wall, the extracted name/description are the denial page,
    // not the product. Discard them so the later tiers get a clean shot.
    if (blocked) {
      fields = { ...EMPTY_FIELDS };
    }

    // Tier 2 — rendered DOM harvest, only when Tier 1 missed the essentials.
    if (!fields.name || !fields.image) {
      const { fields: rendered, blocked: tier2Blocked } = await renderedExtract(url);
      fields = merge(fields, rendered);
      if (tier2Blocked) blocked = true;
      // The rendered DOM can be the same wall — don't let it back in.
      if (looksLikeBotWall(fields.name)) fields.name = '';
      if (looksLikeBotWall(fields.description)) fields.description = '';
    }

    // When the page was blocked and the stealth rung is available, we'll escalate
    // below regardless — so skip the (paid) AI tier and let the rung get the real
    // page. Only fall through to AI here if there's no rung to escalate to.
    const willEscalate = blocked && hasBrowserlessKey();

    // Tier 3 — AI (Claude + web_search), only when the result is still thin
    // (no name or no price). Cached + key-gated, so most scrapes never reach it.
    let aiConfidence: string | null = null;
    if (!willEscalate && (!fields.name || !fields.price)) {
      const ai = await aiExtractProduct(url);
      if (ai) {
        aiConfidence = ai.confidence;
        fields = {
          name: fields.name || ai.name,
          image: fields.image, // AI is text-only; image stays with the cheap tiers
          description: fields.description || ai.description,
          brand: fields.brand || ai.brand,
          price: fields.price || (ai.price != null ? String(ai.price) : null),
          currency: fields.currency || ai.currency,
          // Finish (spec 21 delta D3). JSON-LD wins when present — it is the
          // vendor's own wording rather than a model's reading of the page.
          color: fields.color,
          material: fields.material,
          finish: fields.finish || ai.finish,
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

    const usableForTag = !!(fields.name && fields.image);

    // Blocked, and the cheap tiers didn't recover a tag-ready result: hand off to
    // the stealth (BQL) rung instead of dead-ending. The client stages a pending
    // product and the background rung fills it — the same path a flagged domain
    // takes. recordScrapeAttempt above logged the block, which authorizes the rung.
    if (blocked && !usableForTag && hasBrowserlessKey()) {
      return NextResponse.json({ escalate: true, url, brand }, { status: 200 });
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
      // Finish as the vendor states it (spec 21 delta D3). Deliberately separate
      // from `materials` and `colors` above, which are keyword greps over the
      // whole page and cannot represent "Unlacquered Brass".
      finish: fields.finish,
      // Present only when Tier 3 (AI) ran; lets the UI flag low-confidence scrapes.
      confidence: aiConfidence,
    });
  } catch (error) {
    console.error('[scrape-product] error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape product data. Please check the URL and try again.' },
      { status: 500 },
    );
  }
}

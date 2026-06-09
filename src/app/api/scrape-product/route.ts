// @idor-allow: public-read reason="Public product metadata scraper used during onboarding flows"
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { aiExtractProduct } from '@/lib/products/aiExtractProduct';
import { getContent, runFunction, directFetch, hasBrowserlessKey } from '@/lib/browserless/client';
import { looksLikeBotWall } from '@/lib/browserless/classify';
import { recordScrapeAttempt } from '@/lib/browserless/record';

const FETCH_TIMEOUT_MS = 15000;
const RENDER_TIMEOUT_MS = 45000;

/* ----------------------------------------------------------------------------
 * Layered fetch — same approach as the designer-website photo scraper
 * (src/app/api/import/website/route.ts): Browserless rendered HTML when
 * configured, direct fetch otherwise.
 * ------------------------------------------------------------------------- */

/** Resolve a possibly-relative URL against the page URL; null if unusable. */
function resolveUrl(src: string | undefined | null, base: string): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

/**
 * Tier 1 fetch: rendered HTML via Browserless /content if configured, else a
 * direct fetch (works for server-rendered product pages).
 */
async function fetchHtml(url: string): Promise<string | null> {
  if (hasBrowserlessKey()) {
    const res = await getContent(url, { timeoutMs: FETCH_TIMEOUT_MS });
    await recordScrapeAttempt({ url, consumer: 'PRODUCT_SCRAPE', result: res });
    if (res.ok) return res.payload;
    console.error('[scrape-product] Browserless /content failed:', res.status);
    // fall through to direct fetch
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
  if (!direct.ok) return null;
  return direct.payload;
}

/* ----------------------------------------------------------------------------
 * Single-product field extraction
 * ------------------------------------------------------------------------- */

interface ProductFields {
  name: string | null;
  image: string | null;
  description: string | null;
  brand: string | null;
  price: string | null;
  currency: string | null;
}

const EMPTY_FIELDS: ProductFields = {
  name: null,
  image: null,
  description: null,
  brand: null,
  price: null,
  currency: null,
};

/** First usable image URL out of a JSON-LD `image` value (string | array | object). */
function ldImage(node: any): string | null {
  const img = node?.image;
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) {
    const first = img[0];
    return typeof first === 'string' ? first : first?.url ?? null;
  }
  return img.url ?? null;
}

function ldBrand(node: any): string | null {
  const b = node?.brand;
  if (!b) return null;
  if (typeof b === 'string') return b;
  return b.name ?? null;
}

function ldOffer(node: any): any | null {
  const o = node?.offers;
  if (!o) return null;
  return Array.isArray(o) ? o[0] ?? null : o;
}

/**
 * Tier 1: cheerio multi-strategy. JSON-LD Product schema is the gold standard;
 * OpenGraph / Twitter / meta tags and the page title fill anything missing.
 */
function extractProductFromHtml(html: string, baseUrl: string): ProductFields {
  const $ = cheerio.load(html);

  // JSON-LD Product node, if present.
  let ld: any = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (ld) return;
    try {
      const json = JSON.parse($(el).contents().text() || '{}');
      const nodes = Array.isArray(json)
        ? json
        : Array.isArray(json['@graph'])
          ? json['@graph']
          : [json];
      for (const node of nodes) {
        const t = node?.['@type'];
        if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) {
          ld = node;
          break;
        }
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  });

  const offer = ldOffer(ld);

  const meta = (sel: string) => $(sel).attr('content')?.trim() || null;

  const name =
    (ld?.name && String(ld.name).trim()) ||
    meta('meta[property="og:title"]') ||
    meta('meta[name="twitter:title"]') ||
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    null;

  const image = resolveUrl(
    ldImage(ld) ||
      meta('meta[property="og:image"]') ||
      meta('meta[name="twitter:image"]') ||
      $('img').first().attr('src'),
    baseUrl,
  );

  const description =
    (ld?.description && String(ld.description).trim()) ||
    meta('meta[property="og:description"]') ||
    meta('meta[name="twitter:description"]') ||
    meta('meta[name="description"]') ||
    null;

  const brand =
    ldBrand(ld) ||
    meta('meta[property="og:brand"]') ||
    meta('meta[property="product:brand"]') ||
    null;

  // Price: structured first, then a `$` fallback scanned from the page text.
  let price: string | null = null;
  let currency: string | null = null;
  if (offer?.price != null) {
    price = String(offer.price);
    currency = offer.priceCurrency ?? null;
  } else if (offer?.lowPrice != null) {
    price = String(offer.lowPrice);
    currency = offer.priceCurrency ?? null;
  } else {
    const metaAmount =
      meta('meta[property="product:price:amount"]') || meta('meta[property="og:price:amount"]');
    if (metaAmount) {
      price = metaAmount;
      currency =
        meta('meta[property="product:price:currency"]') ||
        meta('meta[property="og:price:currency"]');
    } else {
      const m = $('body').text().match(/\$[\d,]+\.?\d{0,2}/);
      if (m) {
        price = m[0];
        currency = 'USD';
      }
    }
  }

  return { name, image, description, brand, price, currency };
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
    };
  });
  data._httpStatus = httpStatus;
  return { data, type: 'application/json' };
}`;

/** Tier 2: only runs when Browserless is configured and Tier 1 missed. */
async function renderedExtract(url: string): Promise<ProductFields> {
  if (!hasBrowserlessKey()) return { ...EMPTY_FIELDS };

  const res = await runFunction(PRODUCT_HARVEST_CODE, { url }, { timeoutMs: RENDER_TIMEOUT_MS });
  if (!res.ok) {
    await recordScrapeAttempt({ url, consumer: 'PRODUCT_SCRAPE', result: res });
    console.error('[scrape-product] Browserless /function failed:', res.status);
    return { ...EMPTY_FIELDS };
  }
  let payload: any;
  try {
    payload = JSON.parse(res.payload);
  } catch {
    await recordScrapeAttempt({ url, consumer: 'PRODUCT_SCRAPE', result: res });
    return { ...EMPTY_FIELDS };
  }
  const d = payload?.data ?? payload ?? {};
  const fields: ProductFields = {
    name: d.name ? String(d.name).trim() : null,
    image: resolveUrl(d.image, url),
    description: d.description ? String(d.description).trim() : null,
    brand: d.brand ? String(d.brand).trim() : null,
    price: d.price != null ? String(d.price) : null,
    currency: d.currency ?? null,
  };
  await recordScrapeAttempt({
    url,
    consumer: 'PRODUCT_SCRAPE',
    result: res,
    targetStatus: typeof d._httpStatus === 'number' ? d._httpStatus : null,
    emptyResult: !(fields.name || fields.image),
  });
  return fields;
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
  };
}

function formatPrice(amount: string | null, currency: string | null): string {
  if (!amount) return '$0.00';
  const num = parseFloat(String(amount).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num)) return String(amount);
  if (!currency || /usd|\$/i.test(currency)) return `$${num.toFixed(2)}`;
  return `${num.toFixed(2)} ${currency.toUpperCase()}`;
}

/* ----------------------------------------------------------------------------
 * Lightweight enrichment (category / tags / materials / colors / dimensions),
 * kept so the response shape is unchanged for existing callers.
 * ------------------------------------------------------------------------- */

function extractDimensionsFromText(html: string): string {
  const patterns = [
    /\d+["']\s*[xX×]\s*\d+["']\s*[xX×]\s*\d+["']/g,
    /\d+["']\s*[xX×]\s*\d+["']/g,
    /\d+\s*[xX×]\s*\d+\s*[xX×]\s*\d+/g,
    /\d+\s*[xX×]\s*\d+/g,
  ];
  for (const pattern of patterns) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) return matches[0];
  }
  return '';
}

function keywordHits(content: string, map: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [keyword, label] of Object.entries(map)) {
    if (content.includes(keyword)) out.push(label);
  }
  return Array.from(new Set(out));
}

function extractMaterials(html: string, name: string): string[] {
  return keywordHits((html + ' ' + name).toLowerCase(), {
    marble: 'Marble', granite: 'Granite', porcelain: 'Porcelain', ceramic: 'Ceramic',
    glass: 'Glass', wood: 'Wood', metal: 'Metal', fabric: 'Fabric', stone: 'Stone',
    travertine: 'Travertine', limestone: 'Limestone', slate: 'Slate', quartzite: 'Quartzite',
  });
}

function extractColors(html: string, name: string): string[] {
  return keywordHits((html + ' ' + name).toLowerCase(), {
    white: 'White', black: 'Black', gray: 'Gray', grey: 'Gray', brown: 'Brown',
    beige: 'Beige', blue: 'Blue', green: 'Green', red: 'Red', yellow: 'Yellow',
    gold: 'Gold', silver: 'Silver', bronze: 'Bronze', cream: 'Cream', ivory: 'Ivory',
    tan: 'Tan', charcoal: 'Charcoal',
  });
}

function generateTags(name: string, description: string, url: string): string[] {
  const content = (name + ' ' + description + ' ' + url).toLowerCase();
  const urlPath = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return ''; } })();
  const productTypes: Record<string, string[]> = {
    chair: ['chair', 'seating'], sofa: ['sofa', 'seating'], table: ['table', 'furniture'],
    lamp: ['lamp', 'lighting'], rug: ['rug', 'textile'], bed: ['bed', 'bedroom'],
    tile: ['tile', 'flooring'], marble: ['marble', 'stone'], mosaic: ['mosaic', 'tile'],
    backsplash: ['backsplash', 'kitchen'], bathroom: ['bathroom'], kitchen: ['kitchen'],
    floor: ['flooring'], wall: ['wall'],
  };
  const tags: string[] = [];
  for (const [keyword, tagList] of Object.entries(productTypes)) {
    if (content.includes(keyword) || urlPath.includes(keyword)) tags.push(...tagList);
  }
  return Array.from(new Set(tags));
}

function determineCategory(tags: string[], name: string): string {
  if (tags.some(t => ['tile', 'marble', 'mosaic'].includes(t))) return 'Tile & Stone';
  if (tags.some(t => ['chair', 'sofa', 'table', 'bed'].includes(t))) return 'Furniture';
  if (tags.includes('lighting')) return 'Lighting';
  if (tags.includes('textile')) return 'Textiles';
  return 'Decor';
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
    const html = await fetchHtml(url);
    let fields: ProductFields = html ? extractProductFromHtml(html, url) : { ...EMPTY_FIELDS };

    // If Tier 1 hit an anti-scrape wall, the extracted name/description are the
    // denial page, not the product. Discard them so the later tiers (and the AI
    // web_search fallback) get a clean shot instead of "winning" with garbage.
    const pageBlocked =
      looksLikeBotWall(html) ||
      looksLikeBotWall(fields.name) ||
      looksLikeBotWall(fields.description);
    if (pageBlocked) {
      fields = { ...EMPTY_FIELDS };
    }

    // Tier 2 — rendered DOM harvest, only when Tier 1 missed the essentials.
    if (!fields.name || !fields.image) {
      const rendered = await renderedExtract(url);
      fields = merge(fields, rendered);
      // The rendered DOM can be the same wall — don't let it back in.
      if (looksLikeBotWall(fields.name)) fields.name = '';
      if (looksLikeBotWall(fields.description)) fields.description = '';
    }

    // Tier 3 — AI (Claude + web_search), only when the result is still thin
    // (no name or no price). Cached + key-gated, so most scrapes never reach it.
    let aiConfidence: string | null = null;
    if (!fields.name || !fields.price) {
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
        };
      }
    }

    // Blocked page and nothing recovered: tell the user plainly and actionably,
    // rather than returning "Access to this page has been denied" as a product.
    if (pageBlocked && !fields.name && !fields.price && !fields.image) {
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

    let brand = fields.brand?.trim() || null;
    if (!brand) {
      try {
        const host = new URL(url).hostname.replace('www.', '').split('.')[0];
        brand = host.charAt(0).toUpperCase() + host.slice(1);
      } catch {
        brand = null;
      }
    }

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

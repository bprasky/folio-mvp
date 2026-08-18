/**
 * Shared product-field extraction (spec 17).
 *
 * The pure, fetch-free half of the product scraper: given page HTML it pulls the
 * product fields (JSON-LD Product first, then OpenGraph / Twitter / meta / title)
 * and derives lightweight enrichment (tags, category, materials, colors,
 * dimensions, formatted price).
 *
 * This lives in one module so every scrape surface runs the *same* extraction.
 * `/api/scrape-product` (the default cheerio + Browserless tiers) and the BQL
 * escalation rung (`/api/products/[productId]/scrape-bql`) both import from here,
 * so a flagged-domain scrape and a normal scrape cannot diverge in how a page
 * becomes a Product.
 */

import * as cheerio from 'cheerio';

export interface ProductFields {
  name: string | null;
  image: string | null;
  description: string | null;
  brand: string | null;
  price: string | null;
  currency: string | null;
}

export const EMPTY_FIELDS: ProductFields = {
  name: null,
  image: null,
  description: null,
  brand: null,
  price: null,
  currency: null,
};

/**
 * Render a value that may be an HTML fragment down to clean, single-spaced plain
 * text. Some retailers (e.g. Pottery Barn) put marked-up copy in their JSON-LD
 * `description`, which would otherwise land in the product description verbatim
 * as `<div class="column-left"><h3>Construction</h3>…`. Plain-text input passes
 * through unchanged (just whitespace-collapsed). Entities are decoded by cheerio.
 */
export function htmlToText(value: string | null | undefined): string | null {
  if (!value) return null;
  let text = value;
  if (value.includes('<')) {
    // Turn block boundaries into spaces first so adjacent blocks don't fuse
    // ("…glassConstruction…"), then let cheerio strip the remaining tags and
    // decode entities. Loading the fragment and reading the document root (not a
    // selector) avoids double-counting nested elements.
    const spaced = value
      .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|section|article)>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ');
    text = cheerio.load(spaced).root().text();
  }
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

/** Resolve a possibly-relative URL against the page URL; null if unusable. */
export function resolveUrl(src: string | undefined | null, base: string): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

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
 * cheerio multi-strategy extraction. JSON-LD Product schema is the gold standard;
 * OpenGraph / Twitter / meta tags and the page title fill anything missing.
 */
export function extractProductFromHtml(html: string, baseUrl: string): ProductFields {
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

  const description = htmlToText(
    (ld?.description && String(ld.description).trim()) ||
      meta('meta[property="og:description"]') ||
      meta('meta[name="twitter:description"]') ||
      meta('meta[name="description"]') ||
      null,
  );

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

  // NO finish is derived here. Reading schema.org `color`/`material` off the
  // JSON-LD node was tried and removed: probed against 15 real product URLs from
  // the corpus, only 6 pages carried a Product node at all, and both pages that
  // published a `color` published a WRONG one — "White" on a product named
  // "Veria Green Polished Marble Slab", and the string "Colors, Pink".
  //
  // A wrong finish is worse than an absent one. It is indistinguishable from an
  // observed fact once stored, it proposes nonsense to a designer who is trying
  // to trust the system, and it poisons the Material row it was meant to feed.
  // Finish now comes only from the AI tier, which is instructed to name the
  // vendor's own finish or return null rather than infer. See spec 21 delta D3.
  return { name, image, description, brand, price, currency };
}

export function formatPrice(amount: string | null, currency: string | null): string {
  if (!amount) return '$0.00';
  const num = parseFloat(String(amount).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num)) return String(amount);
  if (!currency || /usd|\$/i.test(currency)) return `$${num.toFixed(2)}`;
  return `${num.toFixed(2)} ${currency.toUpperCase()}`;
}

/** Parse a price string/amount into a plain number, or null when unusable. */
export function parsePriceNumber(amount: string | null | undefined): number | null {
  if (amount == null) return null;
  const num = parseFloat(String(amount).replace(/[^0-9.]/g, ''));
  return Number.isFinite(num) ? num : null;
}

export function extractDimensionsFromText(html: string): string {
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

export function extractMaterials(html: string, name: string): string[] {
  return keywordHits((html + ' ' + name).toLowerCase(), {
    marble: 'Marble', granite: 'Granite', porcelain: 'Porcelain', ceramic: 'Ceramic',
    glass: 'Glass', wood: 'Wood', metal: 'Metal', fabric: 'Fabric', stone: 'Stone',
    travertine: 'Travertine', limestone: 'Limestone', slate: 'Slate', quartzite: 'Quartzite',
  });
}

export function extractColors(html: string, name: string): string[] {
  return keywordHits((html + ' ' + name).toLowerCase(), {
    white: 'White', black: 'Black', gray: 'Gray', grey: 'Gray', brown: 'Brown',
    beige: 'Beige', blue: 'Blue', green: 'Green', red: 'Red', yellow: 'Yellow',
    gold: 'Gold', silver: 'Silver', bronze: 'Bronze', cream: 'Cream', ivory: 'Ivory',
    tan: 'Tan', charcoal: 'Charcoal',
  });
}

export function generateTags(name: string, description: string, url: string): string[] {
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

export function determineCategory(tags: string[], name: string): string {
  if (tags.some(t => ['tile', 'marble', 'mosaic'].includes(t))) return 'Tile & Stone';
  if (tags.some(t => ['chair', 'sofa', 'table', 'bed'].includes(t))) return 'Furniture';
  if (tags.includes('lighting')) return 'Lighting';
  if (tags.includes('textile')) return 'Textiles';
  return 'Decor';
}

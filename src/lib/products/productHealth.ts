/**
 * Product-data health check.
 *
 * A single, pure assessment of whether a product's fields look right — used at
 * scrape time (pre-flag a bad import), in the tagger (so a "re-scan" decision is
 * informed by *why* the data looks off), and on manual save / re-scrape (compare
 * before vs after so an edit that makes things worse can be caught).
 *
 * Two flag severities:
 *   - `missing`    — an expected field is empty.
 *   - `suspicious` — a field is present but looks wrong (raw HTML in the
 *                    description, a bot-wall/homepage name, a $0 price, …).
 *
 * Keep this dependency-light and deterministic so every surface assesses health
 * the same way and two reads are comparable.
 */

import { looksLikeBotWall } from '@/lib/browserless/classify';

export type ProductHealthSeverity = 'missing' | 'suspicious';
export type ProductHealthField =
  | 'name'
  | 'brand'
  | 'price'
  | 'image'
  | 'description';

export interface ProductHealthFlag {
  field: ProductHealthField;
  severity: ProductHealthSeverity;
  /** Short, designer-facing reason. */
  message: string;
}

export interface ProductHealthInput {
  name?: string | null;
  brand?: string | null;
  price?: number | string | null;
  imageUrl?: string | null;
  description?: string | null;
}

export interface ProductHealth {
  /** 0-100; higher is healthier. For comparing two reads, not for display math. */
  score: number;
  flags: ProductHealthFlag[];
  /** No missing or suspicious flags at all. */
  ok: boolean;
}

// A real tag opener (`<div`, `<p`, `</ul`, `<!--`) — not a stray "<" or "a < b".
const HTML_TAG = /<[a-z!/][^>]*>/i;
const PLACEHOLDER_NAMES = new Set(['', 'untitled product', 'product']);
// Generic store-front / landing titles a redirect leaves behind instead of a PDP.
const HOMEPAGE_NAME = /\b(home furniture|home decor|official site|shop all|home page)\b/i;

function toNumber(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function assessProductHealth(p: ProductHealthInput): ProductHealth {
  const flags: ProductHealthFlag[] = [];
  const name = (p.name ?? '').trim();
  const brand = (p.brand ?? '').trim();
  const description = (p.description ?? '').trim();
  const price = toNumber(p.price ?? null);

  // Name
  if (PLACEHOLDER_NAMES.has(name.toLowerCase())) {
    flags.push({ field: 'name', severity: 'missing', message: 'No real product name' });
  } else if (looksLikeBotWall(name) || HOMEPAGE_NAME.test(name)) {
    flags.push({ field: 'name', severity: 'suspicious', message: 'Name looks like a homepage or block page, not a product' });
  } else if (brand && name.toLowerCase() === brand.toLowerCase()) {
    flags.push({ field: 'name', severity: 'suspicious', message: 'Name is just the brand' });
  }

  // Image
  if (!p.imageUrl) {
    flags.push({ field: 'image', severity: 'missing', message: 'No image' });
  } else if (p.imageUrl.startsWith('data:')) {
    flags.push({ field: 'image', severity: 'suspicious', message: 'Image is an inline data URL, not a hosted link' });
  }

  // Price
  if (price == null) {
    flags.push({ field: 'price', severity: 'missing', message: 'No price' });
  } else if (price <= 0) {
    flags.push({ field: 'price', severity: 'suspicious', message: 'Price is zero or negative' });
  } else if (price > 1_000_000) {
    flags.push({ field: 'price', severity: 'suspicious', message: 'Price looks implausibly high' });
  }

  // Brand
  if (!brand) {
    flags.push({ field: 'brand', severity: 'missing', message: 'No brand' });
  }

  // Description
  if (!description) {
    flags.push({ field: 'description', severity: 'missing', message: 'No description' });
  } else if (HTML_TAG.test(description)) {
    flags.push({ field: 'description', severity: 'suspicious', message: 'Description contains raw HTML / code' });
  } else if (looksLikeBotWall(description)) {
    flags.push({ field: 'description', severity: 'suspicious', message: 'Description looks like a block / error page' });
  }

  // Suspicious flags hurt more than merely-missing ones.
  const penalty = flags.reduce((s, f) => s + (f.severity === 'suspicious' ? 20 : 12), 0);
  return { score: Math.max(0, 100 - penalty), flags, ok: flags.length === 0 };
}

/**
 * True when `next` is meaningfully worse than `prev` — a lower score AND either a
 * big drop or a brand-new suspicious flag on a field that was clean before. Used
 * to catch an edit/re-scrape that degraded the record so it can be flagged.
 */
export function isHealthRegression(prev: ProductHealth, next: ProductHealth): boolean {
  if (next.score >= prev.score) return false;
  const prevSuspicious = new Set(
    prev.flags.filter((f) => f.severity === 'suspicious').map((f) => f.field),
  );
  const newSuspicious = next.flags.some(
    (f) => f.severity === 'suspicious' && !prevSuspicious.has(f.field),
  );
  return newSuspicious || next.score <= prev.score - 20;
}

/**
 * Guided manual product capture — the fallback when a retailer blocks the
 * automated scraper (see /api/scrape-product returning `blocked: true`).
 *
 * A designer can paste the product copy or drop a screenshot; Claude turns it
 * into the same structured fields the scraper produces, which the tagger then
 * confirms and saves. Shared by /api/products/parse-text and parse-image so the
 * extraction prompt and normalization live in one place.
 */

import { anthropic, IMPORT_AGENT_CONFIG } from '@/lib/import-agent/config';

export type ParsedProductFields = {
  name: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  description: string | null;
  dimensions: string | null;
  materials: string[];
  colors: string[];
};

export const EMPTY_PARSED: ParsedProductFields = {
  name: null,
  brand: null,
  price: null,
  currency: null,
  description: null,
  dimensions: null,
  materials: [],
  colors: [],
};

export const PRODUCT_EXTRACTION_INSTRUCTION = `You extract one product's details so an interior designer can catalog it.
Return ONLY a single JSON object — no prose, no markdown fences — with exactly these keys:
{
  "name": string|null,
  "brand": string|null,
  "price": number|null,          // digits only, no currency symbol or commas; the main/base price
  "currency": string|null,       // e.g. "USD" if discernible
  "description": string|null,    // <= 300 characters, the product's own copy if present
  "dimensions": string|null,     // e.g. "32\\"W x 18\\"D x 30\\"H"
  "materials": string[],         // e.g. ["oak", "brass"]
  "colors": string[]
}
Rules: Use null (or [] for arrays) for anything not clearly present. NEVER invent a value — when in doubt, null. If several products appear, choose the single main one.`;

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string };
    };

/** Run the extraction model over arbitrary message content (text and/or image). */
export async function parseProductFromContent(
  content: AnthropicContentBlock[],
): Promise<ParsedProductFields> {
  const response = await anthropic.messages.create({
    model: IMPORT_AGENT_CONFIG.model,
    max_tokens: 1024,
    messages: [{ role: 'user', content }],
  });

  const raw = response.content
    .map(b => (b.type === 'text' ? b.text : ''))
    .join('\n');

  return normalize(raw);
}

function normalize(raw: string): ParsedProductFields {
  const obj = extractJsonObject(raw);
  if (!obj) return { ...EMPTY_PARSED };

  const str = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t.length ? t : null;
  };
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(x => str(x)).filter((x): x is string => !!x) : [];

  let price: number | null = null;
  if (typeof obj.price === 'number' && Number.isFinite(obj.price)) {
    price = obj.price;
  } else if (typeof obj.price === 'string') {
    const n = parseFloat(obj.price.replace(/[^0-9.]/g, ''));
    price = Number.isFinite(n) ? n : null;
  }

  return {
    name: str(obj.name),
    brand: str(obj.brand),
    price,
    currency: str(obj.currency),
    description: str(obj.description),
    dimensions: str(obj.dimensions),
    materials: strArr(obj.materials),
    colors: strArr(obj.colors),
  };
}

/** Pull the first balanced JSON object out of a model response (tolerates fences/prose). */
function extractJsonObject(raw: string): Record<string, any> | null {
  if (!raw) return null;
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === '{') depth++;
    else if (raw[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

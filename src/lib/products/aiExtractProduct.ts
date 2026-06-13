/**
 * aiExtractProduct — Tier 3 product extraction for the scraper.
 *
 * When the cheap tiers (cheerio + Browserless) come back thin, fall back to
 * Claude with the web_search tool to recover the fields that matter (name,
 * brand, price, description, dimensions). This mirrors the extractor used by
 * /api/import/product and shares its CachedProduct cache, so a URL is only ever
 * paid for once and the two surfaces stay consistent.
 *
 * Cost discipline: callers gate this behind an info threshold so most scrapes
 * (JSON-LD / OpenGraph pages) never reach it. No key configured → returns null,
 * and the scraper degrades to whatever the cheap tiers found.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { normalizeProductUrl } from '@/lib/products/normalizeProductUrl';

export interface AiProductFields {
  name: string | null;
  brand: string | null;
  vendorName: string | null;
  /** Numeric price in `currency`. */
  price: number | null;
  currency: string | null;
  description: string | null;
  materialType: string | null;
  style: string | null;
  dimensions: { width?: number; depth?: number; height?: number } | null;
  /** "high" | "medium" | "low" */
  confidence: string | null;
  /** True when served from CachedProduct rather than a fresh AI call. */
  cached: boolean;
}

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function buildPrompt(url: string): string {
  return `You are a product data extraction assistant. Search for and analyze this product URL to extract complete product information:

URL: ${url}

Search for and extract all available information about this product:
1. Product name/title (exact name from the product page)
2. Brand/manufacturer
3. Price (in USD, as a number without currency symbol)
4. SKU or model number
5. Product description (brief, 1-2 sentences)
6. Dimensions (width, depth, height in inches)
7. Vendor/retailer name (the website selling it)
8. Material type: classify as one of: stone, tile, wood, fabric, metal, lighting, appliance, furniture, other
9. Style: classify as one of: modern, traditional, transitional, industrial, coastal, farmhouse, minimalist, bohemian, contemporary, other

Return ONLY a valid JSON object with the extracted information:
{
  "title": "exact product name",
  "brand": "brand name",
  "vendorName": "retailer/website name",
  "sku": "SKU or model number",
  "price": 1299.00,
  "currency": "USD",
  "description": "brief product description",
  "dimensions": {
    "width": 84,
    "depth": 38,
    "height": 32
  },
  "materialType": "stone",
  "style": "modern",
  "confidence": "high"
}

If you cannot find specific information, omit that field rather than guessing.`;
}

export async function aiExtractProduct(url: string): Promise<AiProductFields | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const normalizedUrl = normalizeProductUrl(url);

  // 1. Cache hit — never pay twice for the same URL.
  try {
    const cached = await prisma.cachedProduct.findUnique({ where: { url: normalizedUrl } });
    if (cached) {
      return {
        name: cached.productName,
        brand: cached.brand,
        vendorName: cached.vendorName,
        price: cached.priceCents != null ? cached.priceCents / 100 : null,
        currency: cached.currency,
        description: cached.description,
        materialType: cached.materialType,
        style: cached.style,
        dimensions: {
          width: num(cached.widthIn),
          depth: num(cached.depthIn),
          height: num(cached.heightIn),
        },
        confidence: cached.extractionConfidence,
        cached: true,
      };
    }
  } catch (err) {
    console.error('[aiExtractProduct] cache read failed:', err);
    // proceed to AI extraction
  }

  // 2. AI extraction via web_search.
  let productData: any;
  try {
    const anthropic = new Anthropic();
    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: buildPrompt(url) }],
    });
    let text = '';
    for (const block of aiResponse.content) {
      if (block.type === 'text') text += block.text;
    }
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    productData = JSON.parse(match[0]);
  } catch (err) {
    console.error('[aiExtractProduct] AI call failed:', err);
    return null;
  }

  const price =
    typeof productData.price === 'number'
      ? productData.price
      : productData.price
        ? parseFloat(String(productData.price).replace(/[^0-9.]/g, '')) || null
        : null;

  const fields: AiProductFields = {
    name: productData.title ?? null,
    brand: productData.brand ?? null,
    vendorName: productData.vendorName ?? null,
    price,
    currency: productData.currency ?? 'USD',
    description: productData.description ?? null,
    materialType: productData.materialType ?? null,
    style: productData.style ?? null,
    dimensions: productData.dimensions ?? null,
    confidence: productData.confidence ?? 'medium',
    cached: false,
  };

  // 3. Write through to the shared cache (best-effort; ignore unique races).
  try {
    await prisma.cachedProduct.create({
      data: {
        url: normalizedUrl,
        productName: fields.name,
        brand: fields.brand,
        vendorName: fields.vendorName,
        sku: productData.sku || null,
        priceCents: fields.price != null ? Math.round(fields.price * 100) : null,
        currency: fields.currency || 'USD',
        description: fields.description,
        materialType: fields.materialType,
        style: fields.style,
        widthIn: productData.dimensions?.width ?? null,
        depthIn: productData.dimensions?.depth ?? null,
        heightIn: productData.dimensions?.height ?? null,
        extractionConfidence: fields.confidence || 'medium',
        aiResponse: productData,
      },
    });
  } catch (err: any) {
    if (err?.code !== 'P2002') {
      console.error('[aiExtractProduct] cache write failed:', err);
    }
  }

  return fields;
}

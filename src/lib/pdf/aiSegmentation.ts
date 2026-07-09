/**
 * AI Text Segmentation
 *
 * The gap-based clustering in clustering.ts collapses tightly-spaced spec sheets
 * (product lines only ~15px apart) into one giant blob, so every product merges
 * into a single item. This module instead hands the extracted PDF text to Claude
 * and asks it to split the page into individual products with structured fields —
 * robust across the varied layouts of real designer finish books.
 *
 * It returns plain data; the pipeline maps each product through
 * createExtractedItem so confidence scoring, stats, and the review UI are
 * unchanged.
 */

import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import type { SimpleTextBlock } from './extractText'
import type { ParsedDimensions } from './patterns'

const anthropic = new Anthropic()

export interface SegmentedProduct {
  productName: string | null
  brand: string | null
  vendor: string | null
  sku: string | null
  price: number | null // cents
  currency: string
  dimensions: ParsedDimensions | null
  material: string | null
  finish: string | null
  productUrl: string | null
  quantity: number | null
  room: string | null
  page: number
}

/**
 * Rebuild readable, line-ordered text from positioned blocks so the model sees
 * the page roughly as a human would: one line per row (blocks sharing a y are
 * joined), pages delimited. Product name + price often share a row, which is
 * exactly the association we want the model to see.
 */
function blocksToText(blocks: SimpleTextBlock[]): string {
  const byPage = new Map<number, SimpleTextBlock[]>()
  for (const b of blocks) {
    if (!b.text.trim()) continue
    if (!byPage.has(b.page)) byPage.set(b.page, [])
    byPage.get(b.page)!.push(b)
  }

  const out: string[] = []
  for (const page of Array.from(byPage.keys()).sort((a, b) => a - b)) {
    out.push(`--- Page ${page} ---`)
    const rows = byPage.get(page)!.slice().sort((a, b) => a.y - b.y || a.x - b.x)

    let line: string[] = []
    let lineY: number | null = null
    const flush = () => {
      if (line.length) out.push(line.join(' '))
      line = []
    }
    for (const b of rows) {
      if (lineY === null || Math.abs(b.y - lineY) <= 4) {
        line.push(b.text)
        if (lineY === null) lineY = b.y
      } else {
        flush()
        line.push(b.text)
        lineY = b.y
      }
    }
    flush()
  }
  return out.join('\n')
}

const SYSTEM_PROMPT = `You are a data-extraction assistant for interior-design finish schedules and spec sheets. You are given raw text extracted from a PDF (one product's details may span several lines; room names like "KITCHEN" or "PRIMARY BATHROOM" head the products that follow them).

Split the text into individual products and return ONLY a JSON array (no prose, no markdown fences). One object per distinct product, in reading order:

[
  {
    "productName": string | null,   // the product's name, without the brand prefix or price
    "brand": string | null,          // manufacturer/brand (e.g. "Arcaww", "Progress Lighting")
    "vendor": string | null,         // seller if different from brand, else same as brand
    "sku": string | null,            // model/SKU number if present
    "price": number | null,          // in CENTS (e.g. $111.00 -> 11100). "Price on request" -> null
    "currency": string,              // "USD" unless clearly otherwise
    "dimensions": { "width": number|null, "depth": number|null, "height": number|null, "length": number|null, "diameter": number|null, "unit": "inches"|"cm" } | null,
    "material": string | null,       // e.g. "Marble", "Glass"
    "finish": string | null,         // e.g. "Honed", "Polished"
    "productUrl": string | null,     // full URL if present; a bare domain like "arcaww.com" is NOT a product URL -> null
    "quantity": number | null,
    "room": string | null,           // nearest room header above this product
    "page": number                   // page number the product appears on
  }
]

Rules:
- Only use information present in the text. Do NOT invent brands, prices, SKUs, dimensions, or URLs.
- Exclude document headers/footers (titles, "Generated <date>", item/room counts).
- If a value isn't present, use null.
- Return [] if there are no products.`

/**
 * Segment extracted PDF text into individual products via Claude.
 * Returns [] on any failure so the caller can fall back to the legacy path.
 */
export async function segmentProductsFromText(
  blocks: SimpleTextBlock[]
): Promise<SegmentedProduct[]> {
  const text = blocksToText(blocks)
  if (text.replace(/--- Page \d+ ---/g, '').trim().length < 3) return []

  try {
    const response = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Extract the products from this PDF text:\n\n${text}` }],
    })

    const content = response.content[0]
    if (content.type !== 'text') return []

    let json = content.text.trim()
    if (json.startsWith('```')) {
      json = json.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
    }
    // Be tolerant of any stray prose around the array.
    const start = json.indexOf('[')
    const end = json.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    json = json.slice(start, end + 1)

    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []

    return parsed.map((p: Record<string, unknown>) => normalizeProduct(p))
  } catch (err) {
    console.warn('[aiSegmentation] segmentation failed:', (err as Error)?.message)
    return []
  }
}

/** Coerce a model-returned object into a well-typed SegmentedProduct. */
function normalizeProduct(p: Record<string, unknown>): SegmentedProduct {
  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : null
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null

  const dimsRaw = p.dimensions as Record<string, unknown> | null | undefined
  const dimensions: ParsedDimensions | null = dimsRaw
    ? {
        width: num(dimsRaw.width),
        depth: num(dimsRaw.depth),
        height: num(dimsRaw.height),
        length: num(dimsRaw.length),
        diameter: num(dimsRaw.diameter),
        unit: dimsRaw.unit === 'cm' ? 'cm' : 'inches',
      }
    : null
  // Drop a dimensions object with no actual measurements.
  const hasDim =
    dimensions &&
    (dimensions.width ?? dimensions.depth ?? dimensions.height ?? dimensions.length ?? dimensions.diameter) !== null

  const brand = str(p.brand)
  return {
    productName: str(p.productName),
    brand,
    vendor: str(p.vendor) ?? brand,
    sku: str(p.sku),
    price: num(p.price),
    currency: str(p.currency) ?? 'USD',
    dimensions: hasDim ? dimensions : null,
    material: str(p.material),
    finish: str(p.finish),
    productUrl: str(p.productUrl),
    quantity: num(p.quantity),
    room: str(p.room),
    page: num(p.page) ?? 1,
  }
}

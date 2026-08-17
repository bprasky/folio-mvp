/**
 * What extraction proposes as a product's finish (spec 21 delta D3).
 *
 * `CachedProduct.finish` is what the URL says the product is, shared across every
 * designer. `ProductTag.finishRaw` is what one designer specified in one room.
 * They are different facts: a product page with a finish selector gives
 * extraction the default variant while the designer specified the third option
 * down. Extraction proposes, the tag records, and the tag always wins.
 *
 * This module exists so the three PROPOSE call sites in D3's table — the two
 * auto-tag paths and the generated-image path — resolve a proposal identically.
 * Three inline copies of this join would drift, which is the failure this
 * codebase has already paid for elsewhere.
 *
 * Never throws. A proposal is a convenience; failing to find one must not fail
 * the tag write that carries the actual specification.
 */

import { prisma } from '@/lib/prisma';
import { normalizeProductUrl } from '@/lib/products/normalizeProductUrl';

/**
 * Resolve proposed finishes for a set of products in two queries, regardless of
 * how many products are asked for.
 *
 * Returns a Map keyed by productId. A product with no URL, no cached row, or no
 * extracted finish is simply absent from the map — callers should treat a miss
 * as NULL rather than as an error.
 */
export async function proposedFinishByProductId(
  productIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (ids.length === 0) return out;

  try {
    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, url: true },
    });

    // Normalize once, and keep the reverse mapping so a cached row can be
    // attributed back to every product that shares its URL.
    const idsByUrl = new Map<string, string[]>();
    for (const p of products) {
      if (!p.url) continue;
      let normalized: string;
      try {
        normalized = normalizeProductUrl(p.url);
      } catch {
        continue;
      }
      const bucket = idsByUrl.get(normalized);
      if (bucket) bucket.push(p.id);
      else idsByUrl.set(normalized, [p.id]);
    }
    if (idsByUrl.size === 0) return out;

    const cached = await prisma.cachedProduct.findMany({
      where: { url: { in: Array.from(idsByUrl.keys()) } },
      select: { url: true, finish: true },
    });

    for (const row of cached) {
      const finish = row.finish?.trim();
      if (!finish) continue;
      for (const id of idsByUrl.get(row.url) ?? []) out.set(id, finish);
    }
  } catch (err) {
    console.error('[proposedFinish] lookup failed:', err);
    // Fall through with whatever resolved. A missing proposal writes NULL.
  }

  return out;
}

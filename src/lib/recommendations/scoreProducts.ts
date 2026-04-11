/**
 * Product Recommendation Scoring Engine
 *
 * Consumes TasteInference records to score candidate products.
 * Uses attribute matching with type-specific weights:
 *   material: 1.5, style: 1.2, color: 0.8, brand: 1.0, room: 0.6
 *
 * Excludes products the user has already saved or tagged.
 */

import { prisma } from '@/lib/prisma';

// Attribute type weights — how much each type contributes to match score
const ATTRIBUTE_WEIGHTS: Record<string, number> = {
  material: 1.5,
  style: 1.2,
  brand: 1.0,
  color: 0.8,
  room: 0.6,
  shape: 0.7,
};

export interface ScoredProduct {
  productId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  category: string | null;
  score: number;
  matchReasons: { attribute: string; type: string; confidence: number }[];
}

/**
 * Score products for a user based on their taste inferences.
 * Returns top N products sorted by match score, excluding already-engaged products.
 */
export async function getRecommendedProducts(
  userId: string,
  limit: number = 24,
): Promise<ScoredProduct[]> {
  // 1. Get user's taste inferences (confirmed or high-confidence)
  const inferences = await prisma.tasteInference.findMany({
    where: {
      userId,
      OR: [
        { confirmedByUser: true },
        { confidence: { gte: 0.6 } },
      ],
      // Exclude dismissed inferences
      dismissedAt: null,
    },
    select: {
      attribute: true,
      attributeType: true,
      confidence: true,
    },
    orderBy: { confidence: 'desc' },
  });

  if (inferences.length === 0) {
    return [];
  }

  // 2. Get products the user has already engaged with (exclude from results)
  const [savedProductIds, taggedProductIds] = await Promise.all([
    prisma.save.findMany({
      where: { userId },
      select: { productId: true },
    }).then(saves => saves.map(s => s.productId)),
    prisma.productTag.findMany({
      where: {
        image: {
          project: {
            OR: [{ designerId: userId }, { ownerId: userId }],
          },
        },
      },
      select: { productId: true },
    }).then(tags => [...new Set(tags.map(t => t.productId))]),
  ]);

  const excludeIds = new Set([...savedProductIds, ...taggedProductIds]);

  // 3. Build attribute lookup for scoring
  const attributeMap = new Map<string, { type: string; confidence: number }>();
  for (const inf of inferences) {
    const key = inf.attribute.toLowerCase();
    if (!attributeMap.has(key) || inf.confidence > attributeMap.get(key)!.confidence) {
      attributeMap.set(key, { type: inf.attributeType, confidence: inf.confidence });
    }
  }

  // 4. Get candidate products from CachedProduct (richer data for matching)
  const candidates = await prisma.cachedProduct.findMany({
    where: {
      // Only products with enough data to match
      OR: [
        { materialType: { not: null } },
        { style: { not: null } },
        { tags: { isEmpty: false } },
        { categories: { isEmpty: false } },
      ],
    },
    select: {
      id: true,
      url: true,
      productName: true,
      brand: true,
      imageUrl: true,
      materialType: true,
      style: true,
      tags: true,
      categories: true,
      colorPalette: true,
    },
    take: 500, // Candidate pool
  });

  // 5. Find the Product IDs linked to these CachedProducts
  const urls = candidates.map(c => c.url).filter(Boolean);
  const productsByUrl = await prisma.product.findMany({
    where: { url: { in: urls } },
    select: { id: true, url: true, name: true, brand: true, imageUrl: true, category: true },
  });
  const urlToProduct = new Map(productsByUrl.map(p => [p.url!, p]));

  // 6. Score each candidate
  const scored: ScoredProduct[] = [];

  for (const candidate of candidates) {
    const product = urlToProduct.get(candidate.url);
    if (!product || excludeIds.has(product.id)) continue;

    let score = 0;
    const matchReasons: ScoredProduct['matchReasons'] = [];

    // Match material type
    if (candidate.materialType) {
      const matKey = candidate.materialType.toLowerCase();
      const match = attributeMap.get(matKey);
      if (match) {
        const weight = ATTRIBUTE_WEIGHTS[match.type] || 1.0;
        const contribution = match.confidence * weight;
        score += contribution;
        matchReasons.push({ attribute: candidate.materialType, type: 'material', confidence: match.confidence });
      }
    }

    // Match style
    if (candidate.style) {
      const styleKey = candidate.style.toLowerCase();
      const match = attributeMap.get(styleKey);
      if (match) {
        const weight = ATTRIBUTE_WEIGHTS[match.type] || 1.0;
        score += match.confidence * weight;
        matchReasons.push({ attribute: candidate.style, type: 'style', confidence: match.confidence });
      }
    }

    // Match tags
    for (const tag of candidate.tags) {
      const tagKey = tag.toLowerCase();
      const match = attributeMap.get(tagKey);
      if (match) {
        const weight = ATTRIBUTE_WEIGHTS[match.type] || 0.5;
        score += match.confidence * weight * 0.5; // Tags get half weight to avoid domination
        matchReasons.push({ attribute: tag, type: match.type, confidence: match.confidence });
      }
    }

    // Match categories
    for (const cat of candidate.categories) {
      const catKey = cat.toLowerCase();
      const match = attributeMap.get(catKey);
      if (match) {
        score += match.confidence * (ATTRIBUTE_WEIGHTS.room || 0.6);
        matchReasons.push({ attribute: cat, type: 'category', confidence: match.confidence });
      }
    }

    // Match colors from palette
    if (Array.isArray(candidate.colorPalette)) {
      for (const color of candidate.colorPalette as string[]) {
        if (typeof color !== 'string') continue;
        const colorKey = color.toLowerCase();
        const match = attributeMap.get(colorKey);
        if (match) {
          score += match.confidence * (ATTRIBUTE_WEIGHTS.color || 0.8);
          matchReasons.push({ attribute: color, type: 'color', confidence: match.confidence });
        }
      }
    }

    if (score > 0) {
      scored.push({
        productId: product.id,
        name: product.name || candidate.productName || 'Unknown Product',
        brand: product.brand || candidate.brand,
        imageUrl: product.imageUrl || candidate.imageUrl,
        category: product.category,
        score,
        matchReasons: matchReasons.slice(0, 3), // Top 3 reasons
      });
    }
  }

  // 7. Sort by score descending, return top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

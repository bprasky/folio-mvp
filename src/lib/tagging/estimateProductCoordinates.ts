import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export type ProductLocation = {
  description: string;
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  confidence: 'high' | 'medium' | 'low';
};

/**
 * Uses Claude's vision API to estimate where products appear in an interior
 * design image. Returns x,y coordinates as percentages (0-100).
 *
 * If a list of product names is provided, the model will try to match detected
 * items against those names and return coordinates only for matched products.
 * Otherwise returns all detected products.
 */
export async function estimateProductCoordinates(
  imageUrl: string,
  productNames?: string[]
): Promise<ProductLocation[]> {
  try {
    const matchClause = productNames?.length
      ? `\nIMPORTANT: Match each detection against these known products and use the EXACT product name from the list when there is a match:\n${productNames.map((n) => `- "${n}"`).join('\n')}\nIf a product from the list is not visible, do not include it. If you see something not in the list, include it with your own description.`
      : '';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: imageUrl },
            },
            {
              type: 'text',
              text: `Analyze this interior design photo. For each identifiable product (furniture, fixtures, appliances, lighting, rugs, art, materials), provide its approximate center location in the image.

Coordinates should be percentages where (0,0) is top-left and (100,100) is bottom-right.
${matchClause}
Return ONLY a valid JSON array:
[{"description": "marble countertop", "x": 50, "y": 60, "confidence": "high"}]

Be precise with coordinates — place the dot where the center of the product is in the image. Return up to 10 products, prioritizing the most prominent items.`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      console.warn('[estimateProductCoordinates] No JSON array in response');
      return [];
    }

    const parsed: any[] = JSON.parse(jsonMatch[0]);

    return parsed
      .filter(
        (item) =>
          typeof item.x === 'number' &&
          typeof item.y === 'number' &&
          typeof item.description === 'string'
      )
      .map((item) => ({
        description: item.description,
        x: clamp(item.x, 5, 95), // keep dots away from edges
        y: clamp(item.y, 5, 95),
        confidence: (['high', 'medium', 'low'] as const).includes(item.confidence)
          ? item.confidence
          : 'medium',
      }));
  } catch (error) {
    console.error('[estimateProductCoordinates] Vision API error:', error);
    return [];
  }
}

/**
 * Given a list of product names to tag onto an image and detected locations,
 * match each product to its best-matching detection by fuzzy name similarity.
 *
 * Returns an array of coordinates in the same order as `productNames`.
 * Products without a match get evenly-distributed fallback positions.
 */
export function matchProductsToLocations(
  productNames: string[],
  detections: ProductLocation[]
): Array<{ x: number; y: number }> {
  const used = new Set<number>();
  const results: Array<{ x: number; y: number }> = [];

  for (const name of productNames) {
    const nameLower = name.toLowerCase();
    let bestIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < detections.length; i++) {
      if (used.has(i)) continue;
      const score = fuzzyScore(nameLower, detections[i].description.toLowerCase());
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    // Require a minimum similarity threshold
    if (bestIdx >= 0 && bestScore >= 0.3) {
      used.add(bestIdx);
      results.push({ x: detections[bestIdx].x, y: detections[bestIdx].y });
    } else {
      // Will be replaced with fallback positions below
      results.push({ x: -1, y: -1 });
    }
  }

  // Fill in fallback positions for unmatched products
  const unmatchedCount = results.filter((r) => r.x === -1).length;
  if (unmatchedCount > 0) {
    const fallback = computeFallbackPositions(unmatchedCount);
    let fi = 0;
    for (let i = 0; i < results.length; i++) {
      if (results[i].x === -1) {
        results[i] = fallback[fi++];
      }
    }
  }

  return results;
}

/** Evenly-distributed fallback positions (same logic as original computeTagPositions) */
export function computeFallbackPositions(count: number): Array<{ x: number; y: number }> {
  if (count === 1) return [{ x: 50, y: 50 }];

  const yCenter = 50;
  const padding = 15;
  const span = 100 - 2 * padding;
  const positions: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < count; i++) {
    const x = padding + (span * i) / (count - 1);
    positions.push({ x: Math.round(x * 100) / 100, y: yCenter });
  }
  return positions;
}

/** Simple word-overlap fuzzy scoring (0-1) */
function fuzzyScore(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
    // partial match: check if any word in B contains this word or vice versa
    else {
      for (const wb of wordsB) {
        if (wb.includes(w) || w.includes(wb)) {
          overlap += 0.5;
          break;
        }
      }
    }
  }

  const total = Math.max(wordsA.size, wordsB.size);
  return total > 0 ? overlap / total : 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

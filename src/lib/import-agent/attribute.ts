import { anthropic, IMPORT_AGENT_CONFIG, IMPORT_AGENT_SYSTEM } from './config';
import type { DetectedProduct, ProductAttribution, ConfidenceLevel } from './types';

/**
 * Search for product attribution using Claude's web search capability
 */
export async function searchProductAttribution(
  product: DetectedProduct,
  designerContext?: { preferredVendors?: string[] }
): Promise<ProductAttribution[]> {
  try {
    const response = await anthropic.messages.create({
      model: IMPORT_AGENT_CONFIG.model,
    thinking: { type: 'disabled' },
      max_tokens: IMPORT_AGENT_CONFIG.maxTokens,
      system: IMPORT_AGENT_SYSTEM,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Find the product source for this interior design item:

Description: ${product.description}
Category: ${product.category}
Search query: ${product.searchQuery}
${designerContext?.preferredVendors?.length ? `Preferred vendors: ${designerContext.preferredVendors.join(', ')}` : ''}

Search for this product and return up to ${IMPORT_AGENT_CONFIG.searchResultsPerProduct} potential matches.
Prioritize:
1. Exact product matches from reputable design vendors
2. Similar products from known brands
3. Generic category matches

Return ONLY a valid JSON object:
{
  "attributions": [
    {
      "productUrl": "full URL to product page",
      "vendorName": "vendor/brand name",
      "productName": "product name",
      "price": "price if found, otherwise null",
      "confidence": "high" | "medium" | "low",
      "matchReason": "why this matches the description"
    }
  ]
}`,
        },
      ],
    });

    // Extract text from response (may include tool use results)
    let text = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      }
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.attributions || [])
        .map(validateAttribution)
        .filter(Boolean) as ProductAttribution[];
    }

    return [];
  } catch (error) {
    console.error('Product attribution search failed:', error);
    return [];
  }
}

/**
 * Search attributions for multiple products in batch (for efficiency)
 */
export async function searchProductAttributionsBatch(
  products: DetectedProduct[],
  designerContext?: { preferredVendors?: string[] }
): Promise<Map<number, ProductAttribution[]>> {
  const results = new Map<number, ProductAttribution[]>();

  // Process in parallel with concurrency limit
  const BATCH_SIZE = 3;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const promises = batch.map((product, idx) =>
      searchProductAttribution(product, designerContext)
        .then(attrs => ({ index: i + idx, attrs }))
        .catch(() => ({ index: i + idx, attrs: [] }))
    );

    const batchResults = await Promise.all(promises);
    for (const { index, attrs } of batchResults) {
      results.set(index, attrs);
    }
  }

  return results;
}

// Validation helper
function validateAttribution(attr: unknown): ProductAttribution | null {
  if (!attr || typeof attr !== 'object') return null;

  const a = attr as Record<string, unknown>;
  const validConfidence: ConfidenceLevel[] = ['high', 'medium', 'low'];

  if (typeof a.productUrl !== 'string' || !a.productUrl) return null;
  if (typeof a.vendorName !== 'string' || !a.vendorName) return null;
  if (typeof a.productName !== 'string' || !a.productName) return null;

  return {
    productUrl: a.productUrl,
    vendorName: a.vendorName,
    productName: a.productName,
    price: typeof a.price === 'string' ? a.price : undefined,
    confidence: validConfidence.includes(a.confidence as ConfidenceLevel)
      ? (a.confidence as ConfidenceLevel)
      : 'low',
    matchReason: typeof a.matchReason === 'string' ? a.matchReason : 'Potential match',
  };
}

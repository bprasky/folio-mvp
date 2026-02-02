/**
 * Calculates a "readiness score" for image generation based on room selections.
 * Higher scores indicate more context for better AI-generated results.
 */

export type SelectionForScoring = {
  photo?: string | null;
  vendorName?: string | null;
  productName?: string | null;
  colorFinish?: string | null;
  tags?: string[];
  unitPrice?: number | null;
  productUrl?: string | null;
};

export type ReadinessResult = {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high';
  message: string;
  suggestions: string[];
  breakdown: {
    itemCount: { score: number; max: number };
    withImages: { score: number; max: number };
    withDetails: { score: number; max: number };
    withCategories: { score: number; max: number };
  };
};

// Weights for different factors
const WEIGHTS = {
  ITEM_COUNT: 25,      // Having enough items
  WITH_IMAGES: 35,     // Items with photos (most important for visual AI)
  WITH_DETAILS: 25,    // Items with brand/color/finish
  WITH_CATEGORIES: 15, // Items with category tags
};

// Thresholds
const MIN_ITEMS_FOR_FULL_SCORE = 5;
const IDEAL_ITEMS = 8;

/**
 * Calculate readiness score for a room's selections
 */
export function calculateReadinessScore(selections: SelectionForScoring[]): ReadinessResult {
  const itemCount = selections.length;

  if (itemCount === 0) {
    return {
      score: 0,
      level: 'low',
      message: 'Add items to your room to generate images',
      suggestions: ['Add at least 3-5 products to get started'],
      breakdown: {
        itemCount: { score: 0, max: WEIGHTS.ITEM_COUNT },
        withImages: { score: 0, max: WEIGHTS.WITH_IMAGES },
        withDetails: { score: 0, max: WEIGHTS.WITH_DETAILS },
        withCategories: { score: 0, max: WEIGHTS.WITH_CATEGORIES },
      },
    };
  }

  // Count items with each quality factor
  const withImages = selections.filter(s => s.photo && s.photo.length > 0).length;
  const withDetails = selections.filter(s =>
    (s.vendorName && s.vendorName.length > 0) ||
    (s.colorFinish && s.colorFinish.length > 0)
  ).length;
  const withCategories = selections.filter(s => s.tags && s.tags.length > 0).length;

  // Calculate sub-scores (0-1 range)
  const itemCountRatio = Math.min(itemCount / MIN_ITEMS_FOR_FULL_SCORE, 1);
  const imageRatio = itemCount > 0 ? withImages / itemCount : 0;
  const detailsRatio = itemCount > 0 ? withDetails / itemCount : 0;
  const categoryRatio = itemCount > 0 ? withCategories / itemCount : 0;

  // Calculate weighted scores
  const breakdown = {
    itemCount: {
      score: Math.round(itemCountRatio * WEIGHTS.ITEM_COUNT),
      max: WEIGHTS.ITEM_COUNT
    },
    withImages: {
      score: Math.round(imageRatio * WEIGHTS.WITH_IMAGES),
      max: WEIGHTS.WITH_IMAGES
    },
    withDetails: {
      score: Math.round(detailsRatio * WEIGHTS.WITH_DETAILS),
      max: WEIGHTS.WITH_DETAILS
    },
    withCategories: {
      score: Math.round(categoryRatio * WEIGHTS.WITH_CATEGORIES),
      max: WEIGHTS.WITH_CATEGORIES
    },
  };

  const totalScore =
    breakdown.itemCount.score +
    breakdown.withImages.score +
    breakdown.withDetails.score +
    breakdown.withCategories.score;

  // Generate suggestions based on what's missing
  const suggestions: string[] = [];

  if (itemCount < MIN_ITEMS_FOR_FULL_SCORE) {
    suggestions.push(`Add ${MIN_ITEMS_FOR_FULL_SCORE - itemCount} more items for better results`);
  }

  if (imageRatio < 0.7) {
    const needImages = Math.ceil(itemCount * 0.7) - withImages;
    if (needImages > 0) {
      suggestions.push(`Add images to ${needImages} more item${needImages > 1 ? 's' : ''}`);
    }
  }

  if (detailsRatio < 0.5) {
    suggestions.push('Add brand names or colors to your items');
  }

  // Determine level and message
  let level: 'low' | 'medium' | 'high';
  let message: string;

  if (totalScore >= 75) {
    level = 'high';
    message = 'Great context! Your generated images should closely match your vision.';
  } else if (totalScore >= 50) {
    level = 'medium';
    message = 'Good start, but adding more details could improve results.';
  } else {
    level = 'low';
    message = 'Limited context may result in less accurate images.';
  }

  return {
    score: totalScore,
    level,
    message,
    suggestions: suggestions.slice(0, 3), // Max 3 suggestions
    breakdown,
  };
}

/**
 * Quick check if generation should show a warning
 */
export function shouldWarnBeforeGeneration(score: number): boolean {
  return score < 60;
}

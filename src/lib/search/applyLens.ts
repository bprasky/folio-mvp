import { Lens } from './lenses';
import { MomentResult } from './searchMoments';

/**
 * Calculate lens score for a moment
 */
function calculateLensScore(moment: MomentResult, lens: Lens): number {
  let score = 1.0; // Base score
  
  // Apply tag boosts
  if (lens.weights.tagBoost) {
    for (const boostTag of lens.weights.tagBoost) {
      const lowerBoostTag = boostTag.toLowerCase();
      for (const momentTag of moment.tags) {
        const lowerMomentTag = momentTag.toLowerCase();
        if (lowerMomentTag.includes(lowerBoostTag) || lowerBoostTag.includes(lowerMomentTag)) {
          score += 2.0; // Strong boost for matching tags
        }
      }
    }
  }
  
  // Apply tag suppression
  if (lens.weights.tagSuppress) {
    for (const suppressTag of lens.weights.tagSuppress) {
      const lowerSuppressTag = suppressTag.toLowerCase();
      for (const momentTag of moment.tags) {
        const lowerMomentTag = momentTag.toLowerCase();
        if (lowerMomentTag.includes(lowerSuppressTag) || lowerSuppressTag.includes(lowerMomentTag)) {
          score *= 0.3; // Reduce score for suppressed tags
        }
      }
    }
  }
  
  // Apply space filter
  if (lens.weights.spaceFilter) {
    let spaceMatch = false;
    for (const spaceFilter of lens.weights.spaceFilter) {
      const lowerSpaceFilter = spaceFilter.toLowerCase();
      for (const momentTag of moment.tags) {
        const lowerMomentTag = momentTag.toLowerCase();
        if (lowerMomentTag.includes(lowerSpaceFilter) || lowerSpaceFilter.includes(lowerMomentTag)) {
          spaceMatch = true;
          break;
        }
      }
    }
    if (!spaceMatch) {
      score *= 0.1; // Heavily penalize non-matching spaces
    } else {
      score += 1.5; // Boost matching spaces
    }
  }
  
  // Apply material filter
  if (lens.weights.materialFilter) {
    let materialMatch = false;
    for (const materialFilter of lens.weights.materialFilter) {
      const lowerMaterialFilter = materialFilter.toLowerCase();
      for (const momentTag of moment.tags) {
        const lowerMomentTag = momentTag.toLowerCase();
        if (lowerMomentTag.includes(lowerMaterialFilter) || lowerMaterialFilter.includes(lowerMomentTag)) {
          materialMatch = true;
          break;
        }
      }
    }
    if (!materialMatch) {
      score *= 0.1; // Heavily penalize non-matching materials
    } else {
      score += 1.5; // Boost matching materials
    }
  }
  
  // Apply style vector similarity (if available)
  if (lens.weights.styleVector && lens.weights.styleVector.length > 0) {
    // TODO: Implement vector similarity calculation
    // For now, this is a placeholder
    // In production, would calculate cosine similarity between moment embedding and style vector
  }
  
  return score;
}

/**
 * Apply a lens to re-weight and re-order moments
 * This modifies the result ordering without re-querying
 */
export function applyLens(
  moments: MomentResult[],
  lens: Lens
): MomentResult[] {
  return moments
    .map(moment => ({
      ...moment,
      lensScore: calculateLensScore(moment, lens),
    }))
    .sort((a, b) => {
      // Sort by combined score: lens score + relevance + engagement
      const scoreA = (a.lensScore || 1.0) * a.relevanceScore * 2 + a.engagementScore * 0.1;
      const scoreB = (b.lensScore || 1.0) * b.relevanceScore * 2 + b.engagementScore * 0.1;
      return scoreB - scoreA;
    })
    .map(({ lensScore, ...moment }) => moment); // Remove lensScore from output
}

/**
 * Apply multiple lenses in sequence (for compound filtering)
 */
export function applyLenses(
  moments: MomentResult[],
  lenses: Lens[]
): MomentResult[] {
  let result = moments;
  for (const lens of lenses) {
    result = applyLens(result, lens);
  }
  return result;
}


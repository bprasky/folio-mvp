/**
 * Directory System
 * Merit-based ranking and discovery layer for designers and vendors
 *
 * @module @/lib/directory
 */

// Types
export * from './types';

// Score Calculation
export {
  calculateDesignerScores,
  calculateVendorScores,
  calculateDesignerTotalScore,
  calculateVendorTotalScore,
  generateDesignerSuggestions,
} from './scoring';

// Eligibility
export {
  isDesignerDirectoryEligible,
  isVendorDirectoryEligible,
  getDesignerEligibilityStatus,
  getVendorEligibilityStatus,
  calculatePotentialRank,
  updateAllDesignerEligibility,
} from './eligibility';

// Ranking Management
export {
  updateDesignerRanking,
  updateVendorRanking,
  recalculateRanks,
  getRisingDesigners,
  getRisingVendors,
  batchRecalculateDesignerRankings,
  batchRecalculateVendorRankings,
} from './ranking';

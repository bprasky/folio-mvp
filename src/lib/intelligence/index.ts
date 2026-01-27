/**
 * Intelligence System
 *
 * Folio's intelligence system transforms passive engagement into structured
 * taste data, then uses that data to create value for all participants.
 *
 * See docs/12_INTELLIGENCE_SYSTEM.md for full specification.
 *
 * Layers:
 * 1. Signal Capture - Likes, saves, views, tags
 * 2. Pattern Inference - Silent detection of taste patterns
 * 3. Insight Confirmation - User confirms/denies detected patterns
 * 4. Personalized Content - Different content for likes vs saves
 * 5. User Profile & Self-Discovery - Taste profile dashboard
 * 6. Designer Ecosystem - Welcome back, supplemental quotes, trends
 * 7. Vendor Insights & Monetization - Analytics and targeted content
 */

// Types
export * from './types';

// Signal capture (Layer 1)
export {
  recordLike,
  removeLike,
  recordSave,
  removeSave,
  getUserLikes,
  getUserSaves,
  hasUserLiked,
  hasUserSaved,
  getProductEngagement,
  getProductAttributes,
} from './signals';

// Pattern detection (Layer 2)
export {
  detectTastePatterns,
  queuePatternDetection,
  getPendingInferences,
  confirmInference,
  getConfirmedTastes,
} from './patterns';

// Designer matching (Layer 5)
export {
  matchDesigners,
  getDesignerCompatibility,
  updateUserFingerprintVector,
} from './matching';

// Supplemental quotes (Layer 6)
export {
  addSupplementalQuote,
  getPostSupplementalQuotes,
  getProductTagQuotes,
  updateSupplementalQuote,
  deleteSupplementalQuote,
  getProjectEngagement,
} from './quotes';

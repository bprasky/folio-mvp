/**
 * Feature flags for Folio MVP
 * All flags default to OFF unless explicitly enabled via environment variables
 */

export const featureFlags = {
  // Force enabled for development - change to env check for production
  festivalVitalityUI: true, // process.env.NEXT_PUBLIC_FEATURE_FESTIVAL_VITALITY_UI === 'true',
} as const;

export type FeatureFlags = typeof featureFlags;


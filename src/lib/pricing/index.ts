/**
 * Pricing Module
 *
 * Central export point for all pricing-related functionality.
 */

// Tier configuration and helpers
export {
  TIER_CONFIGS,
  TIER_FEATURES,
  TIER_ORDER,
  ROI_ASSUMPTIONS,
  COMPETITIVE_BENCHMARKS,
  getTierConfig,
  getTierFeatures,
  hasFeature,
  getTierLimit,
  isUnlimited,
  compareTiers,
  isHigherTier,
  isLowerTier,
  isPaidTier,
  isTeamTier,
  getNextUpgradeTier,
  canAccessFeature,
  getMinimumTierForFeature,
  calculateMonthlyROI,
  type SubscriptionTierType,
  type TierPricing,
  type TierLimits,
  type TierFeature,
  type TierConfig,
} from './tiers';

// Subscription service
export {
  getSubscriptionStatus,
  getUserSubscription,
  getUserSubscriptionWithUsage,
  getSubscriptionUsage,
  checkFeatureAccess,
  checkLimit,
  getUpgradePrompt,
  compareTiers as compareTiersForUpgrade,
  updateSubscriptionTier,
  canCreateProject,
  canInviteTeamMember,
  canUseAIEditorial,
} from './subscription-service';

// Founding Designer Program
export {
  FOUNDING_DESIGNER_CONFIG,
  isFoundingDesigner,
  getFoundingDesignerInfo,
  getFoundingDesignerCapacity,
  isEligibleForFoundingProgram,
  enrollFoundingDesigner,
  checkFoundingDesignerCompliance,
  listFoundingDesigners,
} from './founding-designer';

// Type definitions
export type {
  SubscriptionStatus,
  UserSubscription,
  SubscriptionUsage,
  FoundingDesignerInfo,
  SubscriptionChangeRequest,
  BillingInfo,
  FeatureAccessResult,
  TierComparison,
  ClientAccessInfo,
  ClientPermissions,
  UpgradeTrigger,
  UpgradePromptData,
  SubscriptionEventType,
  SubscriptionEvent,
  RevenueStreamType,
  PricingApiResponse,
  SubscriptionApiResponse,
  UpgradeApiResponse,
} from './types';

/**
 * Pricing System Types
 *
 * Type definitions for the Folio pricing and subscription system.
 */

import type { SubscriptionTierType, TierConfig, TierLimits } from './tiers';

/**
 * Subscription status for a user
 */
export interface SubscriptionStatus {
  tier: SubscriptionTierType;
  isActive: boolean;
  expiresAt: Date | null; // null = lifetime (founding designer)
  isFoundingDesigner: boolean;
  inGracePeriod: boolean;
  daysUntilExpiry: number | null;
  isComplimentary?: boolean;
}

/**
 * User's subscription with full details
 */
export interface UserSubscription {
  userId: string;
  status: SubscriptionStatus;
  config: TierConfig;
  limits: TierLimits;
  usage?: SubscriptionUsage;
}

/**
 * Current usage against limits
 */
export interface SubscriptionUsage {
  projects: {
    count: number;
    limit: number | null;
    percentUsed: number | null;
  };
  moodboards: {
    count: number;
    limit: number | null;
    percentUsed: number | null;
  };
  designerSeats: {
    count: number;
    limit: number;
    percentUsed: number | null;
  };
  aiGenerations: {
    count: number;
    limit: number | null;
    percentUsed: number | null;
    resetsAt: Date;
  };
  storageGb: {
    used: number;
    limit: number;
    percentUsed: number;
  };
}

/**
 * Founding Designer Program
 */
export interface FoundingDesignerInfo {
  isFoundingDesigner: boolean;
  enrolledAt: Date | null;
  publishingCommitment: {
    required: number; // Projects per month
    fulfilled: number;
    lastPublishedAt: Date | null;
  };
  benefits: string[];
}

/**
 * Subscription upgrade/downgrade request
 */
export interface SubscriptionChangeRequest {
  userId: string;
  fromTier: SubscriptionTierType;
  toTier: SubscriptionTierType;
  billingCycle: 'monthly' | 'annually';
  effectiveAt: Date;
  prorateCreditCents?: number;
}

/**
 * Billing information
 */
export interface BillingInfo {
  subscriptionId: string | null;
  customerId: string | null;
  billingCycle: 'monthly' | 'annually' | null;
  nextBillingDate: Date | null;
  paymentMethod: {
    type: 'card' | 'bank' | null;
    last4: string | null;
    brand: string | null;
    expiresAt: Date | null;
  } | null;
}

/**
 * Feature access check result
 */
export interface FeatureAccessResult {
  hasAccess: boolean;
  featureKey: string;
  currentTier: SubscriptionTierType;
  minimumTierRequired: SubscriptionTierType | null;
  upgradeRequired: boolean;
  upgradeUrl?: string;
}

/**
 * Tier comparison for upgrade flows
 */
export interface TierComparison {
  currentTier: TierConfig;
  targetTier: TierConfig;
  additionalFeatures: string[];
  limitImprovements: {
    limitKey: keyof TierLimits;
    current: number | null;
    new: number | null;
  }[];
  priceDifference: {
    monthly: number;
    annually: number;
  };
}

/**
 * Client access - clients are invited viewers, not paying users
 */
export interface ClientAccessInfo {
  projectId: string;
  clientEmail: string;
  invitedBy: string;
  invitedAt: Date;
  permissions: ClientPermissions;
}

export interface ClientPermissions {
  canView: boolean;
  canComment: boolean;
  canApprove: boolean;
  canSeeProducts: boolean;
  canSeePurchasePaths: boolean;
}

/**
 * Upgrade trigger events
 */
export type UpgradeTrigger =
  | 'project_limit_reached'
  | 'ai_generation_limit_reached'
  | 'team_feature_requested'
  | 'client_collaboration_requested'
  | 'analytics_requested'
  | 'directory_listing_requested'
  | 'affiliate_program_requested'
  | 'manual_upgrade';

export interface UpgradePromptData {
  trigger: UpgradeTrigger;
  currentTier: SubscriptionTierType;
  recommendedTier: SubscriptionTierType;
  message: string;
  ctaText: string;
  ctaUrl: string;
}

/**
 * Subscription lifecycle events
 */
export type SubscriptionEventType =
  | 'created'
  | 'upgraded'
  | 'downgraded'
  | 'renewed'
  | 'cancelled'
  | 'expired'
  | 'reactivated'
  | 'founding_enrolled'
  | 'payment_failed'
  | 'payment_succeeded';

export interface SubscriptionEvent {
  id: string;
  userId: string;
  eventType: SubscriptionEventType;
  fromTier: SubscriptionTierType | null;
  toTier: SubscriptionTierType | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Revenue stream types (for analytics)
 */
export type RevenueStreamType =
  | 'designer_subscription'
  | 'vendor_saas'
  | 'analytics_package'
  | 'affiliate_split'
  | 'marketplace_fee'
  | 'event_intelligence';

/**
 * API response types
 */
export interface PricingApiResponse {
  tiers: TierConfig[];
  currentUserTier?: SubscriptionTierType;
  features: {
    key: string;
    label: string;
    includedIn: SubscriptionTierType[];
  }[];
}

export interface SubscriptionApiResponse {
  subscription: UserSubscription;
  billing: BillingInfo | null;
  foundingDesigner: FoundingDesignerInfo | null;
}

export interface UpgradeApiResponse {
  success: boolean;
  subscription: UserSubscription;
  checkoutUrl?: string;
  error?: string;
}

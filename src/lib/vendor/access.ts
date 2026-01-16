/**
 * Vendor Access Control Helpers
 *
 * Functions for checking vendor subscription status, tier limits, and feature access.
 */

import { prisma } from '@/lib/prisma';
import type { VendorTier } from '@prisma/client';
import { VENDOR_TIERS, getSkuLimit, getRepSeatLimit, type VendorTierSlug } from './tiers';

/**
 * Get vendor subscription for an organization
 */
export async function getVendorSubscription(organizationId: string) {
  return prisma.vendorSubscription.findUnique({
    where: { organizationId },
  });
}

/**
 * Get vendor tier for an organization (defaults to STARTER if no subscription)
 */
export async function getVendorTier(organizationId: string): Promise<VendorTier> {
  const sub = await getVendorSubscription(organizationId);
  return sub?.tier ?? 'STARTER';
}

/**
 * Check if vendor can upload SKUs (requires Growth tier or higher)
 */
export async function canVendorUploadSku(organizationId: string): Promise<boolean> {
  const tier = await getVendorTier(organizationId);
  return tier !== 'STARTER';
}

/**
 * Check if vendor has reached their SKU upload limit
 */
export async function hasReachedSkuLimit(organizationId: string): Promise<boolean> {
  const tier = await getVendorTier(organizationId);
  const limit = getSkuLimit(tier as VendorTierSlug);

  if (limit === null) return false; // unlimited

  // Count products associated with this vendor organization
  // Note: You may need to adjust this query based on your actual Product model structure
  const currentCount = await prisma.product.count({
    where: {
      // Assuming products have a way to link to vendor organization
      // Adjust the field name based on your actual schema
      vendor: {
        organizationUsers: {
          some: {
            organizationId: organizationId,
          },
        },
      },
    },
  });

  return currentCount >= limit;
}

/**
 * Check if vendor can add another rep seat
 */
export async function canAddRepSeat(organizationId: string): Promise<boolean> {
  const tier = await getVendorTier(organizationId);
  const limit = getRepSeatLimit(tier as VendorTierSlug);

  if (limit === null) return true; // unlimited

  const currentReps = await prisma.organizationUser.count({
    where: {
      organizationId: organizationId,
      isActive: true,
    },
  });

  return currentReps < limit;
}

/**
 * Get current rep seat count for an organization
 */
export async function getRepSeatCount(organizationId: string): Promise<number> {
  return prisma.organizationUser.count({
    where: {
      organizationId: organizationId,
      isActive: true,
    },
  });
}

/**
 * Get SKU count for a vendor organization
 */
export async function getSkuCount(organizationId: string): Promise<number> {
  // Count products associated with this vendor organization
  // Adjust based on your actual schema
  return prisma.product.count({
    where: {
      vendor: {
        organizationUsers: {
          some: {
            organizationId: organizationId,
          },
        },
      },
    },
  });
}

/**
 * Calculate affiliate fee split for a vendor
 *
 * Designer always gets 40%
 * Folio gets the affiliate fee percentage based on tier
 * Vendor gets the remainder
 */
export async function getAffiliateFeeSplit(organizationId: string) {
  const sub = await getVendorSubscription(organizationId);
  const feePercent = sub?.affiliateFeePercent ?? 18;

  // Designer always gets 40%
  const designerPercent = 40;
  const folioPercent = feePercent;
  const vendorPercent = 100 - designerPercent - folioPercent;

  return {
    designer: designerPercent,
    folio: folioPercent,
    vendor: vendorPercent,
  };
}

/**
 * Feature flags for vendor tiers
 */
export type VendorFeature =
  | 'designer_profiles'
  | 'fingerprint_matching'
  | 'event_attribution'
  | 'trend_forecasting'
  | 'messaging'
  | 'api_access'
  | 'analytics_dashboard'
  | 'sku_uploads'
  | 'product_boosting';

/**
 * Feature access matrix by tier
 */
const FEATURE_MATRIX: Record<VendorFeature, VendorTier[]> = {
  designer_profiles: ['GROWTH', 'PROFESSIONAL', 'ENTERPRISE'],
  fingerprint_matching: ['PROFESSIONAL', 'ENTERPRISE'],
  event_attribution: ['GROWTH', 'PROFESSIONAL', 'ENTERPRISE'],
  trend_forecasting: ['PROFESSIONAL', 'ENTERPRISE'],
  messaging: ['PROFESSIONAL', 'ENTERPRISE'],
  api_access: ['ENTERPRISE'],
  analytics_dashboard: ['GROWTH', 'PROFESSIONAL', 'ENTERPRISE'],
  sku_uploads: ['GROWTH', 'PROFESSIONAL', 'ENTERPRISE'],
  product_boosting: ['PROFESSIONAL', 'ENTERPRISE'],
};

/**
 * Check if a vendor can access a specific feature
 */
export async function canAccessFeature(
  organizationId: string,
  feature: VendorFeature
): Promise<boolean> {
  const tier = await getVendorTier(organizationId);
  return FEATURE_MATRIX[feature]?.includes(tier) ?? false;
}

/**
 * Get all accessible features for a vendor
 */
export async function getAccessibleFeatures(
  organizationId: string
): Promise<VendorFeature[]> {
  const tier = await getVendorTier(organizationId);
  return (Object.entries(FEATURE_MATRIX) as [VendorFeature, VendorTier[]][])
    .filter(([, tiers]) => tiers.includes(tier))
    .map(([feature]) => feature);
}

/**
 * Check if vendor subscription is active
 */
export async function isSubscriptionActive(organizationId: string): Promise<boolean> {
  const sub = await getVendorSubscription(organizationId);
  if (!sub) return true; // STARTER is always "active"

  return sub.status === 'ACTIVE' || sub.status === 'TRIALING';
}

/**
 * Get subscription status details
 */
export async function getSubscriptionStatus(organizationId: string) {
  const sub = await getVendorSubscription(organizationId);

  if (!sub) {
    return {
      tier: 'STARTER' as VendorTier,
      status: 'ACTIVE' as const,
      isActive: true,
      config: VENDOR_TIERS.STARTER,
    };
  }

  const isActive = sub.status === 'ACTIVE' || sub.status === 'TRIALING';

  return {
    tier: sub.tier,
    status: sub.status,
    isActive,
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
    config: VENDOR_TIERS[sub.tier as VendorTierSlug],
  };
}

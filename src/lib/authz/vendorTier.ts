import { prisma } from '@/lib/prisma';
import { VendorTier } from '@prisma/client';

/**
 * Vendor Tier Authorization Layer
 *
 * Tier hierarchy:
 * - STANDARD (free): Can be tagged in projects, pay affiliate commissions, post events
 * - PRO ($$$): All Standard + Collaboration Stories, Event attendee lists, Event analytics, Action items
 * - ENTERPRISE ($$$$): All Pro + Pipeline insights, Market gap analysis, Trend forecasting, Competitive positioning
 */

const TIER_HIERARCHY: Record<VendorTier, number> = {
  STANDARD: 0,
  PRO: 1,
  ENTERPRISE: 2,
};

export type VendorTierInfo = {
  tier: VendorTier;
  startedAt: Date | null;
  expiresAt: Date | null;
  isExpired: boolean;
  isActive: boolean;
};

/**
 * Get the current vendor tier for an organization
 * Returns STANDARD if org is not a vendor or not found
 */
export async function getVendorTier(organizationId: string): Promise<VendorTier> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { vendorTier: true, vendorTierExpiresAt: true, type: true },
  });

  if (!org || org.type !== 'VENDOR') return 'STANDARD';

  // Check if tier has expired
  if (org.vendorTierExpiresAt && org.vendorTierExpiresAt < new Date()) {
    return 'STANDARD';
  }

  return org.vendorTier;
}

/**
 * Get detailed vendor tier information for an organization
 */
export async function getVendorTierInfo(organizationId: string): Promise<VendorTierInfo | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      vendorTier: true,
      vendorTierStartedAt: true,
      vendorTierExpiresAt: true,
      type: true,
    },
  });

  if (!org || org.type !== 'VENDOR') return null;

  const now = new Date();
  const isExpired = org.vendorTierExpiresAt ? org.vendorTierExpiresAt < now : false;

  return {
    tier: isExpired ? 'STANDARD' : org.vendorTier,
    startedAt: org.vendorTierStartedAt,
    expiresAt: org.vendorTierExpiresAt,
    isExpired,
    isActive: !isExpired && org.vendorTier !== 'STANDARD',
  };
}

/**
 * Check if a vendor has at least the required tier
 * Throws an error if the tier requirement is not met
 */
export async function assertVendorTier(
  organizationId: string,
  requiredTier: VendorTier
): Promise<void> {
  const currentTier = await getVendorTier(organizationId);
  if (TIER_HIERARCHY[currentTier] < TIER_HIERARCHY[requiredTier]) {
    throw new Error(`Requires ${requiredTier} tier`);
  }
}

/**
 * Check if a vendor has at least the required tier (non-throwing)
 */
export async function hasVendorTier(
  organizationId: string,
  requiredTier: VendorTier
): Promise<boolean> {
  const currentTier = await getVendorTier(organizationId);
  return TIER_HIERARCHY[currentTier] >= TIER_HIERARCHY[requiredTier];
}

/**
 * Compare two tiers and return which is higher
 */
export function compareTiers(a: VendorTier, b: VendorTier): number {
  return TIER_HIERARCHY[a] - TIER_HIERARCHY[b];
}

// ============================================================
// Feature-specific convenience functions
// ============================================================

// PRO Features

/**
 * Can create Collaboration Stories (PRO+)
 */
export async function canCreateCollaborationStory(orgId: string): Promise<boolean> {
  const tier = await getVendorTier(orgId);
  return TIER_HIERARCHY[tier] >= TIER_HIERARCHY.PRO;
}

/**
 * Can access event attendee lists (PRO+)
 */
export async function canAccessEventAttendees(orgId: string): Promise<boolean> {
  const tier = await getVendorTier(orgId);
  return TIER_HIERARCHY[tier] >= TIER_HIERARCHY.PRO;
}

/**
 * Can access event analytics dashboard (PRO+)
 */
export async function canAccessEventAnalytics(orgId: string): Promise<boolean> {
  const tier = await getVendorTier(orgId);
  return TIER_HIERARCHY[tier] >= TIER_HIERARCHY.PRO;
}

/**
 * Can access action items from events (PRO+)
 */
export async function canAccessEventActionItems(orgId: string): Promise<boolean> {
  const tier = await getVendorTier(orgId);
  return TIER_HIERARCHY[tier] >= TIER_HIERARCHY.PRO;
}

// ENTERPRISE Features

/**
 * Can access pipeline insights by product type (ENTERPRISE)
 */
export async function canAccessPipelineInsights(orgId: string): Promise<boolean> {
  const tier = await getVendorTier(orgId);
  return TIER_HIERARCHY[tier] >= TIER_HIERARCHY.ENTERPRISE;
}

/**
 * Can access market gap analysis (ENTERPRISE)
 */
export async function canAccessMarketGapAnalysis(orgId: string): Promise<boolean> {
  const tier = await getVendorTier(orgId);
  return TIER_HIERARCHY[tier] >= TIER_HIERARCHY.ENTERPRISE;
}

/**
 * Can access trend forecasting (ENTERPRISE)
 */
export async function canAccessTrendForecasting(orgId: string): Promise<boolean> {
  const tier = await getVendorTier(orgId);
  return TIER_HIERARCHY[tier] >= TIER_HIERARCHY.ENTERPRISE;
}

/**
 * Can access competitive positioning (ENTERPRISE)
 */
export async function canAccessCompetitivePositioning(orgId: string): Promise<boolean> {
  const tier = await getVendorTier(orgId);
  return TIER_HIERARCHY[tier] >= TIER_HIERARCHY.ENTERPRISE;
}

// ============================================================
// Tier management utilities
// ============================================================

/**
 * Upgrade a vendor to a new tier
 * Creates a subscription record and updates the organization
 */
export async function upgradeVendorTier(
  organizationId: string,
  newTier: VendorTier,
  options?: {
    stripeSubscriptionId?: string;
    durationDays?: number;
  }
): Promise<void> {
  const now = new Date();
  const expiresAt = options?.durationDays
    ? new Date(now.getTime() + options.durationDays * 24 * 60 * 60 * 1000)
    : null;

  await prisma.$transaction([
    // Update organization tier
    prisma.organization.update({
      where: { id: organizationId },
      data: {
        vendorTier: newTier,
        vendorTierStartedAt: now,
        vendorTierExpiresAt: expiresAt,
      },
    }),
    // Create subscription record
    prisma.vendorSubscription.create({
      data: {
        organizationId,
        tier: newTier,
        startedAt: now,
        expiresAt,
        stripeSubscriptionId: options?.stripeSubscriptionId,
      },
    }),
  ]);
}

/**
 * Cancel a vendor's subscription (downgrade to STANDARD at end of period)
 */
export async function cancelVendorSubscription(
  organizationId: string
): Promise<void> {
  // Find active subscription
  const subscription = await prisma.vendorSubscription.findFirst({
    where: {
      organizationId,
      cancelledAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (subscription) {
    await prisma.vendorSubscription.update({
      where: { id: subscription.id },
      data: { cancelledAt: new Date() },
    });
  }
}

/**
 * Get subscription history for a vendor
 */
export async function getVendorSubscriptionHistory(organizationId: string) {
  return prisma.vendorSubscription.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

// ============================================================
// Exports for tier definitions
// ============================================================

export const VENDOR_TIER_FEATURES = {
  STANDARD: {
    name: 'Standard',
    price: 'Free',
    features: [
      'Can be tagged in projects',
      'Pay affiliate commissions on sales',
      'Can post events',
    ],
  },
  PRO: {
    name: 'Pro',
    price: 'Monthly subscription',
    features: [
      'All Standard features',
      'Create Collaboration Stories',
      'Access event attendee lists',
      'Event analytics dashboard',
      'Action items from events',
    ],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 'Premium pricing',
    features: [
      'All Pro features',
      'Pipeline insights by product type',
      'Market gap analysis',
      'Trend forecasting',
      'Competitive positioning',
    ],
  },
} as const;

export { TIER_HIERARCHY };

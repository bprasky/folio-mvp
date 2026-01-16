/**
 * Vendor Subscription Tier Configuration
 *
 * Defines the structure and limits for each vendor subscription tier.
 * All prices stored in cents (integer).
 * Affiliate fee stored as float percentage (e.g., 18.0 = 18%).
 */

export const VENDOR_TIERS = {
  STARTER: {
    slug: 'starter',
    name: 'Starter',
    priceMonthly: 0,
    priceYearly: 0,
    skuLimit: 0,
    repSeatLimit: 1,
    affiliateFeePercent: 18,
    features: [
      'Claim vendor profile',
      'Basic attribution (product saves count)',
      'Link out to your own site',
      '1 rep seat',
    ],
    limitations: [
      'No SKU uploads',
      'Designer details hidden',
      'No analytics dashboard',
    ],
  },
  GROWTH: {
    slug: 'growth',
    name: 'Growth',
    priceMonthly: 34900, // cents ($349)
    priceYearly: 349000, // cents ($3,490 - 2 months free)
    skuLimit: 100,
    repSeatLimit: 2,
    affiliateFeePercent: 11,
    features: [
      'Full attribution dashboard',
      'Designer names & profiles visible',
      'Upload up to 100 SKUs',
      'Product performance analytics',
      'Basic event attribution',
      '2 rep seats',
      '11% affiliate fee (vs 18%)',
    ],
    limitations: [
      '100 SKU limit',
      'No designer fingerprint matching',
      'No trend forecasting',
    ],
  },
  PROFESSIONAL: {
    slug: 'professional',
    name: 'Professional',
    priceMonthly: 89900, // cents ($899)
    priceYearly: 899000, // cents ($8,990 - 2 months free)
    skuLimit: null, // unlimited
    repSeatLimit: 5,
    affiliateFeePercent: 6,
    features: [
      'Everything in Growth',
      'Unlimited SKU uploads',
      'Designer fingerprint matching',
      'Advanced event ROI attribution',
      'Monthly product boosting credits',
      'Trend forecasting (early demand signals)',
      'Vendor-to-designer messaging',
      '5 rep seats',
      '6% affiliate fee',
    ],
    limitations: [],
  },
  ENTERPRISE: {
    slug: 'enterprise',
    name: 'Enterprise',
    priceMonthly: null, // custom
    priceYearly: null,
    skuLimit: null,
    repSeatLimit: null, // unlimited
    affiliateFeePercent: null, // negotiated
    features: [
      'Everything in Professional',
      'Unlimited rep seats',
      'API integrations',
      'Custom analytics dashboards',
      'Dedicated account manager',
      'Co-marketing opportunities',
      'Pre-launch testing capabilities',
      'Negotiated affiliate fee (3-5%)',
    ],
    limitations: [],
  },
} as const;

export type VendorTierSlug = keyof typeof VENDOR_TIERS;

export type VendorTierConfig = typeof VENDOR_TIERS[VendorTierSlug];

/**
 * Get the configuration for a specific tier
 */
export function getTierConfig(tier: VendorTierSlug): VendorTierConfig {
  return VENDOR_TIERS[tier];
}

/**
 * Check if a tier can upload SKUs
 */
export function canUploadSkus(tier: VendorTierSlug): boolean {
  return tier !== 'STARTER';
}

/**
 * Get SKU limit for a tier (null = unlimited)
 */
export function getSkuLimit(tier: VendorTierSlug): number | null {
  return VENDOR_TIERS[tier].skuLimit;
}

/**
 * Get rep seat limit for a tier (null = unlimited)
 */
export function getRepSeatLimit(tier: VendorTierSlug): number | null {
  return VENDOR_TIERS[tier].repSeatLimit;
}

/**
 * Get affiliate fee percentage for a tier (null for enterprise = negotiated)
 */
export function getAffiliateFeePercent(tier: VendorTierSlug): number | null {
  return VENDOR_TIERS[tier].affiliateFeePercent;
}

/**
 * Get monthly price in cents for a tier (null for enterprise = custom)
 */
export function getMonthlyPriceCents(tier: VendorTierSlug): number | null {
  return VENDOR_TIERS[tier].priceMonthly;
}

/**
 * Get yearly price in cents for a tier (null for enterprise = custom)
 */
export function getYearlyPriceCents(tier: VendorTierSlug): number | null {
  return VENDOR_TIERS[tier].priceYearly;
}

/**
 * Format price for display (e.g., "$349/mo")
 */
export function formatTierPrice(tier: VendorTierSlug, interval: 'monthly' | 'yearly' = 'monthly'): string {
  const config = VENDOR_TIERS[tier];
  const price = interval === 'monthly' ? config.priceMonthly : config.priceYearly;

  if (price === null) return 'Custom';
  if (price === 0) return 'Free';

  const dollars = price / 100;
  const suffix = interval === 'monthly' ? '/mo' : '/yr';
  return `$${dollars.toLocaleString()}${suffix}`;
}

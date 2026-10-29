/**
 * Pricing Tiers Configuration
 *
 * Folio prices for business stage, not feature bundles.
 * Each tier answers a question:
 * - Free: "Is this worth my time?"
 * - Pro: "How do I publish work and collaborate with clients?"
 * - Studio: "How does my team use this?"
 * - Enterprise: "How do we scale this across the organization?"
 */

export type SubscriptionTierType = 'FREE' | 'PRO' | 'STUDIO' | 'ENTERPRISE';

export interface TierPricing {
  monthly: number;
  annually: number;
  annualMonthlyEquivalent: number;
}

export interface TierLimits {
  projects: number | null; // null = unlimited
  moodboards: number | null;
  designerSeats: number;
  clientsPerProject: number | null; // null = unlimited
  aiEditorialGenerationsPerMonth: number | null;
  storageGb: number;
}

export interface TierFeature {
  key: string;
  label: string;
  description?: string;
  includedInTiers: SubscriptionTierType[];
}

export interface TierConfig {
  id: SubscriptionTierType;
  name: string;
  tagline: string;
  description: string;
  targetAudience: string;
  upgradeQuestion: string;
  pricing: TierPricing | null; // null for a separately quoted plan
  additionalSeatPricing?: TierPricing; // Catalog rate; purchased seat entitlements are separate.
  limits: TierLimits;
  highlighted?: boolean; // For UI purposes (e.g., "Most Popular")
}

/**
 * Core tier configurations
 */
export const TIER_CONFIGS: Record<SubscriptionTierType, TierConfig> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    tagline: 'Explore the platform',
    description: 'Perfect for designers exploring the platform and building their initial presence.',
    targetAudience: 'Designers exploring the platform',
    upgradeQuestion: 'I want to actually publish and use AI editorial generation',
    pricing: {
      monthly: 0,
      annually: 0,
      annualMonthlyEquivalent: 0,
    },
    limits: {
      projects: 1,
      moodboards: 3,
      designerSeats: 1,
      clientsPerProject: 0,
      aiEditorialGenerationsPerMonth: 0,
      storageGb: 1,
    },
  },

  PRO: {
    id: 'PRO',
    name: 'Pro',
    tagline: 'Publish and collaborate',
    description: 'Everything you need to showcase your work, collaborate with clients, and grow your practice.',
    targetAudience: 'Working designers with active practices',
    upgradeQuestion: 'I have other designers working with me',
    pricing: {
      monthly: 29,
      annually: 290,
      annualMonthlyEquivalent: 24.17,
    },
    limits: {
      projects: null,
      moodboards: null,
      designerSeats: 1,
      clientsPerProject: null,
      aiEditorialGenerationsPerMonth: null,
      storageGb: 50,
    },
    highlighted: true,
  },

  STUDIO: {
    id: 'STUDIO',
    name: 'Studio',
    tagline: 'Team collaboration',
    description: 'Built for design firms with multiple designers who need shared resources and team analytics.',
    targetAudience: 'Design firms with multiple designers',
    upgradeQuestion: 'We need custom integrations or support',
    pricing: {
      monthly: 49,
      annually: 490,
      annualMonthlyEquivalent: 40.83,
    },
    additionalSeatPricing: {
      monthly: 5,
      annually: 50,
      annualMonthlyEquivalent: 4.17,
    },
    limits: {
      projects: null,
      moodboards: null,
      designerSeats: 3,
      clientsPerProject: null,
      aiEditorialGenerationsPerMonth: null,
      storageGb: 200,
    },
  },

  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Unlimited scale',
    description: 'Custom solutions for large firms with advanced integration, analytics, and support needs.',
    targetAudience: 'Large firms with 6+ designers',
    upgradeQuestion: 'Contact us for custom solutions',
    pricing: null, // Legacy plan; future Enterprise pricing remains a concept.
    limits: {
      projects: null,
      moodboards: null,
      designerSeats: -1, // -1 = unlimited
      clientsPerProject: null,
      aiEditorialGenerationsPerMonth: null,
      storageGb: -1, // -1 = unlimited
    },
  },
};

/**
 * Feature matrix - what's included in each tier
 */
export const TIER_FEATURES: TierFeature[] = [
  // Profile & Discovery
  {
    key: 'basic_profile',
    label: 'Basic profile',
    description: 'Create your designer profile with portfolio showcase',
    includedInTiers: ['FREE', 'PRO', 'STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'inspire_feed',
    label: 'Browse Inspire feed',
    description: 'Discover and save inspiration from the community',
    includedInTiers: ['FREE', 'PRO', 'STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'save_inspiration',
    label: 'Save inspiration',
    description: 'Save projects and products to your collections',
    includedInTiers: ['FREE', 'PRO', 'STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'atelier_fingerprint',
    label: 'Atelier fingerprint building',
    description: 'Your design DNA builds passively from activity',
    includedInTiers: ['FREE', 'PRO', 'STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'directory_listing',
    label: 'Directory listing',
    description: 'Appear in the designer directory for discovery',
    includedInTiers: ['PRO', 'STUDIO', 'ENTERPRISE'],
  },

  // Projects & Publishing
  {
    key: 'unlimited_projects',
    label: 'Unlimited projects',
    description: 'Create and manage unlimited design projects',
    includedInTiers: ['PRO', 'STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'unlimited_moodboards',
    label: 'Unlimited moodboards',
    description: 'Create unlimited moodboards for each project',
    includedInTiers: ['PRO', 'STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'full_publishing',
    label: 'Full publishing capabilities',
    description: 'Publish projects with full editorial layouts',
    includedInTiers: ['PRO', 'STUDIO', 'ENTERPRISE'],
  },

  // AI & Editorial
  {
    key: 'ai_editorial',
    label: 'AI editorial layout generation',
    description: 'Generate professional editorial layouts with AI',
    includedInTiers: ['PRO', 'STUDIO', 'ENTERPRISE'],
  },

  // Client Collaboration
  {
    key: 'client_collaboration',
    label: 'Client collaboration',
    description: 'Invite unlimited clients to view, comment, and approve',
    includedInTiers: ['PRO', 'STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'whitelabel_exports',
    label: 'White-label presentation exports',
    description: 'Export branded presentations without Folio branding',
    includedInTiers: ['PRO', 'STUDIO', 'ENTERPRISE'],
  },

  // Social & Attribution
  {
    key: 'instagram_crosspost',
    label: 'Instagram cross-posting',
    description: 'Publish to Instagram with automatic attribution',
    includedInTiers: ['PRO', 'STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'product_tagging',
    label: 'Product tagging with vendor attribution',
    description: 'Tag products with vendor links and attribution',
    includedInTiers: ['PRO', 'STUDIO', 'ENTERPRISE'],
  },

  // Analytics & Revenue
  {
    key: 'analytics',
    label: 'Analytics dashboard',
    description: 'Track views, saves, and engagement metrics',
    includedInTiers: ['PRO', 'STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'affiliate_revenue',
    label: 'Affiliate revenue participation',
    description: 'Earn from product purchases through your content',
    includedInTiers: ['PRO', 'STUDIO', 'ENTERPRISE'],
  },

  // Team Features (Studio+)
  {
    key: 'team_seats',
    label: 'Team licenses',
    description: 'Individual access for the people in your firm',
    includedInTiers: ['STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'shared_libraries',
    label: 'Shared project libraries',
    description: 'Share projects and resources across your team',
    includedInTiers: ['STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'firm_analytics',
    label: 'Firm-level analytics',
    description: 'Aggregate analytics across all team members',
    includedInTiers: ['STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'vendor_relationships',
    label: 'Centralized vendor relationships',
    description: 'Manage vendor accounts at the firm level',
    includedInTiers: ['STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'client_handoff',
    label: 'Client handoff between team members',
    description: 'Transfer client projects between team members',
    includedInTiers: ['STUDIO', 'ENTERPRISE'],
  },
  {
    key: 'priority_support',
    label: 'Priority support',
    description: 'Get faster response times on support requests',
    includedInTiers: ['STUDIO', 'ENTERPRISE'],
  },

  // Enterprise Features
  {
    key: 'unlimited_seats',
    label: 'Unlimited designer seats',
    description: 'No limit on team size',
    includedInTiers: ['ENTERPRISE'],
  },
  {
    key: 'api_integrations',
    label: 'API integrations',
    description: 'Connect Folio with your existing tools',
    includedInTiers: ['ENTERPRISE'],
  },
  {
    key: 'custom_analytics',
    label: 'Custom analytics dashboards',
    description: 'Build custom reports and dashboards',
    includedInTiers: ['ENTERPRISE'],
  },
  {
    key: 'dedicated_account_manager',
    label: 'Dedicated account manager',
    description: 'Personal support from a dedicated contact',
    includedInTiers: ['ENTERPRISE'],
  },
  {
    key: 'custom_onboarding',
    label: 'Custom onboarding',
    description: 'Tailored onboarding program for your team',
    includedInTiers: ['ENTERPRISE'],
  },
];

/**
 * Helper functions for tier logic
 */

export function getTierConfig(tier: SubscriptionTierType): TierConfig {
  return TIER_CONFIGS[tier];
}

export function getTierFeatures(tier: SubscriptionTierType): TierFeature[] {
  return TIER_FEATURES.filter((feature) => feature.includedInTiers.includes(tier));
}

export function hasFeature(tier: SubscriptionTierType, featureKey: string): boolean {
  const feature = TIER_FEATURES.find((f) => f.key === featureKey);
  return feature ? feature.includedInTiers.includes(tier) : false;
}

export function getTierLimit<K extends keyof TierLimits>(
  tier: SubscriptionTierType,
  limitKey: K
): TierLimits[K] {
  return TIER_CONFIGS[tier].limits[limitKey];
}

export function isUnlimited(value: number | null): boolean {
  return value === null || value === -1;
}

/**
 * Tier comparison helpers
 */
export const TIER_ORDER: SubscriptionTierType[] = ['FREE', 'PRO', 'STUDIO', 'ENTERPRISE'];

// Enterprise remains supported for existing accounts but is not offered publicly.
export const PUBLIC_TIER_ORDER: SubscriptionTierType[] = ['FREE', 'PRO', 'STUDIO'];

export function compareTiers(a: SubscriptionTierType, b: SubscriptionTierType): number {
  return TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b);
}

export function isHigherTier(tier: SubscriptionTierType, thanTier: SubscriptionTierType): boolean {
  return compareTiers(tier, thanTier) > 0;
}

export function isLowerTier(tier: SubscriptionTierType, thanTier: SubscriptionTierType): boolean {
  return compareTiers(tier, thanTier) < 0;
}

export function isPaidTier(tier: SubscriptionTierType): boolean {
  return tier !== 'FREE';
}

export function isTeamTier(tier: SubscriptionTierType): boolean {
  return tier === 'STUDIO' || tier === 'ENTERPRISE';
}

/**
 * Get the next upgrade tier (if any)
 */
export function getNextUpgradeTier(currentTier: SubscriptionTierType): SubscriptionTierType | null {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex >= TIER_ORDER.length - 1) {
    return null;
  }
  return TIER_ORDER[currentIndex + 1];
}

/**
 * Check if user can access a feature based on their tier
 */
export function canAccessFeature(userTier: SubscriptionTierType, featureKey: string): boolean {
  return hasFeature(userTier, featureKey);
}

/**
 * Get minimum tier required for a feature
 */
export function getMinimumTierForFeature(featureKey: string): SubscriptionTierType | null {
  const feature = TIER_FEATURES.find((f) => f.key === featureKey);
  if (!feature) return null;

  for (const tier of TIER_ORDER) {
    if (feature.includedInTiers.includes(tier)) {
      return tier;
    }
  }
  return null;
}

/**
 * ROI calculation helpers (from pricing doc)
 */
export const ROI_ASSUMPTIONS = {
  hoursPerProjectSaved: 4, // Conservative estimate from 3-5
  designerHourlyRate: 100, // $100+/hr billing rate
  avgProjectAffiliateValue: 30000, // $30k in tagged products
  affiliateCommissionRate: 0.05, // 5%
};

export function calculateMonthlyROI(tier: SubscriptionTierType): {
  timeSavingsValue: number;
  affiliatePotential: number;
  monthlyBreakeven: number;
} {
  const config = getTierConfig(tier);
  const monthlyCost = config.pricing?.monthly ?? 0;

  // Time savings from AI editorial generation
  const timeSavingsValue = ROI_ASSUMPTIONS.hoursPerProjectSaved * ROI_ASSUMPTIONS.designerHourlyRate;

  // Potential affiliate revenue per project
  const affiliatePotential =
    ROI_ASSUMPTIONS.avgProjectAffiliateValue * ROI_ASSUMPTIONS.affiliateCommissionRate;

  // Projects needed to break even (via time savings alone)
  const monthlyBreakeven = monthlyCost > 0 ? monthlyCost / timeSavingsValue : 0;

  return {
    timeSavingsValue,
    affiliatePotential,
    monthlyBreakeven,
  };
}

/**
 * Competitive benchmark data (for marketing/pricing page)
 */
export const COMPETITIVE_BENCHMARKS = [
  { name: 'Studio Designer', priceRange: '$58-116/mo', features: 'Workflow/bookkeeping only' },
  { name: 'Houzz Pro', priceRange: '$65-300/mo', features: 'Leads + basic tools' },
  { name: 'Squarespace', priceRange: '$16-49/mo', features: 'Static portfolio site' },
  { name: 'Adobe CC', priceRange: '$55-80/mo', features: 'Design tools, no ecosystem' },
] as const;

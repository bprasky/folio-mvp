/**
 * Pricing Tiers API
 *
 * GET /api/pricing - Get all pricing tiers and features
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import {
  TIER_CONFIGS,
  TIER_FEATURES,
  TIER_ORDER,
  COMPETITIVE_BENCHMARKS,
  ROI_ASSUMPTIONS,
  calculateMonthlyROI,
  type SubscriptionTierType,
} from '@/lib/pricing';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Build tiers array in order
    const tiers = TIER_ORDER.map((tierKey) => {
      const config = TIER_CONFIGS[tierKey];
      const roi = calculateMonthlyROI(tierKey);

      return {
        id: config.id,
        name: config.name,
        tagline: config.tagline,
        description: config.description,
        targetAudience: config.targetAudience,
        upgradeQuestion: config.upgradeQuestion,
        pricing: config.pricing,
        limits: config.limits,
        highlighted: config.highlighted ?? false,
        roi: {
          timeSavingsValue: roi.timeSavingsValue,
          affiliatePotential: roi.affiliatePotential,
          monthlyBreakeven: roi.monthlyBreakeven,
        },
      };
    });

    // Build features list
    const features = TIER_FEATURES.map((feature) => ({
      key: feature.key,
      label: feature.label,
      description: feature.description,
      includedIn: feature.includedInTiers,
    }));

    // Group features by category for UI
    const featureGroups = [
      {
        name: 'Profile & Discovery',
        features: features.filter((f) =>
          ['basic_profile', 'inspire_feed', 'save_inspiration', 'atelier_fingerprint', 'directory_listing'].includes(
            f.key
          )
        ),
      },
      {
        name: 'Projects & Publishing',
        features: features.filter((f) =>
          ['unlimited_projects', 'unlimited_moodboards', 'full_publishing'].includes(f.key)
        ),
      },
      {
        name: 'AI & Editorial',
        features: features.filter((f) => f.key === 'ai_editorial'),
      },
      {
        name: 'Client Collaboration',
        features: features.filter((f) =>
          ['client_collaboration', 'whitelabel_exports'].includes(f.key)
        ),
      },
      {
        name: 'Social & Attribution',
        features: features.filter((f) =>
          ['instagram_crosspost', 'product_tagging'].includes(f.key)
        ),
      },
      {
        name: 'Analytics & Revenue',
        features: features.filter((f) => ['analytics', 'affiliate_revenue'].includes(f.key)),
      },
      {
        name: 'Team Features',
        features: features.filter((f) =>
          [
            'team_seats',
            'shared_libraries',
            'firm_analytics',
            'vendor_relationships',
            'client_handoff',
            'priority_support',
          ].includes(f.key)
        ),
      },
      {
        name: 'Enterprise',
        features: features.filter((f) =>
          [
            'unlimited_seats',
            'api_integrations',
            'custom_analytics',
            'dedicated_account_manager',
            'custom_onboarding',
          ].includes(f.key)
        ),
      },
    ];

    const response = {
      tiers,
      features,
      featureGroups,
      currentUserTier: (session?.user?.subscriptionTier as SubscriptionTierType) ?? null,
      competitiveBenchmarks: COMPETITIVE_BENCHMARKS,
      roiAssumptions: ROI_ASSUMPTIONS,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching pricing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing information' },
      { status: 500 }
    );
  }
}

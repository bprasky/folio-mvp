'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  type SubscriptionTierType,
  type TierConfig,
  TIER_CONFIGS,
  TIER_ORDER,
} from '@/lib/pricing';

interface SubscriptionData {
  subscription: {
    userId: string;
    status: {
      tier: SubscriptionTierType;
      isActive: boolean;
      expiresAt: string | null;
      isFoundingDesigner: boolean;
      inGracePeriod: boolean;
      daysUntilExpiry: number | null;
    };
    config: TierConfig;
    limits: {
      projects: number | null;
      moodboards: number | null;
      designerSeats: number;
      clientsPerProject: number | null;
      aiEditorialGenerationsPerMonth: number | null;
      storageGb: number;
    };
    usage?: {
      projects: { count: number; limit: number | null; percentUsed: number | null };
      designerSeats: { count: number; limit: number; percentUsed: number | null };
      storageGb: { used: number; limit: number; percentUsed: number };
    };
  };
  foundingDesigner: {
    isFoundingDesigner: boolean;
    enrolledAt: string | null;
    publishingCommitment: {
      required: number;
      fulfilled: number;
      lastPublishedAt: string | null;
    };
    benefits: string[];
  } | null;
}

export default function SubscriptionSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/settings/subscription');
      return;
    }

    if (status === 'authenticated') {
      fetchSubscription();
    }
  }, [status, router]);

  async function fetchSubscription() {
    try {
      const response = await fetch('/api/subscription');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }
      const data = await response.json();
      setSubscriptionData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchSubscription();
            }}
            className="text-neutral-600 hover:text-neutral-900"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!subscriptionData) {
    return null;
  }

  const { subscription, foundingDesigner } = subscriptionData;
  const currentTier = subscription.status.tier;
  const currentConfig = subscription.config;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">Subscription</h1>
          <p className="text-neutral-600 mt-1">
            Manage your subscription and billing
          </p>
        </div>

        {/* Current Plan Card */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-neutral-900">
                  {currentConfig.name} Plan
                </h2>
                {subscription.status.isFoundingDesigner && (
                  <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    Founding Designer
                  </span>
                )}
                {subscription.status.inGracePeriod && (
                  <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    Grace Period
                  </span>
                )}
              </div>
              <p className="text-neutral-600 mt-1">{currentConfig.tagline}</p>
            </div>
            <div className="text-right">
              {currentConfig.pricing ? (
                <>
                  <div className="text-2xl font-bold text-neutral-900">
                    ${currentConfig.pricing.monthly}
                    <span className="text-sm font-normal text-neutral-500">/mo</span>
                  </div>
                  {currentConfig.pricing.monthly > 0 && (
                    <div className="text-sm text-neutral-500">
                      or ${currentConfig.pricing.annually}/year
                    </div>
                  )}
                </>
              ) : (
                <div className="text-lg font-semibold text-neutral-900">
                  Custom Pricing
                </div>
              )}
            </div>
          </div>

          {/* Subscription Status */}
          {subscription.status.expiresAt && (
            <div className="mt-4 pt-4 border-t border-neutral-100">
              {subscription.status.daysUntilExpiry !== null && subscription.status.daysUntilExpiry > 0 ? (
                <p className="text-sm text-neutral-600">
                  Your subscription renews in{' '}
                  <span className="font-medium">{subscription.status.daysUntilExpiry} days</span>
                  {' '}on {new Date(subscription.status.expiresAt).toLocaleDateString()}
                </p>
              ) : subscription.status.inGracePeriod ? (
                <p className="text-sm text-red-600">
                  Your subscription expired. You have 7 days to renew before losing access to premium features.
                </p>
              ) : null}
            </div>
          )}

          {subscription.status.isFoundingDesigner && (
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <p className="text-sm text-amber-700">
                As a Founding Designer, you have lifetime Pro access at no cost.
              </p>
            </div>
          )}
        </div>

        {/* Usage Section */}
        {subscription.usage && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Usage</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <UsageItem
                label="Projects"
                current={subscription.usage.projects.count}
                limit={subscription.usage.projects.limit}
              />
              <UsageItem
                label="Designer Seats"
                current={subscription.usage.designerSeats.count}
                limit={subscription.usage.designerSeats.limit}
              />
              <UsageItem
                label="Storage"
                current={subscription.usage.storageGb.used}
                limit={subscription.usage.storageGb.limit}
                unit="GB"
              />
            </div>
          </div>
        )}

        {/* Plan Features */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Your Plan Includes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FeatureItem
              label="Projects"
              value={formatLimit(subscription.limits.projects)}
            />
            <FeatureItem
              label="Moodboards"
              value={formatLimit(subscription.limits.moodboards)}
            />
            <FeatureItem
              label="Designer Seats"
              value={subscription.limits.designerSeats === -1 ? 'Unlimited' : String(subscription.limits.designerSeats)}
            />
            <FeatureItem
              label="Client Collaboration"
              value={subscription.limits.clientsPerProject === null ? 'Unlimited' : subscription.limits.clientsPerProject === 0 ? 'Not included' : String(subscription.limits.clientsPerProject)}
            />
            <FeatureItem
              label="AI Editorial Generation"
              value={subscription.limits.aiEditorialGenerationsPerMonth === null ? 'Unlimited' : subscription.limits.aiEditorialGenerationsPerMonth === 0 ? 'Not included' : `${subscription.limits.aiEditorialGenerationsPerMonth}/month`}
            />
            <FeatureItem
              label="Storage"
              value={subscription.limits.storageGb === -1 ? 'Unlimited' : `${subscription.limits.storageGb} GB`}
            />
          </div>
        </div>

        {/* Founding Designer Section */}
        {foundingDesigner?.isFoundingDesigner && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-amber-900 mb-4">
              Founding Designer Program
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-amber-800">
                  Publishing Commitment: {foundingDesigner.publishingCommitment.fulfilled} of{' '}
                  {foundingDesigner.publishingCommitment.required} projects this month
                </p>
                <div className="mt-2 h-2 bg-amber-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: `${Math.min(100, (foundingDesigner.publishingCommitment.fulfilled / foundingDesigner.publishingCommitment.required) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-amber-900 mb-2">Your Benefits</h4>
                <ul className="space-y-1">
                  {foundingDesigner.benefits.map((benefit, index) => (
                    <li key={index} className="text-sm text-amber-800 flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Upgrade Options */}
        {currentTier !== 'ENTERPRISE' && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              {currentTier === 'FREE' ? 'Upgrade Your Plan' : 'Other Plans'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TIER_ORDER.filter((tier) => tier !== currentTier && tier !== 'FREE').map((tierKey) => {
                const tier = TIER_CONFIGS[tierKey];
                const isUpgrade = TIER_ORDER.indexOf(tierKey) > TIER_ORDER.indexOf(currentTier);

                return (
                  <div
                    key={tierKey}
                    className={`border rounded-lg p-4 ${
                      tier.highlighted ? 'border-black' : 'border-neutral-200'
                    }`}
                  >
                    <h4 className="font-semibold text-neutral-900">{tier.name}</h4>
                    <p className="text-sm text-neutral-500 mt-1">{tier.tagline}</p>
                    <div className="mt-3">
                      {tier.pricing ? (
                        <span className="text-lg font-bold">${tier.pricing.monthly}/mo</span>
                      ) : (
                        <span className="text-lg font-semibold">Custom</span>
                      )}
                    </div>
                    <Link
                      href={tierKey === 'ENTERPRISE' ? '/contact?subject=enterprise' : `/pricing?highlight=${tierKey}`}
                      className={`mt-4 block w-full py-2 px-4 rounded-lg text-center text-sm font-medium transition-colors ${
                        isUpgrade
                          ? 'bg-black text-white hover:bg-neutral-800'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      {tierKey === 'ENTERPRISE' ? 'Contact Sales' : isUpgrade ? 'Upgrade' : 'Switch Plan'}
                    </Link>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-center">
              <Link href="/pricing" className="text-sm text-neutral-600 hover:text-neutral-900">
                Compare all plans
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UsageItem({
  label,
  current,
  limit,
  unit = '',
}: {
  label: string;
  current: number;
  limit: number | null;
  unit?: string;
}) {
  const isUnlimited = limit === null || limit === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, (current / limit) * 100);
  const isNearLimit = !isUnlimited && percentage >= 80;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-neutral-600">{label}</span>
        <span className={isNearLimit ? 'text-amber-600 font-medium' : 'text-neutral-900'}>
          {current}
          {unit && ` ${unit}`}
          {!isUnlimited && ` / ${limit}${unit && ` ${unit}`}`}
          {isUnlimited && ' (unlimited)'}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              isNearLimit ? 'bg-amber-500' : 'bg-neutral-900'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

function FeatureItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
      <span className="text-sm text-neutral-600">{label}</span>
      <span className="text-sm font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function formatLimit(limit: number | null): string {
  if (limit === null || limit === -1) return 'Unlimited';
  return String(limit);
}

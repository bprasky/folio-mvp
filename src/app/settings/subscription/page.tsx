'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  RidgeCard,
  RidgeCardHeader,
  RidgeCardTitle,
  RidgeCardContent,
} from '@/components/ui/ridge-card';
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
      <div className="min-h-screen bg-[var(--bg-elevated)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-elevated)] flex items-center justify-center">
        <RidgeCard padding="lg" className="text-center max-w-md">
          <p className="folio-body text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchSubscription();
            }}
            className="ridge-btn px-4 py-2"
          >
            Try again
          </button>
        </RidgeCard>
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
    <div className="min-h-screen bg-[var(--bg-elevated)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="folio-h2">Subscription</h1>
          <p className="folio-body text-[var(--text-secondary)] mt-1">
            Manage your subscription and billing
          </p>
        </div>

        {/* Current Plan Card */}
        <RidgeCard padding="lg" className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="folio-h3">
                  {currentConfig.name} Plan
                </h2>
                {subscription.status.isFoundingDesigner && (
                  <span className="bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium px-2.5 py-1 rounded-full">
                    Founding Designer
                  </span>
                )}
                {subscription.status.inGracePeriod && (
                  <span className="bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    Grace Period
                  </span>
                )}
              </div>
              <p className="folio-meta text-[var(--text-secondary)] mt-1">{currentConfig.tagline}</p>
            </div>
            <div className="text-right">
              {currentConfig.pricing ? (
                <>
                  <div className="folio-stat text-[var(--text-primary)]">
                    ${currentConfig.pricing.monthly}
                    <span className="folio-meta text-[var(--text-tertiary)]">/mo</span>
                  </div>
                  {currentConfig.pricing.monthly > 0 && (
                    <div className="folio-meta text-[var(--text-tertiary)]">
                      or ${currentConfig.pricing.annually}/year
                    </div>
                  )}
                </>
              ) : (
                <div className="folio-ui font-semibold text-[var(--text-primary)]">
                  Custom Pricing
                </div>
              )}
            </div>
          </div>

          {/* Subscription Status */}
          {subscription.status.expiresAt && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              {subscription.status.daysUntilExpiry !== null && subscription.status.daysUntilExpiry > 0 ? (
                <p className="folio-meta text-[var(--text-secondary)]">
                  Your subscription renews in{' '}
                  <span className="font-medium">{subscription.status.daysUntilExpiry} days</span>
                  {' '}on {new Date(subscription.status.expiresAt).toLocaleDateString()}
                </p>
              ) : subscription.status.inGracePeriod ? (
                <p className="folio-meta text-red-600">
                  Your subscription expired. You have 7 days to renew before losing access to premium features.
                </p>
              ) : null}
            </div>
          )}

          {subscription.status.isFoundingDesigner && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="folio-meta text-[var(--accent)]">
                As a Founding Designer, you have lifetime Pro access at no cost.
              </p>
            </div>
          )}
        </RidgeCard>

        {/* Usage Section */}
        {subscription.usage && (
          <RidgeCard padding="lg" className="mb-6">
            <RidgeCardHeader>
              <RidgeCardTitle>Usage</RidgeCardTitle>
            </RidgeCardHeader>
            <RidgeCardContent>
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
            </RidgeCardContent>
          </RidgeCard>
        )}

        {/* Plan Features */}
        <RidgeCard padding="lg" className="mb-6">
          <RidgeCardHeader>
            <RidgeCardTitle>Your Plan Includes</RidgeCardTitle>
          </RidgeCardHeader>
          <RidgeCardContent>
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
          </RidgeCardContent>
        </RidgeCard>

        {/* Founding Designer Section */}
        {foundingDesigner?.isFoundingDesigner && (
          <RidgeCard padding="lg" className="mb-6 !bg-[var(--accent)]/5 !border-[var(--accent)]/20">
            <RidgeCardHeader>
              <RidgeCardTitle className="text-[var(--accent)]">Founding Designer Program</RidgeCardTitle>
            </RidgeCardHeader>
            <RidgeCardContent>
              <div className="space-y-4">
                <div>
                  <p className="folio-meta text-[var(--text-secondary)]">
                    Publishing Commitment: {foundingDesigner.publishingCommitment.fulfilled} of{' '}
                    {foundingDesigner.publishingCommitment.required} projects this month
                  </p>
                  <div className="mt-2 h-2 bg-[var(--accent)]/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (foundingDesigner.publishingCommitment.fulfilled / foundingDesigner.publishingCommitment.required) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <h4 className="folio-ui font-medium text-[var(--text-primary)] mb-2">Your Benefits</h4>
                  <ul className="space-y-1.5">
                    {foundingDesigner.benefits.map((benefit, index) => (
                      <li key={index} className="folio-meta text-[var(--text-secondary)] flex items-center gap-2">
                        <svg className="w-4 h-4 text-[var(--accent)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </RidgeCardContent>
          </RidgeCard>
        )}

        {/* Upgrade Options */}
        {currentTier !== 'ENTERPRISE' && (
          <RidgeCard padding="lg">
            <RidgeCardHeader>
              <RidgeCardTitle>
                {currentTier === 'FREE' ? 'Upgrade Your Plan' : 'Other Plans'}
              </RidgeCardTitle>
            </RidgeCardHeader>
            <RidgeCardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TIER_ORDER.filter((tier) => tier !== currentTier && tier !== 'FREE').map((tierKey) => {
                  const tier = TIER_CONFIGS[tierKey];
                  const isUpgrade = TIER_ORDER.indexOf(tierKey) > TIER_ORDER.indexOf(currentTier);

                  return (
                    <div
                      key={tierKey}
                      className={`ridge-card ridge-card-sm p-4 ${
                        tier.highlighted ? '!border-[var(--accent)]' : ''
                      }`}
                    >
                      <h4 className="folio-ui font-semibold text-[var(--text-primary)]">{tier.name}</h4>
                      <p className="folio-meta text-[var(--text-tertiary)] mt-1">{tier.tagline}</p>
                      <div className="mt-3">
                        {tier.pricing ? (
                          <span className="folio-stat-lg">${tier.pricing.monthly}<span className="folio-meta text-[var(--text-tertiary)]">/mo</span></span>
                        ) : (
                          <span className="folio-ui font-semibold">Custom</span>
                        )}
                      </div>
                      <Link
                        href={tierKey === 'ENTERPRISE' ? '/contact?subject=enterprise' : `/pricing?highlight=${tierKey}`}
                        className={`mt-4 block w-full py-2.5 px-4 rounded-lg text-center folio-ui font-medium transition-all ${
                          isUpgrade
                            ? 'accent-btn'
                            : 'ridge-btn'
                        }`}
                      >
                        {tierKey === 'ENTERPRISE' ? 'Contact Sales' : isUpgrade ? 'Upgrade' : 'Switch Plan'}
                      </Link>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 text-center">
                <Link href="/pricing" className="folio-meta text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                  Compare all plans
                </Link>
              </div>
            </RidgeCardContent>
          </RidgeCard>
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
      <div className="flex justify-between folio-meta mb-1.5">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className={isNearLimit ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-primary)]'}>
          {current}
          {unit && ` ${unit}`}
          {!isUnlimited && ` / ${limit}${unit && ` ${unit}`}`}
          {isUnlimited && ' (unlimited)'}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-[var(--shadow-dark)]/30 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isNearLimit ? 'bg-[var(--accent)]' : 'bg-[var(--text-primary)]'
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
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0">
      <span className="folio-meta text-[var(--text-secondary)]">{label}</span>
      <span className="folio-ui font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function formatLimit(limit: number | null): string {
  if (limit === null || limit === -1) return 'Unlimited';
  return String(limit);
}

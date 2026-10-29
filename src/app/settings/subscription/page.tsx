'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import {
  type SubscriptionTierType,
  type TierConfig,
  TIER_CONFIGS,
  TIER_ORDER,
} from '@/lib/pricing/tiers';

interface SubscriptionData {
  subscription: {
    status: {
      tier: SubscriptionTierType;
      isActive: boolean;
      expiresAt: string | null;
      isFoundingDesigner: boolean;
      inGracePeriod: boolean;
      daysUntilExpiry: number | null;
    };
    config: TierConfig;
    limits: TierConfig['limits'];
    usage?: {
      projects: { count: number; limit: number | null };
      designerSeats: { count: number; limit: number };
    };
  };
  foundingDesigner: {
    isFoundingDesigner: boolean;
    publishingCommitment: {
      required: number;
      fulfilled: number;
    };
    benefits: string[];
  } | null;
}

const PLAN_INTRO: Record<SubscriptionTierType, string> = {
  FREE: 'Get to know Folio and start your first project.',
  PRO: 'Turn your projects and the thinking behind them into your studio’s magazine.',
  STUDIO: 'More room for the people behind your practice.',
  ENTERPRISE: 'A plan shaped around your organization.',
};

const primaryLink = 'inline-flex min-h-11 items-center justify-center rounded-full bg-folio-text-primary px-5 py-2.5 folio-ui text-surface-canvas transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-folio-text-primary';
const secondaryLink = 'inline-flex min-h-11 items-center justify-center rounded-full border border-folio-border-strong px-5 py-2.5 folio-ui text-folio-text-primary transition-colors hover:bg-surface-ground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-folio-text-primary';

export default function SubscriptionSettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin?callbackUrl=/settings/subscription');
      return;
    }
    if (status !== 'authenticated') return;

    const controller = new AbortController();
    setLoading(true);
    setError(false);

    async function fetchSubscription() {
      try {
        const response = await fetch('/api/subscription', { signal: controller.signal });
        if (!response.ok) throw new Error('Subscription unavailable');
        const data: SubscriptionData = await response.json();
        if (!controller.signal.aborted) setSubscriptionData(data);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void fetchSubscription();
    return () => controller.abort();
  }, [status, router, retry]);

  if (status === 'unauthenticated') {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="folio-h2 mb-4">Your subscription</h1>
        <p className="folio-body mb-6 text-folio-text-secondary">Log in to view your plan.</p>
        <Link className={primaryLink} href="/auth/signin?callbackUrl=/settings/subscription">Log in</Link>
      </div>
    );
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-folio-text-secondary" role="status">
        <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-folio-border-subtle border-t-folio-text-primary motion-reduce:animate-none" />
        <span className="folio-body">Loading your subscription…</span>
      </div>
    );
  }

  if (error || !subscriptionData) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="folio-h2 mb-4">Your subscription</h1>
        <p className="folio-body mb-6 text-folio-text-secondary" role="alert">We couldn’t load your plan. Please try again.</p>
        <button className={primaryLink} onClick={() => setRetry((value) => value + 1)}>Try again</button>
      </div>
    );
  }

  const { subscription, foundingDesigner } = subscriptionData;
  const { status: planStatus, config, limits, usage } = subscription;
  const currentTier = planStatus.tier;
  // The dedicated program response is narrower than the generic paid/no-expiry flag.
  const isFoundingDesigner = Boolean(foundingDesigner?.isFoundingDesigner);
  const otherTiers = TIER_ORDER.filter((tier) => tier !== currentTier && tier !== 'FREE');
  const expiryDate = planStatus.expiresAt ? new Date(planStatus.expiresAt).toLocaleDateString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
  }) : null;

  return (
    <div className="bg-surface-canvas text-folio-text-primary">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <Link href="/settings" className="folio-meta mb-8 inline-flex min-h-11 items-center gap-2 text-folio-text-secondary hover:text-folio-text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Settings
        </Link>

        <header className="mb-10 max-w-2xl">
          <h1 className="folio-h1">Your subscription</h1>
          <p className="folio-body mt-3 text-folio-text-secondary">A home for your work, and the stories behind it. Review your plan and what’s included.</p>
        </header>

        <section aria-labelledby="current-plan" className="rounded-3xl border border-folio-border-subtle bg-surface-ground p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
            <div className="max-w-lg">
              <p className="folio-meta mb-3 text-folio-text-secondary">Current plan</p>
              <div className="flex flex-wrap items-center gap-3">
                <h2 id="current-plan" className="folio-h2">Folio {config.name}</h2>
                {isFoundingDesigner && <span className="rounded-full border border-folio-border-strong px-3 py-1 folio-meta">Founding Designer</span>}
                {planStatus.inGracePeriod && <span className="rounded-full border border-folio-border-strong px-3 py-1 folio-meta">Renewal needed</span>}
                {!planStatus.isActive && <span className="rounded-full border border-folio-border-strong px-3 py-1 folio-meta">Expired</span>}
              </div>
              <p className="folio-body mt-3 text-folio-text-secondary">{PLAN_INTRO[currentTier]}</p>
            </div>
            <div className="shrink-0 sm:text-right">
              {isFoundingDesigner ? (
                <><p className="folio-stat">Complimentary</p><p className="folio-meta mt-1 text-folio-text-secondary">Lifetime Pro access</p></>
              ) : (
                <><p className="folio-meta mb-2 text-folio-text-secondary">{config.pricing?.monthly === 0 ? 'No subscription fee' : 'Standard plan rate'}</p><PlanPrice config={config} /></>
              )}
            </div>
          </div>

          {(expiryDate || isFoundingDesigner) && (
            <p className="folio-meta mt-6 border-t border-folio-border-subtle pt-5 text-folio-text-secondary">
              {isFoundingDesigner ? 'Your Founding Designer membership includes Pro at no cost.'
                : planStatus.inGracePeriod ? `Your subscription expired on ${expiryDate}. Renew to keep access to paid features.`
                : !planStatus.isActive ? `Your subscription expired on ${expiryDate}.`
                : `Your current access runs through ${expiryDate}.`}
            </p>
          )}
        </section>

        <section aria-labelledby="plan-includes" className="mt-10">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="plan-includes" className="folio-h3">Included in your plan</h2>
            <span className="folio-meta text-folio-text-secondary">{planStatus.isActive ? 'Your plan allowances' : 'Allowances when active'}</span>
          </div>
          <dl className="grid gap-x-10 md:grid-cols-2">
            <FeatureItem label="Projects" value={formatLimit(limits.projects)} detail={usage ? `${usage.projects.count} in your account` : undefined} />
            <FeatureItem label="Designer seats" value={formatLimit(limits.designerSeats)} />
            <FeatureItem label="Moodboards" value={formatLimit(limits.moodboards)} />
            <FeatureItem label="Clients per project" value={limits.clientsPerProject === 0 ? 'Not included' : formatLimit(limits.clientsPerProject)} />
            <FeatureItem label="AI editorial generations" value={limits.aiEditorialGenerationsPerMonth === null ? 'Unlimited' : limits.aiEditorialGenerationsPerMonth === 0 ? 'Not included' : `${limits.aiEditorialGenerationsPerMonth} / month`} />
            <FeatureItem label="Storage allowance" value={limits.storageGb === -1 ? 'Unlimited' : `${limits.storageGb} GB`} />
          </dl>
        </section>

        <section aria-labelledby="studio-archive" className="mt-10 rounded-3xl border border-folio-border-subtle bg-surface-ground p-6 sm:p-8">
          <p className="folio-meta mb-3 text-folio-text-secondary">Planned for Studio · Not available yet</p>
          <div className="grid gap-6 md:grid-cols-2 md:gap-10">
            <div>
              <h2 id="studio-archive" className="folio-h3">Ask your firm’s archive</h2>
              <p className="folio-body mt-3 text-folio-text-secondary">Give your team a way to find the details behind past projects. Search room specifications, materials and product selections in plain language.</p>
            </div>
            <div className="border-l border-folio-border-strong pl-5">
              <p className="folio-body">“What flooring did we use in the son’s bathroom in the Smith project?”</p>
              <p className="folio-meta mt-3 text-folio-text-secondary">The planned experience: an answer linked to the original room or specification, with access controlled by your firm.</p>
            </div>
          </div>
        </section>

        {isFoundingDesigner && foundingDesigner && (
          <section aria-labelledby="founding-membership" className="mt-10 rounded-3xl border border-folio-border-subtle p-6 sm:p-8">
            <h2 id="founding-membership" className="folio-h3">Your founding membership</h2>
            <p className="folio-body mt-3 text-folio-text-secondary">Thank you for helping shape Folio.</p>
            {foundingDesigner.publishingCommitment.required > 0 && (
              <div className="mt-5">
                <p id="publishing-commitment" className="folio-meta text-folio-text-secondary">Publishing commitment: {foundingDesigner.publishingCommitment.fulfilled} of {foundingDesigner.publishingCommitment.required} projects this month</p>
                <progress aria-labelledby="publishing-commitment" className="mt-2 h-1.5 w-full accent-[var(--folio-text-primary)]" value={Math.max(0, foundingDesigner.publishingCommitment.fulfilled)} max={foundingDesigner.publishingCommitment.required} />
              </div>
            )}
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {foundingDesigner.benefits.map((benefit) => <li key={benefit} className="flex items-start gap-2 folio-meta text-folio-text-secondary"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{benefit}</li>)}
            </ul>
          </section>
        )}

        {currentTier !== 'ENTERPRISE' && (
          <section aria-labelledby="other-plans" className="mt-12 border-t border-folio-border-subtle pt-10">
            <div className="mb-6 max-w-2xl">
              <h2 id="other-plans" className="folio-h3">Plans for your practice</h2>
              <p className="folio-body mt-2 text-folio-text-secondary">Compare the space and seats included as your practice grows.</p>
            </div>
            <div className={`grid gap-4 ${otherTiers.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              {otherTiers.map((tierKey) => {
                const tier = TIER_CONFIGS[tierKey];
                return (
                  <article key={tierKey} className="flex flex-col rounded-3xl border border-folio-border-subtle p-6">
                    <h3 className="folio-h3">{tier.name}</h3>
                    <p className="folio-body mb-6 mt-2 text-folio-text-secondary">{PLAN_INTRO[tierKey]}</p>
                    <div className="mt-auto"><PlanPrice config={tier} /></div>
                    <ul className="my-6 space-y-3 folio-meta text-folio-text-secondary">
                      <li>{tier.limits.designerSeats === -1 ? 'Unlimited designer seats' : `${tier.limits.designerSeats} designer ${tier.limits.designerSeats === 1 ? 'seat' : 'seats'} included`}</li>
                      <li>{formatLimit(tier.limits.projects)} projects</li>
                      <li>{tier.limits.storageGb === -1 ? 'Unlimited storage' : `${tier.limits.storageGb} GB storage`}</li>
                    </ul>
                    <Link href={tierKey === 'ENTERPRISE' ? 'mailto:support@folioad.com?subject=Enterprise%20membership' : `/pricing?highlight=${tierKey}`} className={tierKey === 'PRO' ? primaryLink : secondaryLink}>
                      {tierKey === 'ENTERPRISE' ? 'Contact Folio' : `Explore ${tier.name}`}
                    </Link>
                  </article>
                );
              })}
            </div>
            <Link href="/pricing" className="folio-ui mt-6 inline-flex min-h-11 items-center text-folio-text-secondary underline underline-offset-4 hover:text-folio-text-primary">Compare all plans</Link>
          </section>
        )}

        <p className="folio-meta mt-10 border-t border-folio-border-subtle pt-6 text-folio-text-secondary">Questions about your membership? <a href="mailto:support@folioad.com?subject=Subscription" className="inline-flex min-h-11 items-center text-folio-text-primary underline underline-offset-4">Contact Folio</a></p>
      </div>
    </div>
  );
}

function PlanPrice({ config }: { config: TierConfig }) {
  if (!config.pricing) return <p className="folio-stat">Let’s talk</p>;
  return (
    <div>
      <p><span className="folio-stat">${config.pricing.monthly}</span><span className="folio-meta text-folio-text-secondary"> / month</span></p>
      {config.pricing.monthly > 0 && <p className="folio-meta mt-2 text-folio-text-secondary">Or ${config.pricing.annually.toLocaleString()} / year, billed annually</p>}
    </div>
  );
}

function FeatureItem({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-folio-border-subtle py-4">
      <dt className="folio-body text-folio-text-secondary">{label}{detail && <span className="folio-meta mt-1 block">{detail}</span>}</dt>
      <dd className="folio-ui pt-0.5 text-right">{value}</dd>
    </div>
  );
}

function formatLimit(limit: number | null): string {
  return limit === null || limit === -1 ? 'Unlimited' : String(limit);
}

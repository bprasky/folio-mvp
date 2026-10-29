'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { PUBLIC_TIER_ORDER, hasFeature, type SubscriptionTierType, type TierConfig } from '@/lib/pricing/tiers';

interface FeatureComparisonProps {
  tiers: TierConfig[];
  currentTier?: SubscriptionTierType | null;
}

const planDescriptions: Partial<Record<SubscriptionTierType, string>> = {
  FREE: 'Get to know Folio.',
  PRO: 'Publish your work and the stories behind it.',
  STUDIO: 'Bring the people behind your practice.',
};

const featureGroups = [
  {
    name: 'Your work',
    features: [
      { label: 'Projects', value: (tier: TierConfig) => formatLimit(tier.limits.projects) },
      { label: 'Moodboards', value: (tier: TierConfig) => formatLimit(tier.limits.moodboards) },
      { label: 'Storage', value: (tier: TierConfig) => tier.limits.storageGb === -1 ? 'Unlimited' : `${tier.limits.storageGb} GB` },
    ],
  },
  {
    name: 'Publishing & discovery',
    features: [
      { label: 'Designer profile', value: (tier: TierConfig) => hasFeature(tier.id, 'basic_profile') },
      { label: 'Designer directory listing', value: (tier: TierConfig) => hasFeature(tier.id, 'directory_listing') },
      { label: 'Editorial publishing', value: (tier: TierConfig) => hasFeature(tier.id, 'full_publishing') },
      { label: 'AI editorial generations', detail: 'Per month', value: (tier: TierConfig) => tier.limits.aiEditorialGenerationsPerMonth === 0 ? false : formatLimit(tier.limits.aiEditorialGenerationsPerMonth) },
      { label: 'Product & vendor credits', value: (tier: TierConfig) => hasFeature(tier.id, 'product_tagging') },
    ],
  },
  {
    name: 'Working together',
    features: [
      { label: 'Team access', value: (tier: TierConfig) => hasFeature(tier.id, 'team_seats') },
      { label: 'Client collaborators', detail: 'Per project', value: (tier: TierConfig) => tier.limits.clientsPerProject === 0 ? false : formatLimit(tier.limits.clientsPerProject) },
    ],
  },
];

const rowHeading = 'sticky left-0 z-10 border-b border-r border-folio-border-subtle bg-surface-canvas px-4 py-4 text-left folio-ui md:px-6';
const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-folio-text-primary';

export function FeatureComparison({ tiers, currentTier }: FeatureComparisonProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');
  const headingId = useId();
  const scrollHintId = useId();
  const publicTiers = PUBLIC_TIER_ORDER.flatMap((id) => {
    const tier = tiers.find((item) => item.id === id);
    return tier ? [tier] : [];
  });
  const cellClass = (tier: TierConfig) => `border-b border-folio-border-subtle px-4 py-4 text-center folio-meta text-folio-text-primary ${tier.id === 'PRO' ? 'bg-surface-ground' : 'bg-surface-canvas'}`;

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h2 id={headingId} className="folio-h3">Compare memberships</h2>
          <p className="folio-body mt-2 text-folio-text-secondary">Choose the space and people your practice needs.</p>
        </div>
        <div className="shrink-0">
          <div role="group" aria-label="Billing frequency" className="inline-flex rounded-full border border-folio-border-strong p-1">
            {(['monthly', 'annually'] as const).map((cycle) => (
              <button key={cycle} type="button" aria-pressed={billingCycle === cycle} onClick={() => setBillingCycle(cycle)} className={`min-h-11 rounded-full px-5 folio-ui transition-colors ${focusRing} ${billingCycle === cycle ? 'bg-folio-text-primary text-surface-canvas' : 'text-folio-text-secondary hover:text-folio-text-primary'}`}>
                {cycle === 'monthly' ? 'Monthly' : 'Annually'}
              </button>
            ))}
          </div>
          <p className="folio-meta mt-2 text-folio-text-secondary sm:text-right">Two months free with annual billing</p>
        </div>
      </div>

      <p id={scrollHintId} className="folio-meta mb-3 text-folio-text-secondary md:hidden">Swipe to compare plans. Feature names stay in view.</p>
      <div role="region" aria-label="Membership prices and features" aria-describedby={scrollHintId} tabIndex={0} className={`relative isolate overflow-x-auto rounded-3xl border border-folio-border-subtle ${focusRing}`}>
        <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0">
          <caption className="sr-only">Free, Pro and Studio membership prices and included benefits. {billingCycle === 'monthly' ? 'Monthly billing.' : 'Annual billing; prices shown as monthly equivalents.'}</caption>
          <colgroup><col className="w-[160px] md:w-[28%]" />{publicTiers.map((tier) => <col key={tier.id} />)}</colgroup>
          <thead>
            <tr>
              <th scope="col" className={`${rowHeading} !py-7 align-top`}>
                <span className="folio-meta text-folio-text-secondary">The essentials</span>
                <p className="folio-body mt-4 font-normal text-folio-text-secondary">A home for your work, at every stage.</p>
              </th>
              {publicTiers.map((tier) => {
                const isCurrent = currentTier === tier.id;
                const price = billingCycle === 'monthly' ? tier.pricing?.monthly : tier.pricing?.annualMonthlyEquivalent;
                return (
                  <th key={tier.id} scope="col" className={`${cellClass(tier)} align-top !py-7 font-normal`}>
                    <span className="folio-meta block min-h-6 text-folio-text-secondary">{isCurrent ? 'Your plan' : tier.id === 'PRO' ? 'For your practice' : tier.id === 'STUDIO' ? 'For your team' : 'Start here'}</span>
                    <span className="folio-h3 mt-1 block">{tier.name}</span>
                    <p className="folio-meta mx-auto mt-3 min-h-12 max-w-[220px] text-folio-text-secondary">{planDescriptions[tier.id]}</p>
                    <p className="mt-5 whitespace-nowrap"><span className="folio-stat">${price}</span><span className="folio-meta text-folio-text-secondary"> / month</span></p>
                    <p className="folio-meta mt-2 min-h-10 text-folio-text-secondary">{price === 0 ? 'No subscription fee' : billingCycle === 'annually' ? `$${tier.pricing?.annually.toLocaleString()} billed annually` : 'Billed monthly'}</p>
                    {isCurrent ? (
                      <span className="folio-ui mt-3 flex min-h-11 items-center justify-center rounded-full border border-folio-border-subtle text-folio-text-secondary">Current plan</span>
                    ) : (
                      <Link href={tier.id === 'FREE' ? '/auth/signup' : `mailto:support@folioad.com?subject=${encodeURIComponent(`${tier.name} membership — ${billingCycle === 'monthly' ? 'monthly' : 'annual'} billing`)}`} className={`folio-ui mt-3 flex min-h-11 items-center justify-center rounded-full px-3 transition-opacity hover:opacity-75 ${focusRing} ${tier.id === 'PRO' ? 'bg-folio-text-primary text-surface-canvas' : 'border border-folio-border-strong text-folio-text-primary'}`}>
                        {tier.id === 'FREE' ? 'Get started' : `Ask about ${tier.name}`}
                      </Link>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={rowHeading}>People included</th>
              {publicTiers.map((tier) => <td key={tier.id} className={cellClass(tier)}>{formatLimit(tier.limits.designerSeats)}</td>)}
            </tr>
            <tr>
              <th scope="row" className={rowHeading}>Additional licenses</th>
              {publicTiers.map((tier) => (
                <td key={tier.id} className={cellClass(tier)}>
                  {tier.additionalSeatPricing ? (
                    <><span className="folio-ui">${billingCycle === 'monthly' ? tier.additionalSeatPricing.monthly : tier.additionalSeatPricing.annually}</span><span className="mt-1 block text-folio-text-secondary">per person / {billingCycle === 'monthly' ? 'month' : 'year'}</span></>
                  ) : <FeatureValue value={false} />}
                </td>
              ))}
            </tr>
          </tbody>
          {featureGroups.map((group) => (
            <tbody key={group.name}>
              <tr>
                <th scope="rowgroup" className={`${rowHeading} !bg-surface-ground !py-5 !font-normal text-folio-text-secondary`}>{group.name}</th>
                {publicTiers.map((tier) => <td key={tier.id} aria-hidden="true" className="border-b border-folio-border-subtle bg-surface-ground" />)}
              </tr>
              {group.features.map((feature) => (
                <tr key={feature.label}>
                  <th scope="row" className={rowHeading}>{feature.label}{'detail' in feature && <span className="folio-meta mt-1 block text-folio-text-secondary">{feature.detail}</span>}</th>
                  {publicTiers.map((tier) => <td key={tier.id} className={cellClass(tier)}><FeatureValue value={feature.value(tier)} /></td>)}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="folio-meta mt-4 text-folio-text-secondary">Standard membership rates. Contact Folio to arrange a paid membership. Additional Studio licenses follow your billing frequency.</p>
    </section>
  );
}

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === 'string') return <>{value}</>;
  return <><span className="sr-only">{value ? 'Included' : 'Not included'}</span>{value ? <Check aria-hidden="true" className="mx-auto h-4 w-4" /> : <Minus aria-hidden="true" className="mx-auto h-4 w-4 text-folio-text-secondary" />}</>;
}

function formatLimit(value: number | null) {
  return value === null || value === -1 ? 'Unlimited' : String(value);
}

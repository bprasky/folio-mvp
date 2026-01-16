'use client';

import { type TierConfig, type SubscriptionTierType } from '@/lib/pricing';

interface PricingCardProps {
  tier: TierConfig;
  currentTier: SubscriptionTierType | null;
  billingCycle: 'monthly' | 'annually';
  onSelect: (tier: SubscriptionTierType) => void;
}

export function PricingCard({
  tier,
  currentTier,
  billingCycle,
  onSelect,
}: PricingCardProps) {
  const isCurrentTier = currentTier === tier.id;
  const isHighlighted = tier.highlighted;
  const isEnterprise = tier.id === 'ENTERPRISE';

  const price = tier.pricing
    ? billingCycle === 'monthly'
      ? tier.pricing.monthly
      : tier.pricing.annualMonthlyEquivalent
    : null;

  const annualTotal = tier.pricing?.annually ?? null;

  return (
    <div
      className={`relative rounded-2xl border p-6 flex flex-col ${
        isHighlighted
          ? 'border-black bg-white shadow-lg ring-2 ring-black'
          : 'border-neutral-200 bg-white'
      } ${isCurrentTier ? 'ring-2 ring-blue-500' : ''}`}
    >
      {isHighlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-black text-white text-xs font-medium px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {isCurrentTier && (
        <div className="absolute -top-3 right-4">
          <span className="bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
            Current Plan
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-semibold text-neutral-900">{tier.name}</h3>
        <p className="text-sm text-neutral-500 mt-1">{tier.tagline}</p>
      </div>

      <div className="mb-6">
        {isEnterprise ? (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-neutral-900">Custom</span>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-neutral-900">
                ${price}
              </span>
              <span className="text-neutral-500">/mo</span>
            </div>
            {billingCycle === 'annually' && annualTotal && annualTotal > 0 && (
              <p className="text-sm text-neutral-500 mt-1">
                ${annualTotal} billed annually
              </p>
            )}
          </>
        )}
      </div>

      <p className="text-sm text-neutral-600 mb-6">{tier.description}</p>

      <div className="mb-6 flex-grow">
        <h4 className="text-sm font-medium text-neutral-900 mb-3">Includes:</h4>
        <ul className="space-y-2">
          <LimitItem
            label="Projects"
            value={tier.limits.projects}
            unit="project"
          />
          <LimitItem
            label="Moodboards"
            value={tier.limits.moodboards}
            unit="moodboard"
          />
          <LimitItem
            label="Designer seats"
            value={tier.limits.designerSeats}
            unit="seat"
          />
          <LimitItem
            label="Storage"
            value={tier.limits.storageGb}
            unit="GB"
            isStorage
          />
          {tier.limits.clientsPerProject !== 0 && (
            <LimitItem
              label="Client collaboration"
              value={tier.limits.clientsPerProject}
              unit="client"
            />
          )}
        </ul>
      </div>

      <button
        onClick={() => onSelect(tier.id)}
        disabled={isCurrentTier}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          isCurrentTier
            ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
            : isHighlighted
            ? 'bg-black text-white hover:bg-neutral-800'
            : isEnterprise
            ? 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200'
            : 'bg-neutral-900 text-white hover:bg-neutral-800'
        }`}
      >
        {isCurrentTier
          ? 'Current Plan'
          : isEnterprise
          ? 'Contact Sales'
          : tier.id === 'FREE'
          ? 'Get Started'
          : 'Upgrade'}
      </button>
    </div>
  );
}

function LimitItem({
  label,
  value,
  unit,
  isStorage = false,
}: {
  label: string;
  value: number | null;
  unit: string;
  isStorage?: boolean;
}) {
  const isUnlimited = value === null || value === -1;

  return (
    <li className="flex items-center gap-2 text-sm text-neutral-600">
      <svg
        className="w-4 h-4 text-green-500 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <span>
        {isUnlimited
          ? `Unlimited ${label.toLowerCase()}`
          : isStorage
          ? `${value} ${unit} storage`
          : `${value} ${unit}${value !== 1 ? 's' : ''}`}
      </span>
    </li>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { PricingCard } from '@/components/pricing/PricingCard';
import { FeatureComparison } from '@/components/pricing/FeatureComparison';
import { type SubscriptionTierType, type TierConfig, TIER_ORDER } from '@/lib/pricing';

interface PricingData {
  tiers: TierConfig[];
  features: Array<{
    key: string;
    label: string;
    description?: string;
    includedIn: SubscriptionTierType[];
  }>;
  featureGroups: Array<{
    name: string;
    features: Array<{
      key: string;
      label: string;
      description?: string;
      includedIn: SubscriptionTierType[];
    }>;
  }>;
  currentUserTier: SubscriptionTierType | null;
  competitiveBenchmarks: Array<{
    name: string;
    priceRange: string;
    features: string;
  }>;
}

export default function PricingPage() {
  const { data: session } = useSession();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('annually');
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    async function fetchPricing() {
      try {
        const response = await fetch('/api/pricing');
        const data = await response.json();
        setPricingData(data);
      } catch (error) {
        console.error('Failed to fetch pricing:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPricing();
  }, []);

  const handleSelectTier = (tier: SubscriptionTierType) => {
    if (tier === 'ENTERPRISE') {
      // Open contact form or redirect to contact page
      window.location.href = '/contact?subject=enterprise';
    } else if (tier === 'FREE') {
      // Redirect to signup
      window.location.href = '/auth/signup';
    } else {
      // Redirect to checkout (placeholder)
      window.location.href = `/checkout?tier=${tier}&billing=${billingCycle}`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900" />
      </div>
    );
  }

  if (!pricingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-500">Failed to load pricing information.</p>
      </div>
    );
  }

  const currentTier = pricingData.currentUserTier ?? (session?.user?.subscriptionTier as SubscriptionTierType);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-surface-canvas border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-4xl font-bold text-neutral-900 mb-4">
            Simple pricing for every stage
          </h1>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Folio prices for your business stage, not feature bundles.
            Upgrade as you grow, with features that match your practice.
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <span
              className={`text-sm ${
                billingCycle === 'monthly' ? 'text-neutral-900' : 'text-neutral-500'
              }`}
            >
              Monthly
            </span>
            <button
              onClick={() =>
                setBillingCycle(billingCycle === 'monthly' ? 'annually' : 'monthly')
              }
              className="relative w-14 h-7 bg-neutral-200 rounded-full transition-colors"
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-surface-canvas rounded-full shadow transition-transform ${
                  billingCycle === 'annually' ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
            <span
              className={`text-sm ${
                billingCycle === 'annually' ? 'text-neutral-900' : 'text-neutral-500'
              }`}
            >
              Annually
              <span className="ml-1 text-green-600 font-medium">Save 17%</span>
            </span>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {pricingData.tiers.map((tier) => (
            <PricingCard
              key={tier.id}
              tier={tier}
              currentTier={currentTier}
              billingCycle={billingCycle}
              onSelect={handleSelectTier}
            />
          ))}
        </div>
      </div>

      {/* Feature Comparison Toggle */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="flex items-center gap-2 mx-auto text-neutral-600 hover:text-neutral-900"
        >
          <span>{showComparison ? 'Hide' : 'Show'} full feature comparison</span>
          <svg
            className={`w-5 h-5 transition-transform ${
              showComparison ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* Feature Comparison Table */}
      {showComparison && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="bg-surface-canvas rounded-xl border border-neutral-200 p-6">
            <FeatureComparison
              featureGroups={pricingData.featureGroups}
              tiers={TIER_ORDER}
            />
          </div>
        </div>
      )}

      {/* ROI Section */}
      <div className="bg-surface-canvas border-y border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-neutral-900 mb-8 text-center">
            Why the subscription pays for itself
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-neutral-900 mb-2">3-5 hrs</div>
              <div className="text-neutral-600">
                saved per project with AI editorial generation
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-neutral-900 mb-2">$400+</div>
              <div className="text-neutral-600">
                value per project at $100+/hr billing rate
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-neutral-900 mb-2">$1,500</div>
              <div className="text-neutral-600">
                potential affiliate revenue from $30k in tagged products
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Competitive Benchmarks */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-neutral-900 mb-8 text-center">
          How we compare
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pricingData.competitiveBenchmarks.map((benchmark) => (
            <div
              key={benchmark.name}
              className="bg-surface-canvas rounded-xl border border-neutral-200 p-6"
            >
              <h3 className="font-medium text-neutral-900">{benchmark.name}</h3>
              <div className="text-lg font-semibold text-neutral-700 mt-1">
                {benchmark.priceRange}
              </div>
              <p className="text-sm text-neutral-500 mt-2">{benchmark.features}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <p className="text-neutral-600">
            Folio Pro at <span className="font-semibold">$39-49/mo</span> delivers more value
            than tools costing 2-3x as much.
          </p>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-neutral-100 border-t border-neutral-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-neutral-900 mb-8 text-center">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            <FaqItem
              question="How does client collaboration work?"
              answer="Clients are invited viewers, not paying users. With Pro or Studio, you can invite unlimited clients to view moodboards, leave comments and approvals, see tagged products with purchase paths, and track project evolution. The designer pays, the client gets access—just like the industry works."
            />
            <FaqItem
              question="What's the Founding Designer Program?"
              answer="We're inviting 5-20 founding designers to receive lifetime Pro access, free. In exchange, founding designers commit to publishing 1-2 projects per month, sharing to Instagram, and providing product feedback. Founding designers become case studies that help us grow the platform."
            />
            <FaqItem
              question="Can I switch plans?"
              answer="Yes, you can upgrade or downgrade at any time. When upgrading, you'll get immediate access to new features. When downgrading, your current features will remain active until the end of your billing period."
            />
            <FaqItem
              question="What happens to my projects if I downgrade?"
              answer="Your existing projects remain intact. On the Free tier, you won't be able to create new projects beyond your limit, but you'll always have access to your published work."
            />
            <FaqItem
              question="How does annual billing work?"
              answer="Annual billing gives you a 17% discount compared to monthly. You're billed once per year, and the price is locked in regardless of future increases."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-surface-canvas rounded-lg border border-neutral-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <span className="font-medium text-neutral-900">{question}</span>
        <svg
          className={`w-5 h-5 text-neutral-500 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-4">
          <p className="text-neutral-600">{answer}</p>
        </div>
      )}
    </div>
  );
}

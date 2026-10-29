'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronDown } from 'lucide-react';
import { FeatureComparison } from '@/components/pricing/FeatureComparison';
import { UpcomingArchiveTools } from '@/components/pricing/UpcomingArchiveTools';
import { type SubscriptionTierType, type TierConfig } from '@/lib/pricing/tiers';

interface PricingData {
  tiers: TierConfig[];
  currentUserTier: SubscriptionTierType | null;
}

export default function PricingPage() {
  const { data: session } = useSession();
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    async function fetchPricing() {
      try {
        const response = await fetch('/api/pricing', { signal: controller.signal });
        if (!response.ok) throw new Error('Pricing unavailable');
        const data: PricingData = await response.json();
        if (!controller.signal.aborted) setPricingData(data);
      } catch {
        if (!controller.signal.aborted) setPricingData(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void fetchPricing();
    return () => controller.abort();
  }, [retry]);

  if (loading) {
    return <div role="status" className="flex min-h-[50vh] items-center justify-center folio-body text-folio-text-secondary">Loading memberships…</div>;
  }

  if (!pricingData) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="folio-h2">Folio memberships</h1>
        <p role="alert" className="folio-body my-5 text-folio-text-secondary">We couldn’t load the plans. Please try again.</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 rounded-full bg-folio-text-primary px-6 py-3 folio-ui text-surface-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-folio-text-primary">Try again</button>
      </div>
    );
  }

  const currentTier = pricingData.currentUserTier ?? (session?.user?.subscriptionTier as SubscriptionTierType | undefined);
  const studio = pricingData.tiers.find((tier) => tier.id === 'STUDIO');

  return (
    <div className="bg-surface-canvas text-folio-text-primary">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <header className="mb-12 max-w-3xl">
          <p className="folio-meta mb-4 text-folio-text-secondary">Folio memberships</p>
          <h1 className="folio-h1">For your work.<br />For your practice.</h1>
          <p className="folio-body mt-5 max-w-2xl text-folio-text-secondary">Publish the projects and stories that define your practice. Bring your team when you’re ready.</p>
        </header>

        <FeatureComparison tiers={pricingData.tiers} currentTier={currentTier} isSignedIn={Boolean(session?.user)} />
        <div className="mt-12"><UpcomingArchiveTools /></div>

        <section aria-labelledby="membership-questions" className="mt-14 border-t border-folio-border-subtle pt-10">
          <h2 id="membership-questions" className="folio-h3 mb-6">A few things to know</h2>
          <FaqItem question="Does adding my team affect how much I can publish?" answer="Pro and Studio both include unlimited projects. Your publishing allowance does not depend on how many colleagues you add." />
          {studio?.additionalSeatPricing && <FaqItem question="How much does it cost to add my team?" answer={`Studio includes ${studio.limits.designerSeats} people. Additional licenses are $${studio.additionalSeatPricing.monthly} per person per month, or $${studio.additionalSeatPricing.annually} per person per year on annual billing.`} />}
          <FaqItem question="How does annual billing work?" answer="Pay once per year at the price of ten monthly payments. The same two-month discount applies to additional Studio licenses. The annual view shows the monthly equivalent and the full yearly charge." />
        </section>

        <p className="folio-body mt-10 text-folio-text-secondary">Need help choosing? <a href="mailto:support@folioad.com?subject=Folio%20membership" className="inline-flex min-h-11 items-center text-folio-text-primary underline underline-offset-4">Talk to Folio</a></p>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group border-b border-folio-border-subtle">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-5 py-5 folio-ui focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-folio-text-primary [&::-webkit-details-marker]:hidden">
        {question}<ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <p className="folio-body max-w-3xl pb-5 text-folio-text-secondary">{answer}</p>
    </details>
  );
}

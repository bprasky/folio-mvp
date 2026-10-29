'use client';

import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  DollarSign,
  Eye,
  Users,
  Check,
  ChevronRight,
  ArrowLeft,
  Building2
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TIER_CONFIGS, TIER_FEATURES, calculateMonthlyROI } from '@/lib/pricing/tiers';
import { toast } from 'sonner';
import { DESIGNER_EARLY_ACCESS_ENABLED } from '@/lib/pricing/early-access';

const PROFESSIONAL_BENEFITS = [
  {
    icon: ImageIcon,
    title: 'AI Image Generation',
    description: 'Generate photorealistic room concepts from your product selections. Create compelling visuals that bring your design vision to life.',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    icon: Eye,
    title: 'Visible Product Tags',
    description: 'Your product tags appear on the public feed, driving discovery and engagement with your curated selections.',
    color: 'bg-[var(--accent)]/10 text-[var(--accent)]',
  },
  {
    icon: DollarSign,
    title: 'Affiliate Revenue',
    description: 'Earn commissions when clients purchase products you\'ve tagged. Turn your expertise into passive income.',
    color: 'bg-green-100 text-green-600',
  },
  {
    icon: Users,
    title: 'Client Connections',
    description: 'Connect directly with homeowners seeking your design style. Build your client base through the platform.',
    color: 'bg-amber-100 text-amber-600',
  },
];

export default function DesignerUpgradePage() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const orgId = searchParams.get('orgId') || session?.user?.operatingAsOrgId;

  const [isYearly, setIsYearly] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orgDetails, setOrgDetails] = useState<{ name: string; status: string } | null>(null);

  const proConfig = TIER_CONFIGS.PRO;
  const roi = calculateMonthlyROI('PRO');

  // Fetch org details if we have an orgId
  useEffect(() => {
    if (DESIGNER_EARLY_ACCESS_ENABLED) return;
    if (orgId) {
      fetch(`/api/orgs/${orgId}`)
        .then(res => res.json())
        .then(data => {
          if (data.organization) {
            setOrgDetails({
              name: data.organization.name,
              status: data.organization.status
            });
          }
        })
        .catch(console.error);
    }
  }, [orgId]);

  const handleUpgrade = async () => {
    if (!orgId) {
      toast.error('No organization selected. Please join or create a design firm first.');
      return;
    }

    setIsProcessing(true);
    try {
      // In a real implementation, this would redirect to Stripe checkout
      // For now, we'll show a placeholder
      toast.info('Payment integration coming soon. Contact us to upgrade.');

      // TODO: Implement Stripe checkout
      // const response = await fetch('/api/checkout/create-session', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     orgId,
      //     plan: 'PRO',
      //     interval: isYearly ? 'year' : 'month'
      //   })
      // });
      // const { url } = await response.json();
      // window.location.href = url;
    } catch (error) {
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (DESIGNER_EARLY_ACCESS_ENABLED) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="folio-h1">Early designer access is complimentary</h1>
        <p className="folio-body mt-5">No payment or subscription upgrade is required during this first round.</p>
        <Link href="/projects" className="folio-ui mt-8 inline-flex min-h-11 items-center rounded-full bg-folio-text-primary px-6 py-3 text-surface-canvas">Back to your projects</Link>
      </div>
    );
  }

  const price = isYearly
    ? proConfig.pricing?.annualMonthlyEquivalent || 0
    : proConfig.pricing?.monthly || 0;

  const proFeatures = TIER_FEATURES.filter(f => f.includedInTiers.includes('PRO'));

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-folio-text-secondary hover:text-folio-text-primary mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to projects
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)] mb-6 shadow-[0_8px_24px_rgba(184,132,92,0.35)]">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="folio-h1 text-folio-text-primary mb-3">
            Upgrade to Professional
          </h1>
          <p className="folio-body text-folio-text-secondary max-w-xl mx-auto">
            Unlock the full potential of Folio with AI image generation, affiliate revenue, and premium visibility.
          </p>
          {orgDetails && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 ridge-card ridge-card-sm">
              <Building2 className="w-4 h-4 text-folio-text-secondary" />
              <span className="folio-ui text-folio-text-primary">{orgDetails.name}</span>
            </div>
          )}
        </div>

        {/* Pricing toggle */}
        <div className="flex justify-center mb-8">
          <div className="ridge-card ridge-card-sm p-1 inline-flex">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-4 py-2 rounded-lg folio-ui transition-all ${
                !isYearly
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-folio-text-secondary hover:text-folio-text-primary'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-4 py-2 rounded-lg folio-ui transition-all ${
                isYearly
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-folio-text-secondary hover:text-folio-text-primary'
              }`}
            >
              Yearly
              <span className="ml-2 text-xs opacity-80">Save 17%</span>
            </button>
          </div>
        </div>

        {/* Pricing card */}
        <div className="ridge-card ridge-card-lg p-8 mb-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="folio-ui text-[var(--accent)] font-medium mb-1">Professional</div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-folio-text-primary">
                  ${Math.round(price)}
                </span>
                <span className="folio-body text-folio-text-secondary">
                  /month
                </span>
              </div>
              {isYearly && (
                <div className="folio-meta text-folio-text-secondary mt-1">
                  ${proConfig.pricing?.annually}/year billed annually
                </div>
              )}
            </div>

            <Button
              onClick={handleUpgrade}
              disabled={isProcessing}
              className="accent-btn px-8 py-4 text-lg"
            >
              {isProcessing ? 'Processing...' : 'Upgrade Now'}
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-folio-border-subtle">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {proFeatures.slice(0, 8).map((feature) => (
                <div key={feature.key} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="folio-ui text-folio-text-secondary">{feature.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Benefits grid */}
        <h2 className="folio-h2 text-folio-text-primary text-center mb-8">
          What you'll unlock
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {PROFESSIONAL_BENEFITS.map((benefit) => (
            <div key={benefit.title} className="ridge-card ridge-card-lg p-6">
              <div className={`w-12 h-12 rounded-xl ${benefit.color} flex items-center justify-center mb-4`}>
                <benefit.icon className="w-6 h-6" />
              </div>
              <h3 className="folio-h3 text-folio-text-primary mb-2">{benefit.title}</h3>
              <p className="folio-body text-folio-text-secondary">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* ROI section */}
        <div className="ridge-card ridge-card-lg p-8 bg-gradient-to-br from-[var(--accent)]/5 to-[var(--accent)]/10 text-center">
          <h3 className="folio-h2 text-folio-text-primary mb-4">
            The math works in your favor
          </h3>
          <p className="folio-body text-folio-text-secondary max-w-2xl mx-auto mb-6">
            Save {roi.timeSavingsValue / 100} hours per project with AI editorial generation.
            At ${100}/hr, that's ${roi.timeSavingsValue} in time savings per project.
            Plus earn up to ${roi.affiliatePotential.toLocaleString()} in affiliate revenue on a typical project.
          </p>
          <div className="folio-meta text-folio-text-secondary">
            Break even in less than {Math.ceil(roi.monthlyBreakeven * 10) / 10} projects per month
          </div>
        </div>

        {/* Guarantee */}
        <div className="text-center mt-12">
          <p className="folio-body text-folio-text-secondary">
            14-day money-back guarantee. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

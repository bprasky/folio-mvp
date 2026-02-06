'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  Image as ImageIcon,
  DollarSign,
  Eye,
  Users,
  ChevronRight,
  Share2,
  Building2,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { OrgStatus } from '@/hooks/useUserCapabilities';
import { TIER_CONFIGS } from '@/lib/pricing/tiers';

interface ProfessionalUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string | null;
  orgName: string | null;
  orgStatus: OrgStatus;
  featureRequested?: 'image_generation' | 'affiliate' | 'client_connect' | 'general';
}

const PROFESSIONAL_FEATURES = [
  {
    icon: ImageIcon,
    title: 'AI Image Generation',
    description: 'Generate photorealistic room concepts from your selections',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    icon: Eye,
    title: 'Visible Product Tags',
    description: 'Your product tags appear on the public feed for discovery',
    color: 'bg-[var(--accent)]/10 text-[var(--accent)]',
  },
  {
    icon: DollarSign,
    title: 'Affiliate Revenue',
    description: 'Earn commissions when clients purchase tagged products',
    color: 'bg-green-100 text-green-600',
  },
  {
    icon: Users,
    title: 'Client Connections',
    description: 'Connect directly with homeowners seeking your style',
    color: 'bg-amber-100 text-amber-600',
  },
];

export function ProfessionalUpgradeModal({
  open,
  onOpenChange,
  orgId,
  orgName,
  orgStatus,
  featureRequested = 'general',
}: ProfessionalUpgradeModalProps) {
  const [shareEmail, setShareEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showShareForm, setShowShareForm] = useState(false);

  const proConfig = TIER_CONFIGS.PRO;
  const isUnclaimed = orgStatus === 'UNCLAIMED';
  const isClaimed = orgStatus === 'CLAIMED';

  const getFeatureTitle = () => {
    switch (featureRequested) {
      case 'image_generation':
        return 'AI Image Generation';
      case 'affiliate':
        return 'Affiliate Revenue';
      case 'client_connect':
        return 'Client Connections';
      default:
        return 'Professional Features';
    }
  };

  const handleShareUpgradeRequest = async () => {
    if (!shareEmail.trim() || !orgId) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/orgs/share-upgrade-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          recipientEmail: shareEmail.trim(),
          featureRequested,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send request');
      }

      toast.success('Upgrade request sent to account owner');
      setShareEmail('');
      setShowShareForm(false);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to send upgrade request');
    } finally {
      setIsSending(false);
    }
  };

  const handleClaimOrg = () => {
    // Navigate to claim flow
    window.location.href = `/professionals/join?orgId=${orgId}`;
  };

  const handleUpgrade = () => {
    // Navigate to upgrade/checkout flow
    window.location.href = `/professionals/designer/upgrade?orgId=${orgId}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-[0_4px_12px_rgba(184,132,92,0.3)]">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-semibold">Unlock {getFeatureTitle()}</div>
              <div className="text-sm font-normal text-[var(--text-secondary)]">
                Professional tier required
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Feature Highlight */}
          <div className="grid grid-cols-2 gap-3">
            {PROFESSIONAL_FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="p-3 ridge-card ridge-card-sm"
              >
                <div className={`w-8 h-8 rounded-lg ${feature.color} flex items-center justify-center mb-2`}>
                  <feature.icon className="w-4 h-4" />
                </div>
                <div className="folio-ui text-[var(--text-primary)] text-sm">{feature.title}</div>
                <div className="folio-meta text-xs mt-0.5">{feature.description}</div>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="ridge-card ridge-card-lg p-4 bg-gradient-to-br from-[var(--accent)]/5 to-[var(--accent)]/10">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-bold text-[var(--text-primary)]">
                  ${proConfig.pricing?.monthly}
                </span>
                <span className="text-[var(--text-secondary)]">/month</span>
              </div>
              <div className="text-right">
                <div className="folio-meta">or ${proConfig.pricing?.annualMonthlyEquivalent.toFixed(0)}/mo</div>
                <div className="folio-meta">billed annually</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <div className="folio-meta text-[var(--text-secondary)]">
                {proConfig.description}
              </div>
            </div>
          </div>

          {/* Unclaimed Org Flow */}
          {isUnclaimed && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-amber-800">
                      {orgName || 'This organization'} hasn't been claimed yet
                    </div>
                    <div className="text-sm text-amber-700 mt-1">
                      Claim your business profile to upgrade, or share this request with someone who can.
                    </div>
                  </div>
                </div>
              </div>

              {!showShareForm ? (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowShareForm(true)}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share with Owner
                  </Button>
                  <Button
                    className="flex-1 accent-btn"
                    onClick={handleClaimOrg}
                  >
                    Claim Business
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-[var(--text-secondary)]">
                    Enter the email of someone who can upgrade this account:
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="owner@designfirm.com"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowShareForm(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    className="w-full accent-btn"
                    onClick={handleShareUpgradeRequest}
                    disabled={!shareEmail.trim() || isSending}
                  >
                    {isSending ? 'Sending...' : 'Send Upgrade Request'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Claimed Org Flow - Direct Upgrade */}
          {isClaimed && (
            <div className="space-y-4">
              <div className="space-y-2">
                {[
                  'Unlimited AI image generations',
                  'Product tags visible on feed',
                  'Earn affiliate commissions',
                  'Priority directory placement',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-[var(--text-secondary)]">{item}</span>
                  </div>
                ))}
              </div>

              <Button
                className="w-full accent-btn py-6"
                onClick={handleUpgrade}
              >
                Upgrade to Professional
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>

              <div className="text-center folio-meta">
                Cancel anytime. 14-day money-back guarantee.
              </div>
            </div>
          )}

          {/* No org context - shouldn't happen but handle gracefully */}
          {!orgStatus && (
            <div className="text-center space-y-4">
              <div className="text-[var(--text-secondary)]">
                Join or create a design firm to access professional features.
              </div>
              <Button
                className="accent-btn"
                onClick={() => window.location.href = '/professionals/join'}
              >
                Get Started
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProfessionalUpgradeModal;

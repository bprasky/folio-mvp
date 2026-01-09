'use client';

import { ReactNode, useEffect, useState } from 'react';
import { VendorTier } from '@prisma/client';
import { VendorTierBadge } from './VendorTierBadge';

interface VendorTierGateProps {
  /** The minimum tier required to access the content */
  tier: VendorTier;
  /** Content to render when tier requirement is met */
  children: ReactNode;
  /** Optional fallback to render when tier requirement is not met */
  fallback?: ReactNode;
  /** Optional callback when upgrade is clicked */
  onUpgradeClick?: () => void;
  /** Show loading state while fetching tier */
  showLoading?: boolean;
}

const TIER_HIERARCHY: Record<VendorTier, number> = {
  STANDARD: 0,
  PRO: 1,
  ENTERPRISE: 2,
};

const TIER_FEATURE_NAMES: Record<VendorTier, string> = {
  STANDARD: 'Standard',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

type SubscriptionData = {
  tier: {
    current: VendorTier;
  };
};

/**
 * VendorTierGate - Conditionally render content based on vendor tier
 *
 * Usage:
 * <VendorTierGate tier="PRO">
 *   <CollaborationStoryEditor />
 * </VendorTierGate>
 */
export function VendorTierGate({
  tier,
  children,
  fallback,
  onUpgradeClick,
  showLoading = true,
}: VendorTierGateProps) {
  const [currentTier, setCurrentTier] = useState<VendorTier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTier() {
      try {
        const res = await fetch('/api/vendor/subscription');
        if (!res.ok) {
          if (res.status === 404) {
            // Not a vendor - default to STANDARD
            setCurrentTier('STANDARD');
            return;
          }
          throw new Error('Failed to fetch subscription');
        }
        const data: SubscriptionData = await res.json();
        setCurrentTier(data.tier.current);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setCurrentTier('STANDARD');
      } finally {
        setLoading(false);
      }
    }

    fetchTier();
  }, []);

  if (loading && showLoading) {
    return (
      <div className="animate-pulse bg-neutral-100 rounded-lg p-4 min-h-[100px]" />
    );
  }

  if (error) {
    console.warn('VendorTierGate error:', error);
  }

  const hasAccess =
    currentTier && TIER_HIERARCHY[currentTier] >= TIER_HIERARCHY[tier];

  if (hasAccess) {
    return <>{children}</>;
  }

  // Render fallback or default upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <VendorTierUpgradePrompt
      requiredTier={tier}
      currentTier={currentTier || 'STANDARD'}
      onUpgradeClick={onUpgradeClick}
    />
  );
}

interface VendorTierUpgradePromptProps {
  requiredTier: VendorTier;
  currentTier: VendorTier;
  onUpgradeClick?: () => void;
  title?: string;
  description?: string;
}

/**
 * Default upgrade prompt shown when tier requirement is not met
 */
export function VendorTierUpgradePrompt({
  requiredTier,
  currentTier,
  onUpgradeClick,
  title,
  description,
}: VendorTierUpgradePromptProps) {
  const tierName = TIER_FEATURE_NAMES[requiredTier];

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      // Default: navigate to subscription page
      window.location.href = '/vendor/subscription';
    }
  };

  return (
    <div className="border border-neutral-200 rounded-lg p-6 bg-gradient-to-br from-neutral-50 to-white">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-neutral-900">
              {title || `${tierName} Feature`}
            </h3>
            <VendorTierBadge tier={requiredTier} size="sm" />
          </div>
          <p className="text-sm text-neutral-600 mb-4">
            {description ||
              `This feature requires a ${tierName} subscription. Upgrade to unlock this and other premium features.`}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleUpgrade}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upgrade to {tierName}
            </button>
            <span className="text-xs text-neutral-500">
              Current tier: <VendorTierBadge tier={currentTier} size="sm" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check vendor tier access
 */
export function useVendorTier() {
  const [tier, setTier] = useState<VendorTier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTier() {
      try {
        const res = await fetch('/api/vendor/subscription');
        if (!res.ok) {
          if (res.status === 404) {
            setTier('STANDARD');
            return;
          }
          throw new Error('Failed to fetch subscription');
        }
        const data: SubscriptionData = await res.json();
        setTier(data.tier.current);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setTier('STANDARD');
      } finally {
        setLoading(false);
      }
    }

    fetchTier();
  }, []);

  const hasAccess = (requiredTier: VendorTier) =>
    tier ? TIER_HIERARCHY[tier] >= TIER_HIERARCHY[requiredTier] : false;

  return {
    tier,
    loading,
    error,
    hasAccess,
    isStandard: tier === 'STANDARD',
    isPro: tier === 'PRO' || tier === 'ENTERPRISE',
    isEnterprise: tier === 'ENTERPRISE',
  };
}

export default VendorTierGate;

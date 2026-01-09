'use client';

import { VendorTier } from '@prisma/client';

interface VendorTierBadgeProps {
  tier: VendorTier;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const TIER_STYLES: Record<VendorTier, { bg: string; text: string; border: string }> = {
  STANDARD: {
    bg: 'bg-neutral-100',
    text: 'text-neutral-600',
    border: 'border-neutral-200',
  },
  PRO: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  ENTERPRISE: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
};

const TIER_LABELS: Record<VendorTier, string> = {
  STANDARD: 'Standard',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

const SIZE_CLASSES = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
  lg: 'text-sm px-3 py-1.5',
};

/**
 * VendorTierBadge - Display the current vendor subscription tier
 */
export function VendorTierBadge({
  tier,
  size = 'md',
  showLabel = true,
}: VendorTierBadgeProps) {
  const styles = TIER_STYLES[tier];
  const label = TIER_LABELS[tier];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <span
      className={`
        inline-flex items-center gap-1
        uppercase tracking-wide font-medium
        rounded-full border
        ${styles.bg} ${styles.text} ${styles.border}
        ${sizeClass}
      `}
    >
      {tier === 'PRO' && (
        <svg
          className="w-3 h-3"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {tier === 'ENTERPRISE' && (
        <svg
          className="w-3 h-3"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {showLabel && label}
    </span>
  );
}

/**
 * VendorTierBadgeWithUpgrade - Badge with optional upgrade CTA
 */
export function VendorTierBadgeWithUpgrade({
  tier,
  size = 'md',
  onUpgradeClick,
}: VendorTierBadgeProps & { onUpgradeClick?: () => void }) {
  if (tier === 'ENTERPRISE') {
    return <VendorTierBadge tier={tier} size={size} />;
  }

  return (
    <div className="inline-flex items-center gap-2">
      <VendorTierBadge tier={tier} size={size} />
      {onUpgradeClick && (
        <button
          onClick={onUpgradeClick}
          className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium"
        >
          Upgrade
        </button>
      )}
    </div>
  );
}

export default VendorTierBadge;

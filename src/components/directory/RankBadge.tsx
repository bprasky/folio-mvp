'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface RankBadgeProps {
  rank: number | null;
  showRank?: boolean;
  variant?: 'inline' | 'badge' | 'compact';
  className?: string;
}

/**
 * RankBadge - Displays a designer's directory rank
 *
 * Variants:
 * - inline: "Sarah Chen · #14 on Folio" style for profile headers
 * - badge: Standalone badge with icon for profile cards
 * - compact: Just the rank number with minimal styling
 */
export function RankBadge({
  rank,
  showRank = true,
  variant = 'inline',
  className,
}: RankBadgeProps) {
  // Only show badge for top 100 designers
  if (!rank || rank > 100 || !showRank) {
    return null;
  }

  // Different styling based on rank tier
  const getTierStyle = () => {
    if (rank <= 10) {
      // Top 10 - Gold
      return 'text-amber-600 bg-amber-50 border-amber-200';
    } else if (rank <= 25) {
      // Top 25 - Silver
      return 'text-slate-600 bg-slate-50 border-slate-200';
    } else if (rank <= 50) {
      // Top 50 - Bronze
      return 'text-orange-700 bg-orange-50 border-orange-200';
    }
    // Top 100
    return 'text-folio-text-secondary bg-surface-ground border-[var(--border-subtle)]';
  };

  if (variant === 'inline') {
    return (
      <Link
        href="/directory"
        className={cn(
          'text-sm font-medium text-[var(--accent)] hover:underline',
          className
        )}
      >
        #{rank} on Folio
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link
        href="/directory"
        className={cn(
          'text-xs font-semibold',
          rank <= 10 ? 'text-amber-600' : 'text-folio-text-secondary',
          className
        )}
      >
        #{rank}
      </Link>
    );
  }

  // Badge variant
  return (
    <Link
      href="/directory"
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors hover:opacity-80',
        getTierStyle(),
        className
      )}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="opacity-70"
      >
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
      #{rank} on Folio
    </Link>
  );
}

interface RankBadgeWithChangeProps extends RankBadgeProps {
  rankChange?: number;
}

/**
 * RankBadgeWithChange - Shows rank with optional change indicator
 */
export function RankBadgeWithChange({
  rank,
  rankChange = 0,
  showRank = true,
  variant = 'badge',
  className,
}: RankBadgeWithChangeProps) {
  if (!rank || rank > 100 || !showRank) {
    return null;
  }

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <RankBadge rank={rank} showRank={showRank} variant={variant} />
      {rankChange !== 0 && (
        <span
          className={cn(
            'text-xs font-medium',
            rankChange > 0 ? 'text-green-600' : 'text-red-500'
          )}
        >
          {rankChange > 0 ? `↑${rankChange}` : `↓${Math.abs(rankChange)}`}
        </span>
      )}
    </div>
  );
}

interface PotentialRankProps {
  potentialRank: number;
  className?: string;
}

/**
 * PotentialRank - Shows non-Pro users what their rank would be
 * Used for conversion CTAs
 */
export function PotentialRank({ potentialRank, className }: PotentialRankProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border border-dashed border-[var(--border-subtle)] bg-surface-ground',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-folio-text-secondary mb-1">
            Your Potential Rank
          </p>
          <p className="text-2xl font-semibold text-folio-text-primary">
            #{potentialRank}
          </p>
        </div>
        <Link
          href="/settings/subscription"
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          Upgrade to Pro
        </Link>
      </div>
      <p className="mt-3 text-xs text-folio-text-tertiary">
        Upgrade to Pro to appear in the Folio Directory and compete with the industry&apos;s best.
      </p>
    </div>
  );
}

export default RankBadge;

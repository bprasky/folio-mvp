'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

interface ProGateProps {
  potentialRank?: number | null;
  className?: string;
}

/**
 * ProGate - Upsell component for non-Pro users viewing the directory
 * Shows their potential rank to drive conversion
 */
export function ProGate({ potentialRank, className }: ProGateProps) {
  return (
    <RidgeCard padding="xl" className={cn('text-center', className)}>
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--accent)]"
          >
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>

        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          Your Ranking
        </h3>

        <p className="text-[var(--text-secondary)] mb-4">
          You&apos;re not currently ranked in the Folio Directory.
        </p>

        {potentialRank && potentialRank <= 100 && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
            <p className="text-sm text-[var(--text-tertiary)] mb-1">
              Based on your current activity, you would rank approximately
            </p>
            <p className="text-4xl font-bold text-[var(--accent)]">
              #{potentialRank}
            </p>
          </div>
        )}

        <p className="text-sm text-[var(--text-tertiary)] mb-6">
          Upgrade to Pro to appear in the Folio Directory and compete with the industry&apos;s best.
        </p>

        <div className="space-y-3">
          <Link href="/settings/subscription">
            <Button variant="accent" className="w-full">
              Upgrade to Pro
            </Button>
          </Link>

          <Link href="/directory">
            <Button variant="ghost" className="w-full">
              View Directory
            </Button>
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
            Pro includes:
          </h4>
          <ul className="text-sm text-[var(--text-secondary)] space-y-2">
            <li className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-green-500"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Directory ranking visibility
            </li>
            <li className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-green-500"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Rank badge on your profile
            </li>
            <li className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-green-500"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Real-time ranking updates
            </li>
            <li className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-green-500"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Score breakdown and improvement tips
            </li>
          </ul>
        </div>
      </div>
    </RidgeCard>
  );
}

interface ProGateBannerProps {
  className?: string;
}

/**
 * ProGateBanner - Smaller banner version of ProGate
 * For showing at the top of the directory page for non-Pro users
 */
export function ProGateBanner({ className }: ProGateBannerProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg bg-gradient-to-r from-[var(--accent)]/10 to-[var(--accent)]/5 border border-[var(--accent)]/20',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-[var(--accent)]"
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Want to appear in the Directory?
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Upgrade to Pro to compete with the industry&apos;s best designers.
            </p>
          </div>
        </div>
        <Link href="/settings/subscription">
          <Button variant="accent" size="sm">
            Upgrade
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default ProGate;

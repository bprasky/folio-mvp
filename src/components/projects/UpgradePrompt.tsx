'use client';

import { Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { DESIGNER_EARLY_ACCESS_ENABLED } from '@/lib/pricing/early-access';

interface UpgradePromptProps {
  /** Optional className */
  className?: string;
  /** Variant - subtle for inline, prominent for standalone */
  variant?: 'subtle' | 'prominent';
}

/**
 * UpgradePrompt - Subtle upgrade nudge for free designers
 *
 * Not aggressive - just a gentle mention of what's available
 * with a professional upgrade.
 *
 * Uses Folio neumorphic ridge-card styling.
 */
export function UpgradePrompt({ className, variant = 'subtle' }: UpgradePromptProps) {
  if (DESIGNER_EARLY_ACCESS_ENABLED) return null;
  if (variant === 'subtle') {
    return (
      <Link
        href="/professionals/designer/upgrade"
        className={cn(
          "group flex items-center gap-3 p-4 ridge-card transition-all hover:shadow-lg",
          className
        )}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--accent)] flex items-center justify-center shadow-[0_4px_12px_rgba(184,132,92,0.3)]">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="folio-ui text-folio-text-primary">
            Unlock AI image generation
          </div>
          <div className="folio-meta mt-0.5">
            Generate room concepts and earn affiliate revenue
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-folio-text-tertiary group-hover:text-folio-text-secondary group-hover:translate-x-0.5 transition-all" />
      </Link>
    );
  }

  // Prominent variant for standalone placement
  return (
    <div className={cn(
      "ridge-card ridge-card-lg p-6",
      className
    )}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-[0_6px_20px_rgba(184,132,92,0.35)]">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="folio-h3 text-folio-text-primary mb-1">
            Professional Features Available
          </h3>
          <p className="folio-body text-folio-text-secondary mb-4">
            Upgrade to generate AI room concepts, make your product tags visible
            on the feed, and earn affiliate commissions on every click.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 ridge-card ridge-card-sm folio-meta">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              AI Image Generation
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 ridge-card ridge-card-sm folio-meta">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              Visible Product Tags
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 ridge-card ridge-card-sm folio-meta">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              Affiliate Earnings
            </span>
          </div>
          <Link
            href="/professionals/designer/upgrade"
            className="mt-5 accent-btn inline-flex items-center gap-2 px-6 py-3"
          >
            Learn More
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default UpgradePrompt;

'use client';

import { Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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
 * Uses liquid glass styling for premium look.
 */
export function UpgradePrompt({ className, variant = 'subtle' }: UpgradePromptProps) {
  if (variant === 'subtle') {
    return (
      <Link
        href="/professionals/designer/upgrade"
        className={cn(
          "group flex items-center gap-3 p-4 liquid-glass transition-all",
          className
        )}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[#8B7355] to-[#A09485] flex items-center justify-center shadow-[0_4px_12px_rgba(139,115,85,0.3)]">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[#1a1a1a]">
            Unlock AI image generation
          </div>
          <div className="text-xs text-[#666] mt-0.5">
            Generate room concepts and earn affiliate revenue
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-[#999] group-hover:text-[#666] group-hover:translate-x-0.5 transition-all" />
      </Link>
    );
  }

  // Prominent variant for standalone placement
  return (
    <div className={cn(
      "liquid-glass-muted p-6",
      className
    )}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#8B7355] to-[#A09485] flex items-center justify-center shadow-[0_6px_20px_rgba(139,115,85,0.35)]">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-[#1a1a1a] mb-1">
            Professional Features Available
          </h3>
          <p className="text-sm text-[#555] mb-4">
            Upgrade to generate AI room concepts, make your product tags visible
            on the feed, and earn affiliate commissions on every click.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 liquid-glass-pill text-xs text-[#555]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]" />
              AI Image Generation
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 liquid-glass-pill text-xs text-[#555]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]" />
              Visible Product Tags
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 liquid-glass-pill text-xs text-[#555]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]" />
              Affiliate Earnings
            </span>
          </div>
          <Link
            href="/professionals/designer/upgrade"
            className={cn(
              "mt-5 liquid-btn-dark inline-flex items-center gap-2 px-6 py-3",
              "text-white/95 text-sm font-medium"
            )}
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

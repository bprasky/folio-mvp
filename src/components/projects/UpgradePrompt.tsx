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
 */
export function UpgradePrompt({ className, variant = 'subtle' }: UpgradePromptProps) {
  if (variant === 'subtle') {
    return (
      <Link
        href="/professionals/designer/upgrade"
        className={cn(
          "group flex items-center gap-3 p-4 rounded-xl transition-all",
          "bg-gradient-to-r from-white/50 to-white/30",
          "border border-white/40 hover:border-white/60",
          "hover:from-white/60 hover:to-white/40",
          className
        )}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[#8B7355] to-[#A09485] flex items-center justify-center">
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
        <ChevronRight className="h-4 w-4 text-[#999] group-hover:text-[#666] transition-colors" />
      </Link>
    );
  }

  // Prominent variant for standalone placement
  return (
    <div className={cn(
      "warm-glass--muted p-6 rounded-2xl",
      className
    )}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#8B7355] to-[#A09485] flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-[#1a1a1a] mb-1">
            Professional Features Available
          </h3>
          <p className="text-sm text-[#666] mb-4">
            Upgrade to generate AI room concepts, make your product tags visible
            on the feed, and earn affiliate commissions on every click.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 border border-white/40 text-xs text-[#666]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]" />
              AI Image Generation
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 border border-white/40 text-xs text-[#666]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]" />
              Visible Product Tags
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 border border-white/40 text-xs text-[#666]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B7355]" />
              Affiliate Earnings
            </span>
          </div>
          <Link
            href="/professionals/designer/upgrade"
            className={cn(
              "mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full",
              "bg-gradient-to-r from-[#8B7355] to-[#A09485]",
              "text-white text-sm font-medium",
              "hover:from-[#7A654A] hover:to-[#8F847A]",
              "transition-all shadow-sm hover:shadow-md"
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

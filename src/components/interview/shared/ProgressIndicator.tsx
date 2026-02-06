"use client";

import { cn } from "@/lib/utils";

interface ProgressIndicatorProps {
  current: number; // 0-indexed current position
  total: number; // Approximate total (can change)
  variant?: "dots" | "line";
}

/**
 * ProgressIndicator
 *
 * Simple dot-based progress, not a numbered counter.
 * Conveys rough position without creating "must complete X" pressure.
 *
 * Dots variant:
 * - 5 dots max displayed
 * - Filled dot: bg-[var(--text-primary)]
 * - Empty dot: bg-[var(--text-tertiary)]/30
 * - If total > 5, show first few filled + "..." + remaining
 *
 * Line variant:
 * - Thin line: h-1 bg-[var(--bg-elevated)] rounded-full
 * - Fill: h-1 bg-[var(--text-primary)] rounded-full, width = (current/total * 100)%
 *
 * DO NOT show: "Question 3 of 12" or "0/4" counters
 */
export function ProgressIndicator({
  current,
  total,
  variant = "dots",
}: ProgressIndicatorProps) {
  if (variant === "line") {
    const progress = total > 0 ? Math.min((current / total) * 100, 100) : 0;

    return (
      <div className="w-full max-w-xs">
        <div className="h-1 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
          <div
            className="h-1 bg-[var(--text-primary)] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // Dots variant
  const maxDots = 5;
  const displayTotal = Math.min(total, maxDots);
  const showEllipsis = total > maxDots;

  // Calculate how many dots should be filled
  // If we have more questions than dots, scale proportionally
  const filledDots =
    total <= maxDots
      ? current
      : Math.min(Math.ceil((current / total) * maxDots), maxDots);

  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: displayTotal }).map((_, index) => {
        const isFilled = index < filledDots;
        return (
          <div
            key={index}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-200",
              isFilled ? "bg-[var(--text-primary)] scale-100" : "bg-[var(--text-tertiary)]/30 scale-[0.85]"
            )}
          />
        );
      })}
      {showEllipsis && (
        <span className="text-[var(--text-tertiary)] text-xs tracking-wider">...</span>
      )}
    </div>
  );
}

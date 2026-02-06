"use client";

import { useEffect, useState } from "react";

interface FollowUpTransitionProps {
  previousAnswer: string;
  isGenerating: boolean;
  minDisplayTime?: number; // minimum 800ms
  maxDisplayTime?: number; // maximum 3000ms
}

/**
 * FollowUpTransition
 *
 * Brief interstitial shown while AI generates follow-up question.
 * Shows the user's previous answer and a loading state.
 *
 * Layout:
 * 1. Card showing "Your answer:" with truncated previous response
 * 2. Below: Three animated dots with "Finding a follow-up..."
 *
 * Timing: Should appear for minimum 800ms, maximum 3000ms
 * If AI takes longer, show anyway and update when ready
 */
export function FollowUpTransition({
  previousAnswer,
  isGenerating,
  minDisplayTime = 800,
}: FollowUpTransitionProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-6 py-8">
      {/* Previous answer card */}
      <div className="w-full max-w-md mb-8">
        <div className="bg-[var(--bg-elevated)] rounded-lg p-4">
          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-2">
            Your answer
          </p>
          <p className="text-[var(--text-primary)] line-clamp-3 text-sm leading-relaxed">
            {previousAnswer}
          </p>
        </div>
      </div>

      {/* Loading indicator */}
      {isGenerating && (
        <div className="flex flex-col items-center">
          <LoadingDots />
          <p className="text-sm text-[var(--text-secondary)] mt-3">Finding a follow-up...</p>
        </div>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="w-2 h-2 bg-[var(--text-tertiary)]/40 rounded-full animate-pulse"
          style={{
            animationDelay: `${index * 200}ms`,
            animationDuration: "1.2s",
          }}
        />
      ))}
    </div>
  );
}

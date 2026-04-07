"use client";

import { Mic, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModeSelectionProps {
  onSelectVoice: () => void;
  onSelectText: () => void;
  voiceAvailable: boolean;
  projectTitle: string;
  imageCount: number;
}

/**
 * ModeSelection
 *
 * Two-card selection for voice vs text interview mode.
 * Both cards equal weight - no hierarchy.
 *
 * Layout: Two cards side by side on desktop, stacked on mobile
 * Styling:
 * - Cards: bg-surface-canvas, rounded-xl, p-8, hover:shadow-lg transition
 * - Icons: 48px, muted gray, centered
 * - Headline: text-lg font-medium
 * - Description: text-sm text-folio-text-secondary, 2 lines max
 * - CTA: Full-width button at bottom of card
 * - Footer: Centered text below both cards "Both create the same editorial draft"
 *
 * Degraded state (voiceAvailable: false):
 * - Voice card: opacity-50, no hover effect
 * - Voice CTA replaced with "Unavailable right now" + small "Why?" link
 * - Text card: fully functional, slight visual emphasis
 */
export function ModeSelection({
  onSelectVoice,
  onSelectText,
  voiceAvailable,
  projectTitle,
  imageCount,
}: ModeSelectionProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-medium text-folio-text-primary mb-2">
          Tell us about {projectTitle}
        </h2>
        <p className="text-folio-text-secondary">
          {imageCount} {imageCount === 1 ? "image" : "images"} to discuss
        </p>
      </div>

      {/* Mode cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mb-8">
        {/* Voice Card */}
        <div
          className={cn(
            "bg-surface-canvas rounded-xl p-8 flex flex-col items-center text-center transition-all duration-200",
            voiceAvailable
              ? "hover:shadow-lg cursor-pointer border border-folio-border-subtle"
              : "opacity-50 border border-folio-border-subtle"
          )}
          onClick={voiceAvailable ? onSelectVoice : undefined}
        >
          <div className="w-12 h-12 rounded-full bg-surface-ground flex items-center justify-center mb-4">
            <Mic className="w-6 h-6 text-folio-text-secondary" />
          </div>
          <h3 className="text-lg font-medium text-folio-text-primary mb-2">
            Have a conversation
          </h3>
          <p className="text-sm text-folio-text-secondary mb-6 line-clamp-2">
            Talk through your project naturally for 3-5 minutes
          </p>
          {voiceAvailable ? (
            <button
              type="button"
              onClick={onSelectVoice}
              className="w-full py-3 px-4 bg-[var(--text-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-colors"
            >
              Start talking →
            </button>
          ) : (
            <div className="w-full text-center">
              <span className="text-folio-text-tertiary text-sm">
                Unavailable right now
              </span>
              <button
                type="button"
                className="ml-2 text-xs text-folio-text-tertiary underline hover:text-folio-text-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  // Could show a tooltip or modal explaining why
                }}
              >
                Why?
              </button>
            </div>
          )}
        </div>

        {/* Text Card */}
        <div
          className={cn(
            "bg-surface-canvas rounded-xl p-8 flex flex-col items-center text-center transition-all duration-200 hover:shadow-lg cursor-pointer",
            !voiceAvailable
              ? "border-2 border-folio-border-subtle"
              : "border border-folio-border-subtle"
          )}
          onClick={onSelectText}
        >
          <div className="w-12 h-12 rounded-full bg-surface-ground flex items-center justify-center mb-4">
            <PenLine className="w-6 h-6 text-folio-text-secondary" />
          </div>
          <h3 className="text-lg font-medium text-folio-text-primary mb-2">
            Write your responses
          </h3>
          <p className="text-sm text-folio-text-secondary mb-6 line-clamp-2">
            Answer at your own pace with guided questions
          </p>
          <button
            type="button"
            onClick={onSelectText}
            className="w-full py-3 px-4 bg-[var(--text-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-colors"
          >
            Start writing →
          </button>
        </div>
      </div>

      {/* Footer */}
      <p className="text-sm text-folio-text-tertiary">
        Both create the same editorial draft
      </p>
    </div>
  );
}

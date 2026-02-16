"use client";

interface FooterBarProps {
  phase: "question" | "followup" | "complete";
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  onGenerate?: () => void;
  onSkip?: () => void;
  canProceed: boolean;
  isSubmitting?: boolean;
  isGenerating?: boolean;
  isLoadingFollowUps?: boolean;
}

export function FooterBar({
  phase,
  onBack,
  onNext,
  onSubmit,
  onGenerate,
  onSkip,
  canProceed,
  isSubmitting = false,
  isGenerating = false,
  isLoadingFollowUps = false,
}: FooterBarProps) {
  return (
    <div className="px-8 py-4 border-t border-[var(--ridge-outer)]/50 bg-white/50">
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <div>
          {/* Back button - less relevant in sequential flow, but available for navigation */}
          {phase === "question" && onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex gap-3">
          {phase === "question" && (
            <>
              {onSubmit && (
                <button
                  onClick={onSubmit}
                  disabled={!canProceed || isSubmitting || isLoadingFollowUps}
                  className="px-6 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-full hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isLoadingFollowUps ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Generating follow-ups...
                    </>
                  ) : isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue
                      <span className="text-xs opacity-75 ml-1">(⌘+Enter)</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
          {phase === "followup" && (
            <>
              {onSkip && (
                <button
                  onClick={onSkip}
                  disabled={isGenerating}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
                >
                  Skip
                </button>
              )}
              {onNext && (
                <button
                  onClick={onNext}
                  disabled={!canProceed || isSubmitting}
                  className="px-6 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-full hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? "Saving..." : "Continue"}
                </button>
              )}
            </>
          )}
          {phase === "complete" && onGenerate && (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              type="button"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Generating...
                </>
              ) : (
                "Generate Editorial"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


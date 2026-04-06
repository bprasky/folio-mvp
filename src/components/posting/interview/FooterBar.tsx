"use client";

const MAX_GENERATION_ATTEMPTS = 3;

interface FooterBarProps {
  phase: "question" | "followup" | "complete";
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  onGenerate?: () => void;
  onSkip?: () => void;
  onSkipRoom?: () => void;
  skipRoomLabel?: string;
  canProceed: boolean;
  isSubmitting?: boolean;
  isGenerating?: boolean;
  isLoadingFollowUps?: boolean;
  isLastQuestion?: boolean;
  isInterviewComplete?: boolean;
  isNearFinish?: boolean;
  generationProgressMessage?: string;
  generationAttempts?: number;
}

export function FooterBar({
  phase,
  onBack,
  onNext,
  onSubmit,
  onGenerate,
  onSkip,
  onSkipRoom,
  skipRoomLabel,
  canProceed,
  isSubmitting = false,
  isGenerating = false,
  isLoadingFollowUps = false,
  isLastQuestion = false,
  isInterviewComplete = false,
  isNearFinish = false,
  generationProgressMessage,
  generationAttempts = 0,
}: FooterBarProps) {
  const maxAttemptsReached = generationAttempts >= MAX_GENERATION_ATTEMPTS;

  return (
    <div className="px-8 py-4 border-t border-folio-border-subtle/50 bg-white/25">
      {/* Near-finish hint — one question before "Finish & Generate Story" appears */}
      {phase === "question" && isNearFinish && (
        <p
          className="text-xs text-folio-text-secondary text-center mb-3 max-w-md mx-auto"
          style={{ fontFamily: "var(--font-headline)", fontStyle: "italic" }}
        >
          You&apos;ve answered enough for a great story. One more question, then you can finish or keep going for more depth.
        </p>
      )}
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <div>
          {/* Back button — go to previous question to review/revise */}
          {phase === "question" && onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-folio-text-secondary hover:text-folio-text-primary border border-folio-border-subtle/30 rounded-full hover:border-folio-border-subtle/60 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-70">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Previous
            </button>
          )}
        </div>
        <div className="flex gap-3">
          {phase === "question" && (
            <>
              {onSkipRoom && (
                <button
                  onClick={onSkipRoom}
                  className="px-4 py-2 text-sm font-medium text-folio-text-secondary hover:text-folio-text-primary transition-colors"
                >
                  {skipRoomLabel || "Skip room \u2192"}
                </button>
              )}
              {onSubmit && (
                <button
                  onClick={onSubmit}
                  disabled={!canProceed || isSubmitting || isLoadingFollowUps}
                  className="px-6 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-full hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isLoadingFollowUps ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Loading follow-ups...
                    </>
                  ) : isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : isInterviewComplete && isLastQuestion ? (
                    <>
                      Finish & Generate Story
                      <span className="text-xs opacity-75 ml-1">(⌘+Enter)</span>
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
                  className="px-4 py-2 text-sm font-medium text-folio-text-secondary hover:text-folio-text-primary disabled:opacity-50 transition-colors"
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
          {phase === "complete" && onGenerate && !isGenerating && (
            <button
              onClick={maxAttemptsReached ? undefined : onGenerate}
              disabled={maxAttemptsReached}
              className={`px-6 py-2 text-sm font-medium rounded-full transition-colors ${
                maxAttemptsReached
                  ? "text-folio-text-tertiary bg-surface-canvas border border-folio-border-subtle cursor-not-allowed"
                  : "text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
              }`}
              type="button"
            >
              {maxAttemptsReached
                ? "Contact Support"
                : generationAttempts > 0
                ? `Retry Generation (${generationAttempts}/${MAX_GENERATION_ATTEMPTS})`
                : "Retry Generation"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

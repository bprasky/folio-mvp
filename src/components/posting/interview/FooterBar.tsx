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
  isLastQuestion?: boolean;
  generationProgressMessage?: string;
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
  isLastQuestion = false,
  generationProgressMessage,
}: FooterBarProps) {
  return (
    <div className="px-8 py-4 border-t border-[var(--ridge-outer)]/50 bg-white/50">
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <div>
          {/* Back button — go to previous question to review/revise */}
          {phase === "question" && onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--ridge-outer)]/30 rounded-full hover:border-[var(--ridge-outer)]/60 transition-colors"
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
                  ) : isLastQuestion ? (
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
          {phase === "complete" && onGenerate && !isGenerating && (
            <button
              onClick={onGenerate}
              className="px-6 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-full hover:bg-[var(--accent-hover)] transition-colors"
              type="button"
            >
              Retry Generation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


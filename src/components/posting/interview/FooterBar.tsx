"use client";

import { Clock, ChevronLeft } from "lucide-react";

const MAX_GENERATION_ATTEMPTS = 3;

interface FooterBarProps {
  phase: "question" | "followup" | "complete";
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  onGenerate?: () => void;
  onSkip?: () => void;
  /** Question-phase Skip (A2). Always present; opens the skip choice sheet. */
  onQuestionSkip?: () => void;
  canProceed: boolean;
  isSubmitting?: boolean;
  isGenerating?: boolean;
  isLoadingFollowUps?: boolean;
  isLastQuestion?: boolean;
  isInterviewComplete?: boolean;
  isNearFinish?: boolean;
  generationProgressMessage?: string;
  generationAttempts?: number;
  /** Question-phase meta shown on the left (clock + "N of M rooms"). */
  roomMeta?: { index: number; total: number };
}

// Copper gradient primary pill — the one loud control in the footer.
const CONTINUE_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)",
  boxShadow: "var(--shadow-2)",
};

export function FooterBar({
  phase,
  onBack,
  onNext,
  onSubmit,
  onGenerate,
  onSkip,
  onQuestionSkip,
  canProceed,
  isSubmitting = false,
  isGenerating = false,
  isLoadingFollowUps = false,
  isLastQuestion = false,
  isInterviewComplete = false,
  isNearFinish = false,
  generationProgressMessage,
  generationAttempts = 0,
  roomMeta,
}: FooterBarProps) {
  const maxAttemptsReached = generationAttempts >= MAX_GENERATION_ATTEMPTS;

  return (
    <div
      className="border-t px-8 py-5 md:px-12"
      style={{ borderColor: "var(--folio-border-subtle)" }}
    >
      {/* Near-finish hint — one question before "Finish & Generate Story" appears */}
      {phase === "question" && isNearFinish && (
        <p
          className="mx-auto mb-4 max-w-md text-center text-xs italic text-folio-text-secondary"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          You&apos;ve answered enough for a great story. One more question, then
          you can finish or keep going for more depth.
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        {/* Left — question-phase meta (clock + rooms), with an optional Back. */}
        <div className="flex min-w-0 items-center gap-3">
          {phase === "question" && onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-sm font-medium text-folio-text-secondary transition-colors hover:text-folio-text-primary"
              aria-label="Previous question"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}
          {phase === "question" && roomMeta && (
            <span className="flex items-center gap-1.5 text-xs text-folio-text-secondary">
              <Clock className="h-3.5 w-3.5 text-folio-text-tertiary" />
              {roomMeta.index} of {roomMeta.total} rooms
            </span>
          )}
        </div>

        {/* Right — actions. */}
        <div className="flex items-center gap-2">
          {phase === "question" && (
            <>
              {onQuestionSkip && (
                <button
                  type="button"
                  onClick={onQuestionSkip}
                  disabled={isSubmitting || isLoadingFollowUps}
                  className="px-4 py-2 text-sm font-medium text-folio-text-secondary transition-colors hover:text-folio-text-primary disabled:opacity-50"
                >
                  Skip
                </button>
              )}
              {onSubmit && (
                <button
                  onClick={onSubmit}
                  disabled={!canProceed || isSubmitting || isLoadingFollowUps}
                  className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-px disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                  style={CONTINUE_STYLE}
                >
                  {isLoadingFollowUps ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Loading follow-ups…
                    </>
                  ) : isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving…
                    </>
                  ) : isInterviewComplete && isLastQuestion ? (
                    <>
                      Finish &amp; generate story
                      <span className="ml-1 text-xs opacity-75">⌘↵</span>
                    </>
                  ) : (
                    <>
                      Continue
                      <span className="ml-1 text-xs opacity-75">⌘↵</span>
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
                  className="px-4 py-2 text-sm font-medium text-folio-text-secondary transition-colors hover:text-folio-text-primary disabled:opacity-50"
                >
                  Skip
                </button>
              )}
              {onNext && (
                <button
                  onClick={onNext}
                  disabled={!canProceed || isSubmitting}
                  className="rounded-full px-6 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-px disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                  style={CONTINUE_STYLE}
                >
                  {isSubmitting ? "Saving…" : "Continue"}
                </button>
              )}
            </>
          )}
          {phase === "complete" && onGenerate && !isGenerating && (
            <button
              onClick={maxAttemptsReached ? undefined : onGenerate}
              disabled={maxAttemptsReached}
              className={`rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-200 ${
                maxAttemptsReached
                  ? "cursor-not-allowed border border-folio-border-subtle bg-surface-canvas text-folio-text-tertiary"
                  : "text-white hover:-translate-y-px"
              }`}
              style={maxAttemptsReached ? undefined : CONTINUE_STYLE}
              type="button"
            >
              {maxAttemptsReached
                ? "Contact support"
                : generationAttempts > 0
                ? `Retry generation (${generationAttempts}/${MAX_GENERATION_ATTEMPTS})`
                : "Retry generation"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

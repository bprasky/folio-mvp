"use client";

import { Volume2 } from "lucide-react";
import { InterviewQuestion } from "../shared/InterviewQuestion";
import { ProgressIndicator } from "../shared/ProgressIndicator";
import type { InterviewQuestion as IInterviewQuestion } from "../types";

interface AIResponseProps {
  question: IInterviewQuestion;
  audioUrl: string;
  onAudioComplete: () => void;
  questionNumber: number;
  totalQuestions: number;
  onSkip: () => void;
  onEndInterview: () => void;
}

/**
 * AIResponse
 *
 * State when AI is speaking the follow-up question.
 * Phase 2 implementation - currently a placeholder.
 */
export function AIResponse({
  question,
  audioUrl,
  onAudioComplete,
  questionNumber,
  totalQuestions,
  onSkip,
  onEndInterview,
}: AIResponseProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Progress indicator */}
      <div className="px-6 pt-6">
        <ProgressIndicator
          current={questionNumber}
          total={totalQuestions}
          variant="dots"
        />
      </div>

      {/* Question section */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8">
        <InterviewQuestion question={question.text} context={question.context} />

        {/* Speaker indicator */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <Volume2 className="w-5 h-5 text-[var(--accent)] animate-pulse" />
          <span className="text-sm text-[var(--text-secondary)]">AI speaking...</span>
        </div>
      </div>

      {/* Footer controls */}
      <div className="p-6 flex justify-center gap-4 border-t">
        <button
          onClick={onSkip}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm"
        >
          Skip this question
        </button>
        <button
          onClick={onEndInterview}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm"
        >
          End interview early
        </button>
      </div>
    </div>
  );
}

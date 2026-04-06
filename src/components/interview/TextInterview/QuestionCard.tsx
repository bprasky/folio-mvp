"use client";

import { useState, useRef, useEffect } from "react";
import { Mic } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { InterviewQuestion } from "../shared/InterviewQuestion";
import { ProgressIndicator } from "../shared/ProgressIndicator";
import { ModeSwitcher } from "../shared/ModeSwitcher";
import type { InterviewQuestion as IInterviewQuestion } from "../types";

interface QuestionCardProps {
  question: IInterviewQuestion;
  questionNumber: number;
  totalQuestions: number;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
  onGoBack?: () => void;
  onSwitchToVoice: () => void;
  isLoading: boolean;
  images?: Array<{ id: string; url: string; name?: string }>;
  voiceAvailable?: boolean;
  previousAnswer?: string;
}

/**
 * QuestionCard
 *
 * Single question + answer input for text mode.
 * One question per screen - no scrolling through multiple.
 *
 * Layout (top to bottom):
 * 1. Progress indicator (dots) - top left
 * 2. Image thumbnail (if question.relatedImageId) - small, top center
 * 3. Question context (if followup) - regular text
 * 4. Question text - italic, large (use InterviewQuestion component)
 * 5. Spacer
 * 6. Textarea - large, generous padding
 * 7. Helper text below textarea - "Write as much or as little as you'd like"
 * 8. Action row: [Skip] on left, [Continue] on right
 * 9. Mode switcher at bottom center: "Switch to voice instead"
 */
export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onSubmit,
  onSkip,
  onGoBack,
  onSwitchToVoice,
  isLoading,
  images = [],
  voiceAvailable = false,
  previousAnswer,
}: QuestionCardProps) {
  const [answer, setAnswer] = useState(previousAnswer || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Find related image if present
  const relatedImage = question.relatedImageId
    ? images.find((img) => img.id === question.relatedImageId)
    : undefined;

  // Reset answer when question changes (previousAnswer supplies saved text when going back)
  useEffect(() => {
    setAnswer(previousAnswer || "");
  }, [question.id, previousAnswer]);

  // Auto-focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [question.id]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isLoading) {
        e.preventDefault();
        if (answer.trim()) {
          onSubmit(answer);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSubmit, isLoading, answer]);

  const handleSubmit = () => {
    if (answer.trim() && !isLoading) {
      onSubmit(answer);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Progress indicator - top left */}
      <div className="px-6 md:px-8 pt-6">
        <ProgressIndicator
          current={questionNumber}
          total={totalQuestions}
          variant="dots"
        />
      </div>

      {/* Question section */}
      <div className="flex-1 flex flex-col justify-center px-6 md:px-8 py-8">
        <InterviewQuestion
          question={question.text}
          context={question.context}
          relatedImage={
            relatedImage
              ? { url: relatedImage.url, alt: relatedImage.name || "Project image" }
              : undefined
          }
        />
      </div>

      {/* Input section */}
      <div className="px-6 md:px-8 pb-4 space-y-4">
        <div className="max-w-2xl mx-auto w-full">
          <textarea
            ref={textareaRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={6}
            className={cn(
              "w-full min-h-[160px] md:min-h-[200px] p-4 md:p-6",
              "bg-surface-ground/50 rounded-xl text-lg",
              "placeholder:text-folio-text-tertiary",
              "border-transparent focus:border-folio-border-subtle",
              "focus:outline-none focus:ring-2 focus:ring-gray-200",
              "resize-none leading-relaxed transition-all"
            )}
            placeholder="Share your thoughts..."
            disabled={isLoading}
          />

          {/* Helper text */}
          <p className="text-sm text-folio-text-tertiary mt-2">
            Write as much or as little as you'd like
          </p>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-3">
            {onGoBack && (
              <button
                type="button"
                onClick={onGoBack}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-folio-text-secondary hover:text-folio-text-primary text-sm py-2 px-3 border border-[var(--text-tertiary)]/20 rounded-lg hover:border-folio-text-tertiary/40 transition-colors disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-70">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Previous
              </button>
            )}
            <button
              type="button"
              onClick={onSkip}
              disabled={isLoading}
              className="text-folio-text-secondary hover:text-folio-text-primary text-sm py-2 px-3 transition-colors disabled:opacity-50"
            >
              Skip
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !answer.trim()}
            className={cn(
              "py-3 px-6 rounded-lg font-medium transition-all",
              answer.trim() && !isLoading
                ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                : "bg-surface-ground text-folio-text-tertiary cursor-not-allowed"
            )}
          >
            {isLoading ? "..." : "Continue →"}
          </button>
        </div>
      </div>

      {/* Mode switcher at bottom */}
      {voiceAvailable && (
        <div className="flex justify-center pb-6">
          <ModeSwitcher
            currentMode="text"
            onSwitch={onSwitchToVoice}
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );
}

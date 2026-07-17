"use client";

import { useEffect, useRef } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import type { InterviewQuestion } from "@/lib/posting/interviewSchemas";
import { useVoiceRecording } from "./useVoiceRecording";
import type { InterviewQuestion as ContextualQuestion } from "@/types/interview";

interface QuestionCardProps {
  question: InterviewQuestion;
  answer: string;
  onAnswerChange: (answer: string) => void;
  /**
   * Reports the SOURCE of an input event so the parent can resolve inputModality
   * ('voice' | 'typing'). Keystrokes come through the textarea onChange; the
   * Whisper transcript merge writes state directly and must NOT count as typing.
   */
  onInputSource?: (source: "voice" | "typing") => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  fieldError?: string;
  projectId: string; // Phase D: Required for transcription
  questionMetadata?: ContextualQuestion; // Contextual question metadata
  /** 1-based position of this question, for the eyebrow (e.g. "QUESTION 01"). */
  questionNumber?: number;
  /** Section label for the eyebrow (room name, or "About this project"). */
  sectionLabel?: string;
}

export function QuestionCard({
  question,
  answer,
  onAnswerChange,
  onInputSource,
  onSubmit,
  isSubmitting = false,
  fieldError,
  projectId,
  questionNumber,
  sectionLabel = "About this project",
}: QuestionCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxLength = Math.min(question.maxLen ?? 2000, 2000);

  // Phase D: Voice recording
  const {
    recordingTime,
    error: recordingError,
    formatTime,
    startRecording,
    stopRecording,
    transcribeRecording,
    cancelRecording,
    cleanup,
    isRecording,
    isTranscribing,
  } = useVoiceRecording({
    onTranscriptionComplete: (transcript) => {
      // Merge transcript with existing answer. This is a direct state write, not
      // a keystroke — flag it as voice, never as typing.
      onInputSource?.("voice");
      const merged = answer.trim() ? `${answer}\n\n${transcript}` : transcript;
      onAnswerChange(merged.slice(0, maxLength));
    },
    onError: (error) => {
      console.error("[QuestionCard] Voice recording error:", error);
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isSubmitting) {
        e.preventDefault();
        onSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSubmit, isSubmitting]);

  const eyebrowNumber =
    typeof questionNumber === "number"
      ? String(questionNumber).padStart(2, "0")
      : null;

  return (
    <div className="flex h-full max-w-[760px] flex-col px-8 py-9 md:px-12 md:py-11">
      {/* Eyebrow — question number · section, with a hairline rule beneath. */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-folio-text-tertiary">
          {eyebrowNumber ? `Question ${eyebrowNumber} · ` : ""}
          <span style={{ color: "var(--folio-gold)" }}>{sectionLabel}</span>
        </p>
        <div
          className="mt-4 h-px w-full"
          style={{ background: "var(--folio-border-subtle)" }}
        />
      </div>

      {/* Question — Cormorant italic with a gold→parchment accent bar. */}
      <div className="mt-8 flex gap-5">
        <span
          className="mt-1 w-[3px] shrink-0 self-stretch rounded-full"
          style={{
            background:
              "linear-gradient(to bottom, var(--folio-gold) 0%, var(--surface-elevated) 100%)",
          }}
        />
        <h2
          className="italic text-folio-text-primary"
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: "29px",
            lineHeight: 1.34,
          }}
        >
          {question.prompt}
        </h2>
      </div>

      {question.helper && (
        <p className="mt-4 max-w-xl pl-8 text-sm leading-relaxed text-folio-text-secondary">
          {question.helper}
        </p>
      )}

      {/* Answer — pushed to the bottom of the column. */}
      <div className="mt-auto pt-10">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--folio-gold)" }}
          >
            Your response
          </span>
          <span className="text-xs text-folio-text-tertiary">
            Speak or type — a sentence or two is plenty
          </span>
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={answer}
            onChange={(e) => {
              onInputSource?.("typing");
              onAnswerChange(e.target.value);
            }}
            maxLength={maxLength}
            rows={5}
            className={`w-full resize-y rounded-[16px] border p-4 pr-14 text-[15px] leading-relaxed text-folio-text-primary placeholder:text-folio-text-tertiary shadow-[inset_0_2px_6px_rgba(180,160,140,0.10)] transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              fieldError
                ? "border-red-400 focus:ring-red-400/60"
                : "focus:ring-[var(--accent)]"
            }`}
            style={{
              background: "var(--surface-ground)",
              borderColor: fieldError ? undefined : "var(--folio-border-subtle)",
              minHeight: 148,
            }}
            placeholder="Type your answer here…"
            disabled={isSubmitting || isRecording || isTranscribing}
          />

          {/* Circular voice-input control, bottom-right inside the field. */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            {isRecording && (
              <span className="font-mono text-xs text-red-600">
                {formatTime(recordingTime)}
              </span>
            )}
            {isTranscribing && (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
            )}
            {!isRecording && !isTranscribing && (
              <button
                type="button"
                onClick={async () => {
                  await startRecording();
                }}
                disabled={isSubmitting}
                className="flex h-9 w-9 items-center justify-center rounded-full border text-folio-text-secondary transition-all duration-200 hover:-translate-y-px hover:text-folio-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:opacity-50"
                style={{
                  background: "var(--surface-canvas)",
                  borderColor: "var(--folio-border-subtle)",
                }}
                title="Record voice answer"
                aria-label="Record voice answer"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
            {isRecording && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    stopRecording();
                    // Wait for recording to stop, then transcribe
                    setTimeout(async () => {
                      await transcribeRecording(projectId, question.id);
                    }, 300);
                  }}
                  disabled={isSubmitting}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50"
                  title="Stop recording and transcribe"
                  aria-label="Stop recording and transcribe"
                >
                  <Square className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-1.5 text-xs text-folio-text-secondary transition-colors hover:text-folio-text-primary"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {(fieldError || recordingError) && (
          <p className="mt-2 text-sm text-red-600">
            {fieldError || recordingError}
          </p>
        )}
      </div>
    </div>
  );
}

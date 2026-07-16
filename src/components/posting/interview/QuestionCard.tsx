"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import type { InterviewQuestion } from "@/lib/posting/interviewSchemas";
import type { InterviewAnswer } from "@/lib/posting/interviewSchemas";
import { useVoiceRecording } from "./useVoiceRecording";
import { LinkedImagePreview } from "@/components/editorial/LinkedImagePreview";
import { formatRoomName } from "@/lib/utils/formatRoomName";
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
  images?: Array<{ id: string; url: string; name?: string }>; // Project images for preview
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
  questionMetadata,
  images = [],
}: QuestionCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const maxLength = Math.min(question.maxLen ?? 2000, 2000);
  const charCount = answer.length;

  // Phase D: Voice recording
  const {
    status: recordingStatus,
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
      const merged = answer.trim()
        ? `${answer}\n\n${transcript}`
        : transcript;
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

  return (
    <div className="flex flex-col h-full">
      {/* Question section */}
      <div className="px-8 md:px-16 pt-4 pb-6 space-y-4">
        {/* Contextual question metadata */}
        {questionMetadata && questionMetadata.questionType === 'contextual' && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {questionMetadata.attributeType && questionMetadata.attributeValue && (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  questionMetadata.attributeType === 'color' ? 'bg-[var(--accent)]/10 text-[var(--accent-hover)]' :
                  questionMetadata.attributeType === 'material' ? 'bg-amber-100 text-amber-700' :
                  questionMetadata.attributeType === 'style' ? 'bg-purple-100 text-purple-700' :
                  questionMetadata.attributeType === 'mood' ? 'bg-rose-100 text-rose-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  <span className="capitalize">{questionMetadata.attributeType}</span>
                  <span className="mx-1">•</span>
                  {questionMetadata.attributeValue}
                </span>
              )}
              {questionMetadata.roomContext && (
                <span className="text-xs text-folio-text-secondary">• {formatRoomName(questionMetadata.roomContext)}</span>
              )}
            </div>
            {questionMetadata.linkedImageId && images.length > 0 && (
              <LinkedImagePreview 
                imageId={questionMetadata.linkedImageId} 
                images={images}
              />
            )}
          </div>
        )}
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl italic text-folio-text-primary leading-tight mb-8 max-w-3xl">
          {question.prompt}
        </h2>
        {question.helper && (
          <p className="text-sm text-folio-text-secondary max-w-2xl">{question.helper}</p>
        )}
      </div>

      {/* Input section */}
      <div className="flex-1 flex flex-col justify-end px-8 md:px-16 py-6 space-y-4">
        <div className="relative max-w-3xl">
          <textarea
            ref={textareaRef}
            value={answer}
            onChange={(e) => {
              onInputSource?.("typing");
              onAnswerChange(e.target.value);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              if (!answer.trim()) {
                setIsFocused(false);
              }
            }}
            maxLength={maxLength}
            rows={isFocused || answer.trim() ? 8 : 2}
            className={`w-full p-4 bg-surface-ground/50 border rounded-xl text-lg placeholder:text-folio-text-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50 leading-relaxed transition-all duration-200 ease-in-out ${
              isFocused || answer.trim() ? "min-h-[200px] resize-y" : "min-h-[56px] resize-none"
            } ${
              fieldError ? "border-red-400 focus:border-red-500" : "border-folio-border-subtle"
            }`}
            placeholder="Type your answer here…"
            disabled={isSubmitting || isRecording || isTranscribing}
          />
          {/* Phase D: Voice recording button */}
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            {isRecording && (
              <span className="text-xs text-red-600 font-mono">
                {formatTime(recordingTime)}
              </span>
            )}
            {isTranscribing && (
              <Loader2 className="h-4 w-4 text-[var(--accent)] animate-spin" />
            )}
            {!isRecording && !isTranscribing && (
              <button
                type="button"
                onClick={async () => {
                  await startRecording();
                }}
                disabled={isSubmitting}
                className="p-2 rounded-full transition-colors bg-surface-ground text-folio-text-secondary hover:bg-surface-ground disabled:opacity-50 disabled:cursor-not-allowed"
                title="Record voice answer"
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
                  className="p-2 rounded-full transition-colors bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Stop recording and transcribe"
                >
                  <Square className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="p-1.5 text-xs text-folio-text-secondary hover:text-folio-text-primary"
                  title="Cancel recording"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Character count and error */}
        <div className="flex justify-between items-center text-sm text-folio-text-tertiary max-w-3xl">
          <div>
            {fieldError && (
              <p className="text-red-600">{fieldError}</p>
            )}
            {recordingError && (
              <p className="text-red-600">{recordingError}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>Press ⌘ + Enter to submit</span>
            <span>{charCount} / {maxLength} characters</span>
            {charCount > maxLength * 0.9 && (
              <span className="text-yellow-600">Approaching limit</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


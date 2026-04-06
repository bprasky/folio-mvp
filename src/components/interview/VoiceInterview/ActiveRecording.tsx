"use client";

import { Mic, Square } from "lucide-react";
import { InterviewQuestion } from "../shared/InterviewQuestion";
import type { InterviewQuestion as IInterviewQuestion } from "../types";

interface ActiveRecordingProps {
  question: IInterviewQuestion;
  transcript: string;
  duration: number;
  onPause: () => void;
  onComplete: () => void;
  audioLevel: number;
}

/**
 * ActiveRecording
 *
 * Recording state UI - shows question, live transcript, and controls.
 * Phase 2 implementation - currently a placeholder.
 */
export function ActiveRecording({
  question,
  transcript,
  duration,
  onPause,
  onComplete,
  audioLevel,
}: ActiveRecordingProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Question section */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 border-b">
        <InterviewQuestion question={question.text} context={question.context} />
      </div>

      {/* Transcript area */}
      <div className="flex-1 bg-surface-ground p-6 overflow-y-auto">
        <p className="text-xs text-folio-text-tertiary uppercase tracking-wide mb-3">
          Live transcript
        </p>
        <p className="text-folio-text-primary leading-relaxed">
          {transcript || (
            <span className="text-folio-text-tertiary">Start speaking...</span>
          )}
        </p>
      </div>

      {/* Recording controls */}
      <div className="p-6 flex flex-col items-center">
        {/* Mic button */}
        <div className="relative mb-4">
          <button
            type="button"
            className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center animate-pulse"
          >
            <Mic className="w-8 h-8 text-white" />
          </button>
          {/* Pulsing ring */}
          <div
            className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping"
            style={{ animationDuration: "1.5s" }}
          />
        </div>

        {/* Timer */}
        <p className="text-folio-text-secondary mb-4">Recording... {formatDuration(duration)}</p>

        {/* Control buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={onPause}
            className="text-folio-text-secondary hover:text-folio-text-primary text-sm"
          >
            Pause
          </button>
          <button
            onClick={onComplete}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)] text-white rounded-lg text-sm hover:opacity-90"
          >
            <Square className="w-4 h-4" />
            I'm done talking
          </button>
        </div>
      </div>
    </div>
  );
}

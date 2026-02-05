"use client";

import { Mic, PenLine } from "lucide-react";
import type { InterviewQuestion, InterviewResponse } from "../types";

interface VoiceInterviewProps {
  sessionId: string;
  questions: InterviewQuestion[];
  onComplete: (responses: InterviewResponse[]) => void;
  onSwitchToText: () => void;
}

/**
 * VoiceInterview
 *
 * Container for voice interview mode.
 * Phase 2 implementation - currently a placeholder.
 *
 * Full implementation will include:
 * - Mic check
 * - AI speaking (TTS)
 * - Recording user response
 * - Live transcription
 * - Follow-up generation
 */
export function VoiceInterview({
  sessionId,
  questions,
  onComplete,
  onSwitchToText,
}: VoiceInterviewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-6 py-8">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-6">
        <Mic className="w-8 h-8 text-gray-400" />
      </div>

      <h2 className="text-xl font-medium text-gray-900 mb-2">
        Voice Interview
      </h2>

      <p className="text-gray-500 text-center max-w-md mb-8">
        Voice interviews are coming soon. For now, you can use the text
        interview to share your project story.
      </p>

      <button
        onClick={onSwitchToText}
        className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
      >
        <PenLine className="w-4 h-4" />
        Switch to text interview
      </button>
    </div>
  );
}

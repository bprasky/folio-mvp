"use client";

interface VoiceTranscriptProps {
  segments: Array<{
    text: string;
    speaker: "user" | "ai";
    timestamp: number;
  }>;
  isRecording: boolean;
}

/**
 * VoiceTranscript
 *
 * Live transcript display component.
 * Phase 2 implementation - currently a placeholder.
 */
export function VoiceTranscript({ segments, isRecording }: VoiceTranscriptProps) {
  return (
    <div className="bg-surface-ground rounded-lg p-4 max-h-60 overflow-y-auto">
      <p className="text-xs text-folio-text-tertiary uppercase tracking-wide mb-3">
        Transcript
      </p>

      {segments.length === 0 ? (
        <p className="text-folio-text-tertiary text-sm">No transcript yet...</p>
      ) : (
        <div className="space-y-3">
          {segments.map((segment, index) => (
            <div
              key={index}
              className={`text-sm ${
                segment.speaker === "ai" ? "text-[var(--accent)]" : "text-folio-text-primary"
              }`}
            >
              <span className="text-xs text-folio-text-tertiary mr-2">
                {segment.speaker === "ai" ? "AI" : "You"}:
              </span>
              {segment.text}
            </div>
          ))}
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-folio-text-tertiary">Recording...</span>
        </div>
      )}
    </div>
  );
}

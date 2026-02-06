"use client";

import { Mic, CheckCircle } from "lucide-react";

interface MicCheckProps {
  onReady: () => void;
  onError: (error: string) => void;
}

/**
 * MicCheck
 *
 * Initial mic setup/check component.
 * Phase 2 implementation - currently a placeholder.
 */
export function MicCheck({ onReady, onError }: MicCheckProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] px-6 py-8">
      <div className="w-20 h-20 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center mb-6">
        <Mic className="w-10 h-10 text-[var(--text-tertiary)]" />
      </div>

      <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
        Microphone Check
      </h3>

      <p className="text-[var(--text-secondary)] text-center max-w-md mb-6">
        Click below to test your microphone and start the voice interview.
      </p>

      <button
        onClick={onReady}
        className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-hover)] transition-colors"
      >
        <CheckCircle className="w-4 h-4" />
        Ready to start
      </button>
    </div>
  );
}

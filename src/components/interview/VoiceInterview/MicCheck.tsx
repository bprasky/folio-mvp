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
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
        <Mic className="w-10 h-10 text-gray-400" />
      </div>

      <h3 className="text-lg font-medium text-gray-900 mb-2">
        Microphone Check
      </h3>

      <p className="text-gray-500 text-center max-w-md mb-6">
        Click below to test your microphone and start the voice interview.
      </p>

      <button
        onClick={onReady}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        <CheckCircle className="w-4 h-4" />
        Ready to start
      </button>
    </div>
  );
}

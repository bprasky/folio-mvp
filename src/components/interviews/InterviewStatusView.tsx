"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertCircle, Play, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

function ProcessButton({ interviewId }: { interviewId: string }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/interviews/${interviewId}/process`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Processing failed");
      }

      // Reload page to show updated status
      window.location.reload();
    } catch (err) {
      console.error("Process error:", err);
      setError(err instanceof Error ? err.message : "Processing failed");
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-end space-y-2">
      <Button
        onClick={handleProcess}
        disabled={isProcessing}
        className="bg-gray-900 hover:bg-gray-800"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Process Interview
          </>
        )}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface InterviewStatusViewProps {
  interviewSession: {
    id: string;
    status: string;
    errorMessage: string | null;
    recordingAsset: {
      url: string;
      durationMs: number | null;
    } | null;
    transcribedAt: Date | null;
    extractedAt: Date | null;
    publishedAt: Date | null;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  TRANSCRIBING: {
    label: "Transcribing",
    color: "text-[var(--accent)]",
    icon: <Loader2 className="h-5 w-5 animate-spin" />,
  },
  TRANSCRIBED: {
    label: "Transcribed",
    color: "text-[var(--accent)]",
    icon: <CheckCircle className="h-5 w-5" />,
  },
  EXTRACTING: {
    label: "Extracting Quotes",
    color: "text-purple-600",
    icon: <Loader2 className="h-5 w-5 animate-spin" />,
  },
  EXTRACTED: {
    label: "Quotes Extracted",
    color: "text-purple-600",
    icon: <CheckCircle className="h-5 w-5" />,
  },
  READY: {
    label: "Ready for Review",
    color: "text-green-600",
    icon: <CheckCircle className="h-5 w-5" />,
  },
  PUBLISHED: {
    label: "Published",
    color: "text-green-600",
    icon: <CheckCircle className="h-5 w-5" />,
  },
};

export function InterviewStatusView({ interviewSession }: InterviewStatusViewProps) {
  const [isPolling, setIsPolling] = useState(false);

  const statusConfig = STATUS_CONFIG[interviewSession.status] || {
    label: interviewSession.status,
    color: "text-gray-600",
    icon: <Clock className="h-5 w-5" />,
  };

  // Poll for status updates if processing
  useEffect(() => {
    if (
      interviewSession.status === "TRANSCRIBING" ||
      interviewSession.status === "EXTRACTING"
    ) {
      setIsPolling(true);
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/interviews/${interviewSession.id}/status`);
          if (response.ok) {
            const data = await response.json();
            if (
              data.interviewSession.status !== "TRANSCRIBING" &&
              data.interviewSession.status !== "EXTRACTING"
            ) {
              setIsPolling(false);
              window.location.reload();
            }
          }
        } catch (error) {
          console.error("Status poll error:", error);
        }
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [interviewSession.status, interviewSession.id]);

  const formatDuration = (ms: number | null) => {
    if (!ms) return "—";
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={statusConfig.color}>{statusConfig.icon}</div>
          <div>
            <h2 className="text-xl font-medium text-gray-900">{statusConfig.label}</h2>
            {interviewSession.errorMessage && (
              <p className="text-sm text-red-600 mt-1 flex items-center space-x-1">
                <AlertCircle className="h-4 w-4" />
                <span>{interviewSession.errorMessage}</span>
              </p>
            )}
          </div>
        </div>

        {interviewSession.status === "UPLOADED" && (
          <ProcessButton interviewId={interviewSession.id} />
        )}

        {interviewSession.status === "EXTRACTED" && (
          <Link href={`/designer/interviews/${interviewSession.id}/approve`}>
            <Button>Review & Approve Quotes</Button>
          </Link>
        )}

        {interviewSession.status === "READY" && (
          <Link href={`/designer/interviews/${interviewSession.id}/approve`}>
            <Button>Publish Insights</Button>
          </Link>
        )}
      </div>

      {/* Audio Playback */}
      {interviewSession.recordingAsset && (
        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center space-x-4">
            <Play className="h-5 w-5 text-gray-400" />
            <audio src={interviewSession.recordingAsset.url} controls className="flex-1" />
            <span className="text-sm text-gray-500">
              {formatDuration(interviewSession.recordingAsset.durationMs)}
            </span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="border-t border-gray-200 pt-6 space-y-3">
        <div className="text-sm font-medium text-gray-700 mb-4">Progress</div>
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            {interviewSession.recordingAsset ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Clock className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-sm text-gray-600">Recording uploaded</span>
          </div>
          <div className="flex items-center space-x-3">
            {interviewSession.transcribedAt ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Clock className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-sm text-gray-600">Transcription complete</span>
          </div>
          <div className="flex items-center space-x-3">
            {interviewSession.extractedAt ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Clock className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-sm text-gray-600">Quotes extracted</span>
          </div>
          <div className="flex items-center space-x-3">
            {interviewSession.publishedAt ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Clock className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-sm text-gray-600">Published</span>
          </div>
        </div>
      </div>
    </div>
  );
}


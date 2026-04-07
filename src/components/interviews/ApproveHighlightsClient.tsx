"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, X, Play, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface ApproveHighlightsClientProps {
  interviewSession: {
    id: string;
    status: string;
    highlights: Array<{
      id: string;
      quoteText: string;
      useCase: string;
      startMs: number;
      endMs: number;
      score: number;
      approvedByDesigner: boolean;
      productId: string | null;
    }>;
    recordingAsset: {
      url: string;
      durationMs: number | null;
    } | null;
  };
  recordingUrl: string | null;
}

const USE_CASE_LABELS: Record<string, string> = {
  EDITORIAL_PULLQUOTE: "Editorial",
  PRODUCT_PAGE_INSIGHT: "Product Page",
  SOCIAL_CLIP_HOOK: "Social Clip",
};

export function ApproveHighlightsClient({
  interviewSession,
  recordingUrl,
}: ApproveHighlightsClientProps) {
  const router = useRouter();
  const [approvedIds, setApprovedIds] = useState<string[]>(
    interviewSession.highlights.filter((h) => h.approvedByDesigner).map((h) => h.id)
  );
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingSegment, setPlayingSegment] = useState<{ startMs: number; endMs: number } | null>(
    null
  );

  const toggleApproval = (highlightId: string) => {
    if (approvedIds.includes(highlightId)) {
      setApprovedIds(approvedIds.filter((id) => id !== highlightId));
    } else {
      setApprovedIds([...approvedIds, highlightId]);
      setRejectedIds(rejectedIds.filter((id) => id !== highlightId));
    }
  };

  const toggleRejection = (highlightId: string) => {
    if (rejectedIds.includes(highlightId)) {
      setRejectedIds(rejectedIds.filter((id) => id !== highlightId));
    } else {
      setRejectedIds([...rejectedIds, highlightId]);
      setApprovedIds(approvedIds.filter((id) => id !== highlightId));
    }
  };

  const playSegment = (startMs: number, endMs: number) => {
    if (!recordingUrl) return;

    setPlayingSegment({ startMs, endMs });
    const audio = new Audio(recordingUrl);
    audio.currentTime = startMs / 1000;

    const stopAt = endMs / 1000;
    const checkTime = setInterval(() => {
      if (audio.currentTime >= stopAt) {
        audio.pause();
        clearInterval(checkTime);
        setPlayingSegment(null);
      }
    }, 100);

    audio.play().catch((err) => {
      console.error("Play error:", err);
      clearInterval(checkTime);
      setPlayingSegment(null);
    });
  };

  const handleSubmit = async () => {
    if (approvedIds.length === 0) {
      setError("Please approve at least one quote");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/interviews/${interviewSession.id}/approve-highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          highlightIds: approvedIds,
          rejectIds: rejectedIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to approve highlights");
      }

      router.push(`/designer/interviews/${interviewSession.id}`);
    } catch (err) {
      console.error("Approve error:", err);
      setError(err instanceof Error ? err.message : "Failed to approve highlights");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-surface-canvas rounded-lg shadow-sm border border-folio-border-subtle p-8 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-folio-text-primary">Extracted Quotes</h2>
          <p className="text-sm text-folio-text-secondary mt-1">
            Review and approve quotes to publish. {interviewSession.highlights.length} total.
          </p>
        </div>
        <div className="text-sm text-folio-text-secondary">
          {approvedIds.length} approved
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {interviewSession.highlights.map((highlight) => {
          const isApproved = approvedIds.includes(highlight.id);
          const isRejected = rejectedIds.includes(highlight.id);
          const isPlaying =
            playingSegment?.startMs === highlight.startMs &&
            playingSegment?.endMs === highlight.endMs;

          return (
            <div
              key={highlight.id}
              className={`border rounded-lg p-6 space-y-4 ${
                isApproved
                  ? "border-green-200 bg-green-50"
                  : isRejected
                  ? "border-red-200 bg-red-50 opacity-60"
                  : "border-folio-border-subtle"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-surface-ground text-folio-text-primary">
                      {USE_CASE_LABELS[highlight.useCase] || highlight.useCase}
                    </span>
                    <span className="text-xs text-folio-text-secondary">
                      Score: {(highlight.score * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs text-folio-text-secondary">
                      {formatTime(highlight.startMs)} - {formatTime(highlight.endMs)}
                    </span>
                  </div>
                  <p className="text-folio-text-primary leading-relaxed text-lg font-light">
                    "{highlight.quoteText}"
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {recordingUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => playSegment(highlight.startMs, highlight.endMs)}
                    disabled={isPlaying}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {isPlaying ? "Playing..." : "Play Segment"}
                  </Button>
                )}

                <Button
                  variant={isApproved ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleApproval(highlight.id)}
                  className={isApproved ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {isApproved ? "Approved" : "Approve"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleRejection(highlight.id)}
                  className={isRejected ? "border-red-300 text-red-600" : ""}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-folio-border-subtle pt-6 flex items-center justify-between">
        <div className="text-sm text-folio-text-secondary">
          {approvedIds.length} of {interviewSession.highlights.length} quotes approved
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || approvedIds.length === 0}
            className="bg-[var(--text-primary)] hover:opacity-90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}


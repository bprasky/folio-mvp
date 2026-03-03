"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, ExternalLink, CheckCircle2 } from "lucide-react";
import type { UsePublishFlowReturn } from "@/hooks/usePublishFlow";

interface PublishPreviewModalProps {
  projectId: string;
  flow: UsePublishFlowReturn;
  onClose: () => void;
  onPublishSuccess: () => void;
}

const PROGRESS_MESSAGES = [
  "Analyzing your images\u2026",
  "Detecting rooms and products\u2026",
  "Writing your story\u2026",
  "Preparing preview\u2026",
];

const STEP_INTERVAL_MS = 3200;

export default function PublishPreviewModal({
  projectId,
  flow,
  onClose,
  onPublishSuccess,
}: PublishPreviewModalProps) {
  const router = useRouter();
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);

  // Sequential progress state
  const [progressStep, setProgressStep] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isGenerating = flow.regenBusy;
  const hasDraft = !!flow.currentPost && !!(flow.currentLead?.title || flow.currentLead?.kicker);

  // Advance progress messages while generating
  useEffect(() => {
    if (isGenerating) {
      setProgressStep(0);
      intervalRef.current = setInterval(() => {
        setProgressStep((prev) => {
          if (prev < PROGRESS_MESSAGES.length - 1) return prev + 1;
          return prev;
        });
      }, STEP_INTERVAL_MS);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isGenerating]);

  async function handlePublish() {
    const result = await flow.publish();
    if (result.slug) {
      setPublishedSlug(result.slug);
      setJustPublished(true);
    }
  }

  function handleDone() {
    onPublishSuccess();
    router.push(`/project/${projectId}?view=publish`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--bg-elevated)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
          <h2 className="folio-h3 text-[var(--text-primary)]">
            {justPublished ? "Published" : "Preview"}
          </h2>
          <button
            onClick={justPublished ? handleDone : onClose}
            className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-base)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Generating state — sequential progress messages */}
          {isGenerating && !hasDraft && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              {/* Animated dot indicator */}
              <div className="flex items-center gap-2">
                {PROGRESS_MESSAGES.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all duration-500 ${
                      i <= progressStep
                        ? "bg-[var(--accent)] scale-100"
                        : "bg-[var(--border-default)] scale-75"
                    }`}
                  />
                ))}
              </div>

              {/* Status text with Cormorant Garamond — fade transition */}
              <div className="relative h-8 flex items-center">
                {PROGRESS_MESSAGES.map((msg, i) => (
                  <p
                    key={i}
                    className="absolute inset-0 flex items-center justify-center text-xl text-[var(--text-secondary)] transition-opacity duration-700 ease-in-out"
                    style={{
                      fontFamily: "var(--font-headline)",
                      fontStyle: "italic",
                      opacity: i === progressStep ? 1 : 0,
                    }}
                  >
                    {msg}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Draft preview */}
          {hasDraft && !justPublished && (
            <div className="space-y-6">
              {/* Title / Kicker */}
              {flow.currentLead?.kicker && flow.currentLead.kicker !== flow.currentLead.title && (
                <p
                  className="text-sm uppercase tracking-widest text-[var(--accent)]"
                  style={{ fontFamily: "var(--font-headline)" }}
                >
                  {flow.currentLead.kicker}
                </p>
              )}
              <h3
                className="text-2xl text-[var(--text-primary)] leading-tight"
                style={{ fontFamily: "var(--font-headline)", fontWeight: 500 }}
              >
                {flow.currentLead?.title}
              </h3>
              {(flow.currentLead?.deck || (flow.currentLead as any)?.dek) && (
                <p className="folio-body text-[var(--text-secondary)] leading-relaxed">
                  {flow.currentLead?.deck || (flow.currentLead as any)?.dek}
                </p>
              )}

              {/* Narrative sections preview */}
              {flow.currentSections
                .filter((s: any) => s.type === "narrative" && s.body)
                .slice(0, 3)
                .map((s: any, i: number) => (
                  <p
                    key={i}
                    className="folio-ui text-[var(--text-secondary)] leading-relaxed"
                  >
                    {s.body}
                  </p>
                ))}

              {flow.currentSections.filter(
                (s: any) => s.type === "narrative" && s.body
              ).length === 0 && (
                <p className="folio-ui text-[var(--text-tertiary)] italic">
                  No narrative sections generated. You can still publish with the title and summary.
                </p>
              )}
            </div>
          )}

          {/* Loading state — waiting for draft data after generation */}
          {!isGenerating && !hasDraft && !justPublished && (
            <div className="flex flex-col items-center justify-center py-16">
              <p
                className="text-xl text-[var(--text-secondary)] italic"
                style={{ fontFamily: "var(--font-headline)" }}
              >
                Preparing preview...
              </p>
            </div>
          )}

          {/* Published success state */}
          {justPublished && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-[var(--accent)]" />
              <h3
                className="text-2xl text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-headline)", fontWeight: 500 }}
              >
                Your project is live
              </h3>
              <p className="folio-body text-[var(--text-secondary)] text-center">
                Your Story tab is now available for editing.
              </p>
              {publishedSlug && (
                <a
                  href={`/p/${publishedSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 folio-ui font-medium text-[var(--accent)] border border-[var(--accent)]/20 rounded-lg hover:bg-[var(--accent)]/10 transition-colors"
                >
                  View Post <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!justPublished && (
          <div className="px-6 py-4 border-t border-[var(--border-default)] flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 folio-ui font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Back
            </button>
            <button
              onClick={handlePublish}
              disabled={!hasDraft || flow.isPublishing || isGenerating}
              className="px-6 py-2.5 folio-ui font-semibold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {flow.isPublishing ? "Publishing..." : "Publish"}
            </button>
          </div>
        )}

        {/* Footer for success state */}
        {justPublished && (
          <div className="px-6 py-4 border-t border-[var(--border-default)] flex justify-end">
            <button
              onClick={handleDone}
              className="px-6 py-2.5 folio-ui font-semibold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Error */}
        {flow.error && (
          <div className="px-6 pb-4">
            <div className="p-3 bg-stone-100 border border-stone-300 text-[rgb(74,44,59)] rounded-[20px] folio-meta">
              {flow.error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

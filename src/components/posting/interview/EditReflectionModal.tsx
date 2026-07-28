"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Turn a questionId into a human category label for the edit modal header.
 * questionId shape: "project-CLIENT_BRIEF-<uuid>" or "room-<roomId>-<CATEGORY>-<uuid>".
 */
export function parseCategoryLabel(questionId: string): string {
  const m = questionId.match(/-([A-Z_]+)-/);
  if (!m) return "";
  return m[1]
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

/**
 * EditReflectionModal — the single-answer editor for a saved interview Q&A.
 *
 * It opens pre-filled on one specific question/answer and saves the edit
 * straight back through the interview API (via the caller's onConfirm). This is
 * the ONLY reliable way to edit one past answer in place: the full interview
 * modal regenerates its questions with fresh UUIDs each session
 * (`project-<CATEGORY>-<uuid>`), so it can't reopen pinned to a specific saved
 * answer. Layout mirrors the interview QuestionCard so the edit feels like the
 * same surface, not a different tool.
 *
 * Extracted from StoryPanel so both the Story tab and the Project Progress
 * Tracker's "Your story so far" section share one editor.
 */
export function EditReflectionModal({
  question,
  initialValue,
  questionId,
  section,
  saving,
  onCancel,
  onConfirm,
}: {
  question: string;
  initialValue: string;
  questionId: string;
  section: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (answer: string, question: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(initialValue);
  const [questionDraft, setQuestionDraft] = useState(question);
  const dirty = draft !== initialValue || questionDraft !== question;
  const category = parseCategoryLabel(questionId);

  function attemptDismiss() {
    if (saving) return;
    if (dirty && !window.confirm("Discard your changes?")) return;
    onCancel();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        attemptDismiss();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (dirty && !saving && draft.trim()) onConfirm(draft, questionDraft);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, draft, questionDraft]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={attemptDismiss}
      />
      <div className="relative bg-white rounded-[20px] shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Close button — matches InterviewFlow */}
        <button
          type="button"
          onClick={attemptDismiss}
          className="absolute top-4 right-4 z-10 p-2 text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
          aria-label="Close editor"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Layout mirrors TextInterview/QuestionCard */}
        <div className="flex flex-col h-full min-h-[600px]">
          {/* Question section */}
          <div className="flex-1 flex flex-col justify-center px-6 md:px-8 py-8">
            <div className="max-w-2xl mx-auto w-full px-4">
              {(category || section) && (
                <div className="folio-meta text-folio-text-tertiary uppercase tracking-wider mb-3 text-center md:text-left">
                  {[category, section].filter(Boolean).join(" · ")}
                </div>
              )}
              <textarea
                value={questionDraft}
                onChange={(e) => setQuestionDraft(e.target.value)}
                rows={2}
                disabled={saving}
                placeholder="Question text (click to add)…"
                className="w-full bg-transparent text-2xl md:text-3xl font-serif italic text-folio-text-primary leading-relaxed text-center md:text-left placeholder:text-folio-text-tertiary border-transparent focus:outline-none focus:ring-2 focus:ring-gray-200 focus:bg-surface-ground/40 rounded-lg p-2 resize-none transition-all"
              />
            </div>
          </div>

          {/* Input section */}
          <div className="px-6 md:px-8 pb-4 space-y-4">
            <div className="max-w-2xl mx-auto w-full">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                className={cn(
                  "w-full min-h-[160px] md:min-h-[200px] p-4 md:p-6",
                  "bg-surface-ground/50 rounded-xl text-lg",
                  "placeholder:text-folio-text-tertiary",
                  "border-transparent focus:border-folio-border-subtle",
                  "focus:outline-none focus:ring-2 focus:ring-gray-200",
                  "resize-none leading-relaxed transition-all"
                )}
                placeholder="Share your thoughts..."
                disabled={saving}
              />

              {/* Helper text */}
              <p className="text-sm text-folio-text-tertiary mt-2">
                Write as much or as little as you'd like
              </p>
            </div>

            {/* Action row */}
            <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
              <button
                type="button"
                onClick={attemptDismiss}
                disabled={saving}
                className="text-folio-text-secondary hover:text-folio-text-primary text-sm py-2 px-3 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => onConfirm(draft, questionDraft)}
                disabled={saving || !dirty || !draft.trim()}
                className={cn(
                  "py-3 px-6 rounded-lg font-medium transition-all",
                  dirty && draft.trim() && !saving
                    ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                    : "bg-surface-ground text-folio-text-tertiary cursor-not-allowed"
                )}
              >
                {saving ? "..." : "Continue →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

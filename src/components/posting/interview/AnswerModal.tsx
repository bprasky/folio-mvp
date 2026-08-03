"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

interface AnswerModalProps {
  /** Where this answer sits — the room (or "The project") it belongs to. */
  contextLabel: string;
  /** 1-based position of this answer inside its context, e.g. 2 of 3. */
  position: { index: number; total: number };
  question: string;
  initialValue: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (answer: string) => void | Promise<void>;
  /** Re-enter the voice interview on this answer's room. */
  onReRecord: () => void;
}

/**
 * AnswerModal — the one place an answer is written or rewritten.
 *
 * The Story tab shows answers read-only; every edit affordance on it opens this.
 * Keeping editing in a modal is what lets the tab stay collapsed: a room panel
 * lists its answers as rows rather than growing a textarea per answer.
 *
 * It is deliberately dumb — it holds a draft and hands it back. The caller owns
 * the save (merge by questionId) so counts and coverage refresh in place.
 */
export function AnswerModal({
  contextLabel,
  position,
  question,
  initialValue,
  saving,
  onCancel,
  onSave,
  onReRecord,
}: AnswerModalProps) {
  const [draft, setDraft] = useState(initialValue);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dirty = draft !== initialValue;

  const attemptDismiss = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm("Discard your changes?")) return;
    onCancel();
  }, [saving, dirty, onCancel]);

  // Focus starts in the textarea — the modal exists to write in it.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Esc dismisses; Tab stays inside the dialog.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        attemptDismiss();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea, [href], input, select, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attemptDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[rgba(22,22,20,.32)] [backdrop-filter:blur(6px)_saturate(150%)]"
        onClick={attemptDismiss}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit answer"
        className="relative w-full max-w-[620px] overflow-hidden rounded-lg bg-surface-canvas shadow-folio3"
      >
        <div className="flex items-baseline justify-between gap-4 px-7 pt-6">
          <p className="text-folio-eyebrow font-semibold uppercase text-folio-text-tertiary">
            {contextLabel}
          </p>
          <p className="shrink-0 font-metricsMono text-[12px] tabular-nums text-folio-gold">
            {position.index} / {position.total}
          </p>
        </div>

        <div className="px-7 pb-6 pt-4">
          <h2 className="font-headline text-folio-quote text-folio-text-primary">
            {question || "This question's wording wasn't saved — answer it in your own words."}
          </h2>

          <textarea
            ref={textareaRef}
            rows={7}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Say it the way you'd say it to a client."
            className="glass-inset mt-4 w-full resize-none px-4 py-3 text-folio-body text-folio-text-primary outline-none placeholder:text-folio-text-tertiary focus-visible:ring-2 focus-visible:ring-folio-gold"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-folio-border-subtle px-7 py-4">
          <button
            type="button"
            onClick={onReRecord}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-neu-pill border border-folio-border-strong px-4 py-2 text-folio-meta font-medium text-folio-text-secondary transition-[transform,border-color,color] duration-150 ease-folio hover:-translate-y-px hover:border-folio-gold hover:text-folio-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold disabled:opacity-50"
          >
            <Mic className="h-3.5 w-3.5" aria-hidden />
            Re-record this answer
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={attemptDismiss}
              disabled={saving}
              className="rounded-sm px-3 py-2 text-folio-ui font-medium text-folio-text-tertiary transition-colors duration-150 ease-folio hover:text-folio-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              disabled={saving || !dirty}
              className="rounded-sm bg-folio-gold px-5 py-2.5 text-folio-ui font-semibold text-white transition-[transform,background-color] duration-150 ease-folio hover:-translate-y-px hover:bg-folio-gold-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save answer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

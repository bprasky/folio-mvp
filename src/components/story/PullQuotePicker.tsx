'use client';

// ============================================================================
// The pull quote control: cycle the alternatives, remove, or add one back.
//
// This is the one place the verbatim guarantee becomes visible to the designer.
// Every entry in `alternatives` was cut from their own interview answers by
// code, and the PATCH endpoint rejects any `selectedText` that is not in that
// list — so shuffling can surface a different line but never a line they did not
// say. Keeping ONE implementation of this control is what keeps that true; a
// second copy is a second chance to build a free-text box here by accident.
//
// The quote itself is NOT editable, and that is the point. Every alternative is
// a verbatim span of an interview answer, so choosing between them cannot
// produce a sentence the designer did not say — while a text box over the same
// field can, in one keystroke. The designer's recourse to a quote they dislike
// is a different quote of their own, or none.
//
// Moved out of the retired EditableArticle when editing moved into the story
// preview. `scripts/check-pull-quotes.ts` section 7 asserts against this file.
// ============================================================================

import { useState } from 'react';
import type { PullQuoteSelection } from '@/lib/posting/schemas';
import { isPullQuoteSelection } from '@/lib/posting/schemas';

interface PullQuotePickerProps {
  pullQuote: string | PullQuoteSelection | null | undefined;
  chapterIndex: number;
  projectId: string;
  /** Typography for the quote itself, so it matches whatever layout hosts it. */
  quoteClassName?: string;
  onUpdate: () => void;
}

export function PullQuotePicker({
  pullQuote,
  chapterIndex,
  projectId,
  quoteClassName,
  onUpdate,
}: PullQuotePickerProps) {
  const [saving, setSaving] = useState(false);

  const isSelection = isPullQuoteSelection(pullQuote);
  const selectedText = typeof pullQuote === 'string' ? pullQuote : pullQuote?.selected?.text ?? null;
  const selectedContext = isSelection ? pullQuote.selected?.context : undefined;
  const alternatives = isSelection ? pullQuote.alternatives : [];
  const hasAlternatives = alternatives.length > 1;

  // The editor finds its place in the list by text. The chosen quote is present
  // in `alternatives` by design, so this resolves rather than returning -1.
  const currentIndex = selectedText
    ? alternatives.findIndex(a => a.text === selectedText)
    : -1;

  const patch = async (nextText: string | null) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/sections/pull-quote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIndex, selectedText: nextText }),
      });
      if (res.ok) onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const handleCycle = (direction: 1 | -1) => {
    if (!hasAlternatives) return;
    const nextIndex =
      ((currentIndex === -1 ? 0 : currentIndex) + direction + alternatives.length) % alternatives.length;
    return patch(alternatives[nextIndex].text);
  };

  if (selectedText) {
    return (
      <div className="py-2">
        {/* Read-only by design. See the note at the top of this file: the quote
            is the designer's own sentence, and the way to change it is to pick a
            different one of their sentences. */}
        <blockquote
          className={quoteClassName ?? 'font-[var(--font-headline)] text-lg md:text-xl italic leading-relaxed text-folio-text-secondary'}
        >
          &ldquo;{selectedText}&rdquo;
        </blockquote>

        {selectedContext && (
          <p className="mt-2 folio-meta tracking-wide uppercase text-folio-text-tertiary">
            — {selectedContext}
          </p>
        )}

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {hasAlternatives && (
              <>
                <button
                  onClick={() => handleCycle(-1)}
                  disabled={saving}
                  className="text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 transition-colors p-0.5"
                  title="Previous quote"
                  aria-label="Previous pull quote"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <span className="folio-meta text-folio-text-tertiary tabular-nums">
                  {currentIndex >= 0 ? currentIndex + 1 : 1} of {alternatives.length}
                </span>
                <button
                  onClick={() => handleCycle(1)}
                  disabled={saving}
                  className="text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 transition-colors p-0.5"
                  title="Next quote"
                  aria-label="Next pull quote"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => patch(null)}
            disabled={saving}
            className="flex items-center gap-1 folio-meta text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 transition-colors"
            title="Remove pull quote"
            aria-label="Remove pull quote"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Remove
          </button>
        </div>
      </div>
    );
  }

  // No quote selected, but the room has verbatim candidates — offer one back.
  if (alternatives.length > 0) {
    return (
      <div className="py-2">
        <button
          onClick={() => patch(alternatives[0].text)}
          disabled={saving}
          className="folio-meta text-[var(--accent)] hover:text-folio-text-primary disabled:opacity-40 transition-colors flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3V11M3 7H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Add pull quote
        </button>
      </div>
    );
  }

  // No quote and nothing verbatim to offer. A room whose interview produced no
  // quotable line gets no control — inventing one is the failure this avoids.
  return null;
}

export default PullQuotePicker;

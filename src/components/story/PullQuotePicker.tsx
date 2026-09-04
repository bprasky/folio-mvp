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
// The AUTHORSHIP TOGGLE names who wrote the line, not what format it is in.
// "Your words" and "Written by Folio" are two legitimate choices — a designer
// may reasonably prefer Folio describing their decisions to a sentence they
// happened to say out loud. What they may NOT do is be unclear about which they
// picked, which is why the labels name the author rather than saying something
// like "quote" and "caption".
//
// "Written by Folio" is deliberately present and deliberately unavailable.
// There is no caption generator, and there must not be a stub one: a Folio line
// is paraphrase, and paraphrase needs the provenance work (C1) before it can be
// published under a designer's name. Rendering the slot is how the choice stays
// visible as a choice instead of arriving later as a surprise.
//
// Moved out of the retired EditableArticle when editing moved into the story
// preview. `scripts/check-pull-quotes.ts` section 7 asserts against this file.
// ============================================================================

import { useState } from 'react';
import type { PullQuoteSelection, PullQuoteAuthorship } from '@/lib/posting/schemas';
import { isPullQuoteSelection } from '@/lib/posting/schemas';

/**
 * Why "Written by Folio" cannot be picked yet, in the designer's terms rather
 * than ours. Shown on activation instead of as permanent chrome under every
 * room, but the control is focusable and announces itself disabled, so the
 * explanation is reachable by keyboard and not tooltip-only.
 */
const FOLIO_UNAVAILABLE =
  'Not available yet. Before Folio writes in your place, every line has to be traceable back to something you said.';

/**
 * Two authorship modes, side by side, both always rendered.
 *
 * Every room shows both regardless of how good its candidates are. This is a
 * choice about who is speaking, not a fallback for a thin interview — showing
 * the Folio option only when the verbatim pool is weak would turn it into a
 * consolation prize and quietly tell the designer their own words were not good
 * enough.
 */
function AuthorshipToggle({
  authorship,
  onUnavailable,
}: {
  authorship: PullQuoteAuthorship;
  onUnavailable: () => void;
}) {
  const base =
    'folio-meta px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap';
  const selected = 'border-[var(--accent)] text-[var(--accent)]';
  const unselected = 'border-transparent text-folio-text-tertiary';

  return (
    <div
      role="group"
      aria-label="Who wrote this line"
      className="flex items-center gap-1"
    >
      <span
        className={`${base} ${authorship === 'verbatim' ? selected : unselected}`}
        aria-current={authorship === 'verbatim'}
      >
        Your words
      </span>
      {/* Present, focusable, and honestly disabled. `aria-disabled` rather than
          `disabled` so it still takes focus and can explain itself when
          activated — a `disabled` button is silent to a keyboard user, which is
          the one case where "why can't I click this" has no answer. */}
      <button
        type="button"
        aria-disabled
        onClick={onUnavailable}
        className={`${base} border-dashed border-folio-text-tertiary/40 text-folio-text-tertiary/70 cursor-not-allowed hover:text-folio-text-tertiary`}
        title="Not available yet"
      >
        Written by Folio
      </button>
    </div>
  );
}

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
  const [notice, setNotice] = useState<string | null>(null);

  const isSelection = isPullQuoteSelection(pullQuote);
  // Absent on every article generated before the toggle existed, and absent
  // means the designer's own words — which is what those articles contain.
  const authorship: PullQuoteAuthorship =
    (isSelection ? pullQuote.authorship : undefined) ?? 'verbatim';
  const selectedText = typeof pullQuote === 'string' ? pullQuote : pullQuote?.selected?.text ?? null;
  const selectedContext = isSelection ? pullQuote.selected?.context : undefined;
  const alternatives = isSelection ? pullQuote.alternatives : [];
  const hasAlternatives = alternatives.length > 1;

  // The editor finds its place in the list by text. The chosen quote is present
  // in `alternatives` by design, so this resolves rather than returning -1.
  const currentIndex = selectedText
    ? alternatives.findIndex(a => a.text === selectedText)
    : -1;

  const backfill = async () => {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/sections/pull-quotes/backfill`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data?.error ?? 'Could not find a quote for this section.');
        return;
      }
      if (data?.filled > 0) onUpdate();
      else setNotice(data?.message ?? 'Nothing quotable in the interview for this section yet.');
    } catch {
      setNotice('Could not find a quote for this section.');
    } finally {
      setSaving(false);
    }
  };

  const patch = async (nextText: string | null) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/sections/pull-quote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // The mode rides along with the selection so the two cannot disagree.
        // Only 'verbatim' is reachable today; recording it from the start is
        // what makes the eventual Folio rate readable against a real baseline
        // rather than against rows that predate the field.
        body: JSON.stringify({ chapterIndex, selectedText: nextText, authorship }),
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
        {/* Controls ABOVE the quote: they govern the line beneath them, and
            reading order should say so. Regenerate Section is not here — it
            acts on the whole room and stays below with the room. */}
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <AuthorshipToggle
            authorship={authorship}
            onUnavailable={() => setNotice(FOLIO_UNAVAILABLE)}
          />

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

        {notice && <p className="mb-2 folio-meta text-folio-text-tertiary">{notice}</p>}

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

  // No quote and no stored alternatives.
  //
  // This used to render nothing, which is indistinguishable from "this feature
  // does not exist" — and it is the state EVERY chapter of an article generated
  // before the room-attribution fix is in. The candidates are cut from the
  // interview by code, so they can be produced now without regenerating the
  // article; offer that rather than a blank space.
  return (
    <div className="py-2 flex flex-col gap-1">
      <button
        onClick={backfill}
        disabled={saving}
        className="folio-meta text-[var(--accent)] hover:text-folio-text-primary disabled:opacity-40 transition-colors flex items-center gap-1"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3V11M3 7H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        {saving ? 'Looking through the interview…' : 'Add a pull quote from the interview'}
      </button>
      {notice && <p className="folio-meta text-folio-text-tertiary">{notice}</p>}
    </div>
  );
}

export default PullQuotePicker;

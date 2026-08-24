'use client';

// ============================================================================
// Headline options: ask for a batch, cycle through what survives.
//
// The same interaction as the pull quote picker, for the same reason. A single
// "regenerate" that swaps in one new headline per press is a slot machine — the
// designer cannot get back the one they had two presses ago, so the safe move is
// never to press it. Here the current headline stays live while they arrow
// through validated options, and landing on one is what commits it.
//
// The difference from pull quotes: a headline is the model's sentence, so the
// designer may also type their own. A pull quote is a claim about what they said
// out loud, so it can only be selected. Both controls look alike; only one has a
// text field, and that asymmetry is deliberate.
// ============================================================================

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useStoryEdit, StoryEditRegion } from './StoryEditContext';

/** Sentinel chapter index for lead fields — see SectionOverride. */
const LEAD = -1;

export function HeadlinePicker({
  current,
  alternatives,
}: {
  current: string;
  alternatives: string[];
}) {
  const edit = useStoryEdit();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!edit) return null;

  // The pool must be STABLE — the same list in the same order, whichever entry
  // is currently live.
  //
  // It used to be rebuilt as `[current, ...others]`, which hoisted the live
  // headline to index 0 on every render. So the counter always read "1 of N",
  // and "next" was always pool[1] — which, after saving, was the headline you
  // had just left. Six candidates, two of them reachable, forever.
  //
  // The batch now ships with the pre-batch headline as its first entry, so the
  // stored list IS the whole pool and `current` is a member of it. A headline
  // typed by hand after the batch is not, and is prepended so it stays
  // reachable until the next batch replaces the list.
  const pool = alternatives.includes(current) ? alternatives : [current, ...alternatives].filter(Boolean);
  const index = Math.max(0, pool.indexOf(current));

  const choose = async (next: string) => {
    if (busy || next === current) return;
    setBusy(true);
    setError(null);
    try {
      // Selecting is an ordinary headline edit — it goes through the same
      // override path as typing one, so a chosen headline is respected as the
      // designer's on the next full regeneration.
      await edit.save(LEAD, 0, 'kicker', next);
    } catch {
      setError('Could not save that headline.');
    } finally {
      setBusy(false);
    }
  };

  const cycle = (direction: 1 | -1) => {
    if (pool.length < 2) return;
    return choose(pool[(index + direction + pool.length) % pool.length]);
  };

  const propose = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posting/project/${edit.projectId}/sections/headline/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Could not write new options.');
        return;
      }
      edit.refresh();
    } catch {
      setError('Could not write new options.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <StoryEditRegion className="mt-2 flex flex-col gap-1">
      <div className="flex items-center gap-3">
        {pool.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => cycle(-1)}
              disabled={busy}
              className="text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 transition-colors p-0.5"
              title="Previous headline"
              aria-label="Previous headline"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="folio-meta text-folio-text-tertiary tabular-nums">
              {index + 1} of {pool.length}
            </span>
            <button
              onClick={() => cycle(1)}
              disabled={busy}
              className="text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 transition-colors p-0.5"
              title="Next headline"
              aria-label="Next headline"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        )}
        <button
          onClick={propose}
          disabled={busy}
          className="flex items-center gap-1.5 folio-meta text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Writing options…' : alternatives.length > 0 ? 'New options' : 'Suggest headlines'}
        </button>
      </div>
      {error && <p className="folio-meta text-folio-text-tertiary">{error}</p>}
    </StoryEditRegion>
  );
}

export default HeadlinePicker;

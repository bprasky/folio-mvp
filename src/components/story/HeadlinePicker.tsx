'use client';

// ============================================================================
// Headline options, grouped by ANGLE.
//
// The batch has been several angles since C3 — one to three, depending on which
// opening questions the designer answered — and the route has always known which
// angle wrote which candidate, because position is the angle. It used that fact
// three times internally and then dropped it, so the designer was handed several
// different STORIES presented as one list of interchangeable strings and asked to
// arrow through them. Comparing wordings is a different, harder task than
// choosing what the article is about, and it is the wrong one.
//
// So the primary choice here is the angle. Each group shows the frame's own name
// as its label ("Constraint the project answered"), and the takes within an angle
// are secondary — reachable, but not what the eye is asked to compare.
//
// "New options" narrows to the chosen angle. Re-rolling all three would cost the
// designer the two stories they had not rejected yet, which is the slot-machine
// behaviour the batch model exists to prevent.
//
// The difference from pull quotes is unchanged: a headline is the model's
// sentence, so the designer may also type their own. A pull quote is a claim
// about what they said out loud, so it can only be selected.
// ============================================================================

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useStoryEdit, StoryEditRegion } from './StoryEditContext';
import type { TitleAlternative } from '@/lib/posting/schemas';

/** Sentinel chapter index for lead fields — see SectionOverride. */
const LEAD = -1;

/** Legacy pools carry no angle. Grouped under this and rendered without a label. */
const UNLABELLED = '';

export function HeadlinePicker({
  current,
  alternatives,
}: {
  current: string;
  alternatives: TitleAlternative[];
}) {
  const edit = useStoryEdit();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);
  /** Angles whose extra takes are showing. The angle is the primary choice. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!edit) return null;

  // The live headline is always reachable, even when the stored pool has moved on
  // — it is dropped from storage once it fails a rule the rest had to pass, and a
  // headline typed by hand was never in the pool at all.
  const inPool = alternatives.some((a) => a.text === current);
  const pool: TitleAlternative[] =
    inPool || !current
      ? alternatives
      : [{ text: current, angle: UNLABELLED, angleLabel: '' }, ...alternatives];

  // Grouped, in the order the pool arrived — the route seats the editor's best
  // survivor from each angle first, so that order already means something.
  const groups: Array<{ angle: string; label: string; options: TitleAlternative[] }> = [];
  for (const a of pool) {
    const found = groups.find((g) => g.angle === a.angle);
    if (found) found.options.push(a);
    else groups.push({ angle: a.angle, label: a.angleLabel, options: [a] });
  }

  // A pool written before angles were stored.
  //
  // Every entry carries `angle: ''`, so they collapse into one unlabelled group and
  // the per-angle controls disappear — which renders as a flat list of strings, i.e.
  // EXACTLY the thing this component replaced. Degrading silently made a stale pool
  // indistinguishable from a broken feature, and that is how it was reported.
  //
  // There is no migration to run: the angle was never recorded on these, so it
  // cannot be recovered, only regenerated. What this can do is say so.
  const isLegacyPool = alternatives.length > 0 && alternatives.every((a) => !a.angle);

  const choose = async (next: TitleAlternative) => {
    if (busy || next.text === current) return;
    setBusy(true);
    setError(null);
    try {
      // Selecting is an ordinary headline edit — it goes through the same override
      // path as typing, so a chosen headline is respected as the designer's on the
      // next full regeneration.
      await edit.save(LEAD, 0, 'kicker', next.text);
      // ...and the deck follows the title rather than preceding it. The two used to
      // come out of one call, so picking a new headline left a deck written to sit
      // under a different one. Non-blocking: a deck that fails to regenerate is a
      // stale deck, which is what the designer had before, and it must not cost
      // them the headline they just chose.
      try {
        await fetch(`/api/posting/project/${edit.projectId}/sections/deck/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: next.text, angle: next.angle || undefined }),
        });
        edit.refresh();
      } catch {
        /* the title is saved; the deck simply stays as it was */
      }
    } catch {
      setError('Could not save that headline.');
    } finally {
      setBusy(false);
    }
  };

  /** More options, in ONE angle. Omitted for a legacy entry, which has no angle. */
  const propose = async (angle?: string) => {
    setBusy(true);
    setError(null);
    setMissing(null);
    try {
      const res = await fetch(`/api/posting/project/${edit.projectId}/sections/headline/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(angle ? { angle } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The most actionable message in the flow. The route names which opening
        // questions are unanswered, and rendering that as one line of grey error
        // text buried the only thing the designer can actually do about it.
        if (data?.code === 'NO_ELIGIBLE_ANGLE' && Array.isArray(data.missing)) {
          setMissing(data.missing);
        } else {
          setError(data?.error ?? 'Could not write new options.');
        }
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
    <StoryEditRegion className="mt-3 flex flex-col gap-3">
      {isLegacyPool && (
        <p className="folio-meta text-folio-text-tertiary">
          These options were written before titles were grouped by angle — get new
          ones to see what each is about.
        </p>
      )}
      {groups.map((group) => {
        // ONE option per angle is the primary read. The extra takes are reachable
        // and not hidden — but rendering all of them as equal rows puts six strings
        // back on the page with three labels above them, which is the comparison
        // this component exists to stop asking for. The angle is the choice; the
        // wording is a detail inside it.
        //
        // The one that shows is the editor's best survivor for that angle: the route
        // seats `bestPerAngle` first, so pool order already carries that judgement.
        // A take the designer has selected shows regardless of position — the live
        // headline must never be the thing behind a disclosure.
        //
        // A group with no angle is NOT collapsed. Its entries are a legacy pool or a
        // hand-typed headline — not takes on one story — so folding them under
        // "N more wordings" would label them as something they are not, and would
        // hide options an existing designer can already see today.
        const isOpen =
          !group.angle
          || expanded.has(group.angle)
          || group.options.some((o, i) => i > 0 && o.text === current);
        const shown = isOpen ? group.options : group.options.slice(0, 1);
        const hiddenCount = group.options.length - shown.length;
        return (
        <div key={group.angle || 'unlabelled'} className="flex flex-col gap-1">
          {group.label && (
            <p className="folio-meta tracking-wide uppercase text-folio-text-tertiary">
              {group.label}
            </p>
          )}
          {shown.map((option) => {
            const isCurrent = option.text === current;
            return (
              <button
                key={option.text}
                onClick={() => choose(option)}
                disabled={busy || isCurrent}
                aria-current={isCurrent}
                title={isCurrent ? 'This is the title on the article' : 'Use this title'}
                className={`group/opt flex items-start gap-2.5 text-left folio-ui leading-snug rounded px-2 py-2 -mx-2 border transition-colors disabled:cursor-default ${
                  isCurrent
                    ? 'border-folio-border-subtle bg-surface-raised text-folio-text-primary'
                    : 'border-transparent text-folio-text-secondary hover:border-folio-border-subtle hover:bg-surface-raised hover:text-folio-text-primary disabled:opacity-40'
                }`}
              >
                {/* The options were rendering as a stack of paragraphs, which reads
                    as prose rather than as a choice. A radio mark says "pick one"
                    before any of the text is read. */}
                <span
                  aria-hidden
                  className={`mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isCurrent
                      ? 'border-[var(--accent)]'
                      : 'border-folio-border-subtle group-hover/opt:border-folio-text-tertiary'
                  }`}
                >
                  {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                </span>
                <span>{option.text}</span>
              </button>
            );
          })}
          <div className="flex items-center gap-4">
            {hiddenCount > 0 && (
              <button
                onClick={() => setExpanded((prev) => new Set(prev).add(group.angle))}
                className="folio-meta text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
              >
                {hiddenCount === 1 ? 'Another wording' : `${hiddenCount} more wordings`}
              </button>
            )}
            {group.angle && (
              <button
                onClick={() => propose(group.angle)}
                disabled={busy}
                className="flex items-center gap-1.5 folio-meta text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
                More like this
              </button>
            )}
          </div>
        </div>
        );
      })}

      {/* No angle at all — a to-do, not an error. Every one of these is unlocked by
          work the designer can do, and naming the question is the whole value. */}
      {missing && missing.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded border border-folio-border-subtle p-3">
          <p className="folio-ui text-folio-text-primary">
            Answer a few more opening questions to get title options.
          </p>
          <ul className="flex flex-col gap-1">
            {missing.map((m) => (
              <li key={m} className="folio-meta text-folio-text-secondary">
                • {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {groups.length === 0 && !missing && (
        <button
          onClick={() => propose()}
          disabled={busy}
          className="self-start flex items-center gap-1.5 folio-meta text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Writing options…' : 'Suggest titles'}
        </button>
      )}

      {groups.length > 0 && (
        <button
          onClick={() => propose()}
          disabled={busy}
          className="self-start flex items-center gap-1.5 folio-meta text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Writing options…' : 'New options, every angle'}
        </button>
      )}

      {error && <p className="folio-meta text-folio-text-tertiary">{error}</p>}
    </StoryEditRegion>
  );
}

export default HeadlinePicker;

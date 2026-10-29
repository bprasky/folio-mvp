"use client";

// BreatherQuote — Full-width centered pull quote interstitial (Pattern 5).
// Theatrical entrance animation on scroll. No photo, no glass.
// Used to shift perspective between rooms.

import { useRef, useEffect, useState } from "react";
import { useStoryEdit, StoryEditRegion } from './StoryEditContext';
import type { BreatherData } from '@/lib/story/buildRoomTiles';
import type { EmbeddedQuoteChoice } from '@/lib/posting/schemas';

interface BreatherQuoteProps {
  breather: BreatherData;
  reducedMotion: boolean;
  immersive?: boolean;
}

export function BreatherQuote({
  breather,
  reducedMotion,
  immersive = false,
}: BreatherQuoteProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(reducedMotion);
  const edit = useStoryEdit();
  const [choosing, setChoosing] = useState(false);
  const [choice, setChoice] = useState(breather.choice);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setChoice(breather.choice), [breather.choice]);
  const selected = breather.options.find(option => option.sourceId === choice.sourceId && option.text === choice.text);
  const attribution = selected?.contributorAttribution ||
    (choice.attribution === 'designer' ? breather.credits.designer || breather.credits.organization
      : breather.credits.organization || breather.credits.designer) || breather.attribution;

  const save = async (next: EmbeddedQuoteChoice) => {
    if (!edit || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/posting/project/${edit.projectId}/sections/embedded-quote`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this quote. Try again.');
      setChoice(result.choice);
      edit.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this quote. Try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      className={immersive ? 'py-6 text-center' : 'col-span-2 py-12 md:py-16 text-center'}
      style={{
        borderTop: "1px solid rgba(87, 75, 67, 0.06)",
        borderBottom: "1px solid rgba(87, 75, 67, 0.06)",
        opacity: reducedMotion ? 1 : revealed ? 1 : 0,
        transition: reducedMotion ? undefined : "opacity 200ms ease",
      }}
    >
      {edit && <StoryEditRegion className="mx-auto max-w-[600px] px-6 mb-6 text-left">
        <button type="button" aria-expanded={choosing} onClick={() => setChoosing(!choosing)}
          className="folio-meta underline text-folio-text-primary">Choose quote and credit</button>
        {choosing && <div className="mt-4 space-y-4">
          <label className="block folio-meta text-folio-text-primary">Quote
            <select aria-label="Embedded quote" disabled={saving}
              value={breather.options.findIndex(option => option.sourceId === choice.sourceId && option.text === choice.text)}
              onChange={event => {
                const option = breather.options[Number(event.target.value)];
                void save({ ...choice, sourceId: option.sourceId, text: option.text,
                  attribution: option.contributorAttribution ? undefined : choice.attribution });
              }} className="mt-2 w-full rounded-lg border border-folio-border bg-[var(--surface-canvas)] p-3">
              {breather.options.map((option, index) => <option key={`${option.sourceId}:${index}`} value={index}>
                {option.label}: {option.text}
              </option>)}
            </select>
          </label>
          {!selected?.contributorAttribution && (breather.credits.organization || breather.credits.designer) && <label className="block folio-meta text-folio-text-primary">Credit to
            <select aria-label="Quote attribution" disabled={saving} value={choice.attribution ?? (breather.credits.organization ? 'organization' : 'designer')}
              onChange={event => void save({ ...choice, attribution: event.target.value as 'organization' | 'designer' })}
              className="mt-2 w-full rounded-lg border border-folio-border bg-[var(--surface-canvas)] p-3">
              {breather.credits.organization && <option value="organization">{breather.credits.organization} (organization)</option>}
              {breather.credits.designer && <option value="designer">{breather.credits.designer} (individual)</option>}
            </select>
          </label>}
          {saving && <p role="status" className="folio-meta">Saving quote…</p>}
          {error && <p role="alert" className="folio-meta">{error}</p>}
        </div>}
      </StoryEditRegion>}
      <blockquote
        className="mx-auto max-w-[600px] px-6"
        style={{
          fontFamily: "var(--font-headline)",
          fontSize: "clamp(22px, 3vw, 26px)",
          fontStyle: "italic",
          fontWeight: 'var(--w-body)',
          lineHeight: 1.45, /* folio-design-system: off-scale */
          color: immersive ? 'inherit' : "rgba(87, 75, 67, 0.55)",
          transform: reducedMotion
            ? undefined
            : revealed
            ? "translateY(0)"
            : "translateY(24px)",
          opacity: revealed ? 1 : 0,
          transition: reducedMotion
            ? undefined
            : "opacity 700ms ease, transform 700ms ease",
        }}
      >
        &ldquo;{choice.text}&rdquo;
      </blockquote>
      <footer
        className="mt-4"
        style={{
          fontSize: 'var(--type-meta)',
          color: immersive ? 'inherit' : "rgba(87, 75, 67, 0.35)",
          opacity: revealed ? 1 : 0,
          transition: reducedMotion
            ? undefined
            : "opacity 500ms ease 300ms"
        }}
      >
        &mdash; {attribution}
      </footer>
    </div>
  );
}

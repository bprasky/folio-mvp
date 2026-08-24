'use client';

// ============================================================================
// "Write it using…" — the context options, offered only when they would do
// something.
//
// These were a permanent checkbox row on the Publish tab. Two problems with
// that, and the second is the one that made them feel fake:
//
//   1. They described the NEXT run while sitting on a page showing the LAST
//      one, so they were inert between generations. They belong to a run, and
//      are asked beside each button that starts one.
//   2. Nothing could tell whether either would contribute anything. A designer
//      with no bio and no other published projects saw two checkboxes that
//      changed nothing, and only found out from `designerBioMissing` in the
//      generate RESPONSE — after the run they were meant to inform.
//
// So availability is resolved first, and an option that cannot change the output
// is not rendered. The labels name what would actually be pulled in ("My other
// published projects (3)") because a count is the difference between a promise
// and a claim.
//
// The rules behind availability live in @/lib/posting/generationContext and are
// applied by the generate route too — the offer and the run must not disagree.
// ============================================================================

import { useEffect, useState } from 'react';
import type { GenerationContextAvailability } from '@/lib/posting/generationContext';

export interface ContextChoice {
  includeBio: boolean;
  includeProjectHistory: boolean;
}

/**
 * Availability for a project, fetched once. `null` while it is still unknown —
 * callers render nothing rather than flashing options that may not apply.
 */
export function useGenerationContext(projectId: string): GenerationContextAvailability | null {
  const [availability, setAvailability] = useState<GenerationContextAvailability | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/posting/project/${projectId}/generation-context`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setAvailability(data);
      })
      .catch(() => {
        // Non-fatal. Availability unknown means the options stay hidden, and
        // generation proceeds with its own defaults — both flags default to ON
        // server-side, so a failed probe never silently narrows an article.
      });
    return () => { cancelled = true; };
  }, [projectId]);

  return availability;
}

export function GenerationContextOptions({
  availability,
  value,
  onChange,
  className,
  bioMissingHint = true,
}: {
  availability: GenerationContextAvailability | null;
  value: ContextChoice;
  onChange: (next: ContextChoice) => void;
  className?: string;
  /** Offer the "add a bio" nudge when there is no bio to include. */
  bioMissingHint?: boolean;
}) {
  if (!availability) return null;

  const showBio = availability.bio.available;
  const showHistory = availability.projectHistory.available;

  // Nothing to offer. The nudge is worth one line — it is the only way a
  // designer learns the option exists at all — but it is not a checkbox,
  // because there is nothing to check.
  if (!showBio && !showHistory) {
    if (!bioMissingHint) return null;
    return (
      <p className={`folio-meta text-folio-text-tertiary ${className ?? ''}`}>
        Folio writes in your voice when it has one.{' '}
        <a href="/settings/profile" className="text-[var(--accent)] hover:text-[var(--accent-hover)] underline">
          Add a bio
        </a>
      </p>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-4 folio-meta text-folio-text-tertiary ${className ?? ''}`}>
      <span>Write it using</span>
      {showBio && (
        <label className="flex cursor-pointer select-none items-center gap-1.5">
          <input
            type="checkbox"
            checked={value.includeBio}
            onChange={(e) => onChange({ ...value, includeBio: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-folio-border-subtle accent-[var(--accent)]"
          />
          <span>
            {availability.bio.source === 'org' ? 'Our studio bio' : 'My bio'} and design philosophy
          </span>
        </label>
      )}
      {showHistory && (
        <label className="flex cursor-pointer select-none items-center gap-1.5">
          <input
            type="checkbox"
            checked={value.includeProjectHistory}
            onChange={(e) => onChange({ ...value, includeProjectHistory: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-folio-border-subtle accent-[var(--accent)]"
          />
          <span>
            {availability.bio.source === 'org' ? 'Our' : 'My'} other published projects (
            {availability.projectHistory.count})
          </span>
        </label>
      )}
    </div>
  );
}

export default GenerationContextOptions;

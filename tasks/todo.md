# Task: Project Progress Tracker (top of project detail view)

## Context
Guided "what's next" region at the top of the project detail view. A wizard sets
project type (Completed / In Progress / Concept); the tracker picks up from there.
Recreate the reference design in our existing design system (Tailwind tokens), not
raw HTML. Timeline enum maps: PAST→Completed, PRESENT→In Progress, FUTURE→Concept.

## Seven non-negotiable rules
1. One stepper is the spine and owns all counts. Nothing else restates a number.
2. Each step done/current/upcoming; current unmistakable.
3. One next-action zone directly below the stepper; content changes with current step.
4. Import cards aren't permanent — fill the zone on the materials step, collapse to
   "Add more" bar once materials exist and the user moves on.
5. Next action is the most prominent interactive element — no greyed-out CTA.
6. Room-naming guidance is contextual to the Rooms step body copy, never floating.
7. Tracker adapts to type — different sequences + copy; never show steps that don't apply.

## Plan
- [x] 1. `src/lib/publish/computeTrackerState.ts` — pure derivation + TRACKER_TYPES
      (sequences, materialsKey, end-cap notes, exact copy per step). currentStep =
      first incomplete step. materialsExist flag. No React.
- [x] 2. `src/app/project/[id]/ProjectProgressTracker.tsx` — client component.
      `.tracker` card: stepper (top) + next-action zone (bottom). Step states, 2px
      track + down-tick, two zone modes (normal / materials grid), collapsed bar.
      CTAs navigate to the relevant `?view=` (where the real action UI lives).
- [x] 3. `src/app/project/[id]/page.tsx` — derive tracker inputs from existing data
      (publishReadiness gates + totalSelections + isPublished), mount between
      ProjectHeader and ProjectTabs.
- [x] 4. `src/app/project/[id]/ProjectHeader.tsx` — drop "X rooms · Y items" from the
      meta row (rule 1: the stepper owns those counts now; matches reference meta).
- [x] 5. Typecheck (clean on changed files; repo has a pre-existing 1052-error
      baseline unrelated to this work), derivation sanity-checked, commit, push.

## Review
- **Adaptive, type-driven tracker.** `TRACKER_TYPES` encodes the three sequences,
  materials step, end-cap notes, and exact copy. `deriveTrackerState` derives the
  current step from real completion (first incomplete), never from clicking.
  Verified all three types + the screenshot state via a throwaway tsx harness.
- **Reused the readiness gates.** Completion comes from `computePublishReadiness`
  gates + selection count + publish state, so the tracker and the in-context spine
  never disagree. No new data model, no schema change.
- **Seven rules honored.** (1) Stepper owns counts; header meta now reads
  "Started … · Last edit …" only. (2) done/current/upcoming with gold-only current
  + soft ring + ink-filled done. (3) one zone below the stepper, content keyed to
  current step. (4) import cards only on the materials step before materials exist,
  then collapse to the "Add more" bar — matches the screenshot exactly. (5) primary
  CTA on accent, never disabled. (6) room-naming guidance lives in the Rooms-step
  body copy. (7) sequences differ per type; inapplicable steps never render.
- **Tokens.** Used canonical design-system tokens (folio-stone-100/700,
  folio-accent-700, folio-gold-ornament, --accent/--accent-hover, surface-*,
  folio-border-*, font-metricsMono for formats). No raw HTML, no new globals.
- **CTA wiring.** Routes to the surface that already hosts each action (Media for
  upload/materials/tag/interview, Publish for publish/share). No dead, greyed CTA.
- **Follow-up (flagged, out of scope):** the in-context `PublishSpine` inside the
  Media tab still restates a status line. The top tracker is now the canonical
  spine; a later pass could retire that status line to fully satisfy rule 1 across
  every surface.
</content>

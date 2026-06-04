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

---

## Update — make the tracker the single flow driver

Removed the old in-context tracker + duplicate upload areas and wired the top
tracker to drive every existing flow.

- **Deleted** `PublishSpine.tsx` (the old gated spine) and removed the intro line
  + 3 skeleton upload cards from `MediaSection`. The Media surface is now just the
  media grid + the flows the tracker routes into.
- **Action routing.** Each CTA / import card carries a `TrackerAction`. The tracker
  links to `?view=media&action=<X>` (publish/share → `?view=publish`). `MediaSection`
  reads `?action=` on mount, opens the matching existing modal, then strips the
  param so refresh/back doesn't re-fire. Map: upload→ProjectCreationModal,
  sort-rooms→scroll to grid, tag→TagReviewPanel, interview→InterviewModal,
  materials→MaterialsStep, import-presentation→PresentationImportModal,
  import-website→WebsiteImportModal (newly mounted), import-specs→PdfSpecImportModal.
- **Materials cards repointed.** The 3rd import card now targets the spec-sheet flow
  (the materials step imports products, not photos), so all three cards bring in
  products via real flows.
- Verified every CTA/card resolves to a concrete action route + derivation still
  correct; typecheck clean on changed files. The earlier rule-1 follow-up is now
  resolved: the only spine left is the top tracker.

---

## Update — collapse the materials-step cards to import + manual

Audited the backends: presentation (`/api/import/*`, PDF+PPTX) creates pending
photo tags; spec (`/api/projects/{id}/extract-pdf`, PDF only) extracts a spec
list; no XLSX/CSV product parser exists; the website modal scrapes a page for
images (not a per-photo product tag). Acted on the founder's direction:

- **One "Import a document" card** (PDF · PPTX, primary) → the presentation
  pipeline. One upload, we parse it; the designer no longer picks a file type.
  The pipeline produces pending product tags on photos, which is the Tags-step
  goal. (PDF deck-vs-schedule auto-detection is a backend follow-up; the
  finish-schedule extractor stays reachable via the Materials chooser.)
- **New "Tag by hand" card** → opens the existing `ProjectImageTagger`.
- **Removed the website/URL card** — it dumped page images into the project, not
  a product onto a specific photo. Per-photo URL tagging belongs inside the
  manual tagger (follow-up), not as a project-wide import here.
- Dropped the now-unused `WebsiteImportModal` mount and the `import-website` /
  `import-specs` actions.
</content>

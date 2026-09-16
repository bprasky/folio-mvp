# Exact project room preview repair — 2026-09-15

Scope: restore existing direct-quote and Folio teaser choices and visible photo tags for project dda4b29e-dbdf-4f54-ad21-32dafd4d1dd4. Preserve article prose and designer selections; no new interview work.

- [x] Audit saved room selections, interview attribution, and tags through the actual owner renderer.
- [x] Reproduce missing direct choices, article-opening fallback, and missing photo dots with representative saved data.
- [x] Fix the broken boundaries and add focused regression coverage.
- [x] Verify exact project data and edit/preview behavior; report live verification limits explicitly.
- [ ] Regenerate original Folio options after the requested external-provider transfer approval; review sources and save with a concurrent-edit guard.
- [ ] Deploy and verify the code fixes after resolving the regeneration approval.

### Review

All 10 written rooms had an empty direct pool and only article-excerpt Folio options, despite 31 eligible loaded answers and 3–13 quote candidates per written room. The backfill predicate treated those selectors as complete. A versioned repair now revisits incomplete legacy pools once; ranker exceptions retain code-ranked verbatim candidates. Existing authored selections remain intact. The writer rejects copied article sentences, the owner picker identifies excerpt fallbacks honestly, and preview omits duplicated feature/teaser text. Saved photo tags display immediately on desktop and touch across room, gallery, and cover photographs; overlays follow parallax and the cover crop.

An isolated code-only production data repair restored 49 verified direct choices across the 10 written rooms, preserving Folio selections, article prose, and image assignments. Readback confirms no written room still has an empty direct pool. The exact saved room data passed the real React selector test at every chapter index. Nine of 20 project photos have saved tags; no tag positions were invented for the other 11.

Verification: 33 Folio/source/UI checks plus all 10 saved room selectors; 41 API scenarios including authorization and compare-and-save conflicts; 9 preparation cases; 6 photo interaction cases; draft-load and edit/preview checks; core regressions (8 passed, disposable DB journey skipped); focused lint (existing warnings only); TypeScript ratchet 903 against 904 baseline; client import and migration guards. Manual React/source review completed.

Limits: authenticated owner browser is unavailable (signed-out 404), so exact data was checked against the actual components locally, not claimed as a live owner-browser pass. Automatic approval review rejected live Folio regeneration because it transfers room interview content to Anthropic. A local input review and user approval request are prepared. No Folio regeneration was performed, no article prose was rewritten, and this code is not deployed yet.

# Existing article photo tags — functional verification, 2026-09-15

Scope: keep new 3D, diagrams, and richer photo interactions parked. Verify the existing public article photo-to-tag-to-product flow and fix confirmed functional defects only.

- [x] Trace the active public article renderer, tag data, selection behavior, and product destination.
- [x] Verify existing desktop, touch, and keyboard interactions with focused checks; use the live reader where accessible.
- [x] Fix confirmed defects with minimal changes and regression coverage.
- [x] Record verified behavior and any live-access limitations.

### Review

Removed PhotoTile's duplicate tag-visibility state, which hid the real touch overlay and could hide an active product card. Mobile tag touches now stay within the tag until its click is delivered; cancelled touches clear pending timers. Keyboard events on product controls no longer toggle the enclosing room; the photo itself supports Enter and Space.

Verification: five real-component interaction cases in `node scripts/check-photo-tag-interactions.cjs` pass. The original visibility, tap activation, and keyboard failures were reproduced before the fix. Browser fixture with real Framer Motion verified desktop tag reveal, correct product card, product actions, and navigation to `/products/lamp`. Existing project-home and reader-preview checks pass. Focused lint passes with existing PhotoTile warnings; TypeScript ratchet passes (903 diagnostics against 904 baseline), client import guard and migration discipline pass. Manual React review found no new dependencies or changes to data visibility.

Limits: live `/p/meru-XB4XBK` loads and expands room sections, but the original owner project link is unavailable while signed out. Touch event coverage uses jsdom; physical-device touch and this exact project's live tag data remain unverified. The browser fixture uses sample products and simplified layout CSS. No new feature or database change; fixes are not deployed.

# Project home and reader preview — approved scope, 2026-09-15

- [x] Trace header actions: retain existing spec export and project overview functionality.
- [x] Trace published landing: current defaultView still chooses the publishing workflow.
- [x] Trace preview removal: commit 4b10f6c3 explicitly retired Edit/Preview; staging currently mounts StoryEditProvider for drafts.
- [x] Restore Edit / Preview with the shared public article renderer; preview hides editorial choices, badges, and workflow clutter while preserving saved selections.
- [x] Make published projects land on an owner project home, including after successful publication; retain explicit links into the editing steps.
- [x] Move exports, project details, and existing social tools onto that home. Only expose tools backed by working destinations; a richer finish-book export requires separate scope from the existing product-list PDF/XLSX.
- [x] Audit revision behavior before promising edit-and-republish while the live article remains unchanged. Current staging exposes Unpublish before editing.
- [x] Verify unpublished landing, successful publish landing, published return visits, explicit edit navigation, clean preview, selected title/teaser persistence, and existing exports/social destinations.

## Review findings

Implemented a published project home with the existing carousel/campaign tools, product-list export, and overview. Canonical entry points now use lifecycle-aware landing. Edit project confirms unpublishing, preserves content, and opens the editor; republish returns home. Separate live/draft revisions are not supported by the current single-post model and were not introduced.


### Verification

- `node scripts/check-project-home.cjs`: passes real React component events for moved exports, social gating, details, confirmation/cancel, unpublish failure/success; executes actual view-selection code for published/draft/working projects. Baseline `864de55d` fails the published landing assertion as expected.
- `node scripts/check-project-preview.cjs`: passes real staging panel and edit-context interactions with fixture article/API dependencies: clean saved preview, unsaved text retained, save refresh, focus containment/restoration, nested Escape, publish success/failure navigation.
- Story-editing structural checks: all 30 pass (run with TypeScript transpilation because tsx hits a sandbox user-info error).
- TypeScript diagnostic ratchet: passes with no new diagnostics. Focused lint and full reviewer lint pass with existing warnings. Client import guard and migration discipline pass.
- Production build: passed with network access for existing Google Fonts; verification recorded in tasks/project-home-build.txt. The subsequent dialog-mount guard is covered by the interaction test, focused lint, and final typecheck.
- Review: no remaining actionable findings after fixing preview keyboard focus and nested sheet Escape.
- Boundaries: tests use fixture transport rather than live auth/database; no real project was unpublished or republished. Headless Chrome launch timed out, so interaction proof uses jsdom; visual browser QA remains unverified. No schema or migration changes.


# Project page — layout & hierarchy fixes

Design review of `/project/[id]` (publishing flow). Canvas:
https://claude.ai/artifact/K1TXBGnzgB7kF4K57FB1rr

## Plan

- [x] 1. Delete the shadcn `--accent` / `--accent-foreground` mapping that
      overrode `--folio-gold` app-wide (light **and** dark blocks)
- [x] 2. Darken functional gold to a value that actually meets AA
- [x] 3. Remove the two header buttons that had no `onClick`
- [x] 4. Leave no filled button in the header, so the tracker CTA is the
      page's only primary action
- [x] 5. H1 back on `--type-h1`; badge row folded into the meta row
- [x] 6. Next-action zone laid out as one band instead of a stacked block
- [x] 7. Dotted underline on reachable stepper labels

## Review

### 1–2. The accent token (`src/app/globals.css`)

`globals.css:112` set `--accent: var(--folio-gold)`. A second `:root` at
:651 re-declared it as `--folio-accent-200` (#D6CBBC) and, being later at
equal specificity, won — for all ~1,400 `var(--accent)` uses across 289
files. The `[data-theme="dark"]` block at :715 did the same with higher
specificity. Both removed.

Two things showed it was accidental rather than intended: `--accent-hover`
was never re-declared, so accent buttons sat taupe at rest and snapped to
gold on hover; and `PrimaryCta` hard-codes its glow as
`rgba(184,132,92,.30)` — a gold shadow under a taupe fill.

The override was also dead: nothing reads `--accent-foreground`, and no
`bg-accent` utility resolves against this Tailwind config (`colors.accent`
is the `engage/perf/opp/risk/slate` set, with no `DEFAULT`).

Measured, white-on-fill:

| | ratio | AA (4.5:1) |
|---|---|---|
| #D6CBBC — what shipped | 1.60:1 | fail |
| #B8845C — intended | 3.23:1 | fail |
| #8C5F3C — now | 5.50:1 | pass |
| #724A31 — hover | 7.67:1 | pass |

So `--folio-gold` moved to #8C5F3C and `--folio-gold-hover` to #724A31
(hover must stay darker than rest). The old `/* Functional — WCAG AA on
#FCFBF7 */` comment was false in both directions and is corrected.

**Blast radius:** every functional gold surface in the app gets slightly
darker. That is the point — the token is used for buttons, focus rings,
active states and links, all of which were below AA.

### 3–5. `ProjectHeader.tsx`

Dropped the `Share` fallback (:239) and `Add tile` (:254); neither had an
`onClick`, and `Add tile` was `bg-folio-text-primary text-white` — the
heaviest element on the page. The cluster is now ghost-only, so the
tracker's CTA is the sole primary. `Plus` import dropped with it.

H1 `text-[72px]` → `text-folio-h1` (48px/1.10). The old size was 1.5× the
scale with no off-scale comment, against the rule stated in `globals.css`.
Status and category badges moved from their own 36px row into the meta row.

### 6–7. `ProjectProgressTracker.tsx`

`NextActionZone` is now one flex band — eyebrow/headline/body left, CTA
right — at 123px instead of 213px. Headline 27px → 22px in both it and
`MaterialsZone` so the two stay consistent. Stepper padding `pt-8 pb-7` →
`pt-6 pb-5`; zone `pb-8 pt-2` → `pb-6 pt-1`.

Reachable step labels get a dotted underline: in the publishing flow
`ProjectTabs` renders `null` (every tab is gated off), so the stepper is
the page's only navigation, and `hover:opacity-80` was its whole
affordance.

Net: ~723px of chrome before the first photo → ~508px on a 1440×900
laptop, so a full row of photos clears the fold instead of a third of one.

## Verification

- `npm run typecheck:prepare` — full production build compiles
- `npm run typecheck` — no new fingerprints from these changes
- `npm run guard:client-imports` — pass
- `next lint` on the three changed files — no errors; warnings all pre-existing

## Pre-existing failure, NOT from this work

`npm run typecheck` fails on `main` itself:
`src/app/api/rep-contacts/route.ts:141` does
`export async function listAllContacts(...)`. App Router route modules may
only export the HTTP verbs plus a few config keys, so Next's generated
route type rejects it (TS2344). Reproduced with these changes stashed —
identical failure. Left alone deliberately; the fix is to move the helper
into a non-route module and import it.

# Room caption sizing — relational and length-aware, 2026-09-15

The room caption beside each photo was a flat `--type-h3` (28px / 1.25). Beside a
near-square photo the caption column is ~490px tall and the text cluster is ~170px
of it, so the caption read as undersized and marooned — the complaint that started
this. A bigger constant would fix that one room and break the next.

- [ ] Size the caption relative to the column it sits in rather than a constant.
- [ ] Make the size length-aware, so a short caption and a long one fill a
      comparable share of the column.
- [ ] Route it through CSS custom properties so `design-system-discipline` stays
      green (raw `text-[Npx]` / `leading-[N]` / `fontSize: "Npx"` all fail CI).
- [ ] Apply it to all three caption branches — owner picker, Folio-authored line,
      direct blockquote — from one source of truth.
- [ ] Leave the `wide` (Pattern 3 bar) variant on `--type-h4`; it isn't beside a
      photo, so the relational argument doesn't apply.
- [ ] Typecheck, commit, push.

## The one thing that did NOT survive contact with the code

The study proposed anchoring the caption to the **photo's height** (`cqh`). Two
findings killed that:

1. `ProjectImage` has no `width`/`height` columns (`prisma/schema.prisma:568`), so
   the aspect ratio is not known at render. `useImageAspect` discovers it by
   loading the image client-side, which means any JS-computed size would snap
   after the image loads.
2. The pure-CSS version needs `container-type: size` on the tile, which applies
   size containment — the tile stops growing to fit its own content. Today a long
   caption in a short (16:9) row makes the row taller than the photo; under `size`
   containment it would overflow into the next row instead. Worst realistic case
   measured ~418px of content in a 294px row.

So the caption is anchored to the column's **inline size** (`cqi`) under
`container-type: inline-size`, which contains nothing in the block axis and keeps
row growth intact. On desktop the column is ~523px, so the medium bucket resolves
to ~39px — the same value the approved study showed for a square photo — and it
stays fluid across breakpoints instead of being a constant.

Anchoring to the photo's height properly needs `width`/`height` persisted on
`ProjectImage` at upload. That is a schema change and deliberately not in here.

## Review

(filled in below after implementation)

Implemented in `src/components/story/captionScale.ts` (new) and
`src/components/story/QuoteTile.tsx`. The tile becomes a
`container-type: inline-size` query container and publishes `--caption-size` and
`--caption-leading`; all three caption branches — the owner's `PullQuotePicker`,
the Folio-authored line, and the direct blockquote — read those two variables, so
they can no longer drift apart. Three length buckets (<=60, <=160, longer)
resolve to roughly 51px / 39px / 31px at the ~523px desktop column, each with its
own floor and ceiling so a two-word caption doesn't become a headline and a
300-character one doesn't crowd the photo.

Two incidental fixes came for free: the picker's un-annotated `leading-[1.25]`
(which trips `design-system-discipline`'s raw-type-literal check) is gone, and the
Folio-authored line and the direct blockquote no longer disagree about
line-height — they were on `--lh-h4` and a literal `1.25` respectively.

### Verification

- `npm run typecheck:prepare` then `npm run typecheck`: **delta −1**, no new
  fingerprints from these files. The run still reports FAIL on one entry,
  `.next/types/app/api/rep-contacts/route.ts` — pre-existing and not from this
  change. Reproduced with these two files stashed. It is already grandfathered in
  `tools/typescript-baseline.json`; the mismatch is in the diagnostic's message
  text, which embeds a Prisma-generated type signature that drifts with a local
  `prisma generate`.
- `npm run guard:client-imports`: passes, no client-boundary violations.
- `design-system-discipline` raw-type-literal greps run locally: this change adds
  no new violations and removes one. The workflow is **already red on main** from
  pre-existing literals (`QuestionCard.tsx:123`, `ProjectHeader.tsx:65,70`,
  `ProjectProgressTracker.tsx:133,251`, `ProjectsPageClient.tsx:325`,
  `QuoteTile.tsx:179`). Not fixed here — out of scope.

### Boundaries

Not visually verified in a browser: no screenshot or running app was used, so the
resolved sizes are arithmetic against the real tokens and column widths, not
observed rendering. The `wide` Pattern 3 bar is unchanged. The caption is still
duplicated as the teaser beneath it (`articleFolioLines` lifts the first eligible
sentence out of the article body) — a separate, known issue, untouched.

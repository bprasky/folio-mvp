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

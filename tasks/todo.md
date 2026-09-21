# Embedded article quote choices — 2026-09-16

Scope: let the owner choose the standalone quotes between rooms using existing saved interview quotes. Default display attribution to the project's designer organization (studio/person fallback), with an explicit individual option. Contributor quotes retain their own credit. No additional interview or generation work.

- [x] Trace standalone quote placement, quote pools, and organization data on draft/public paths.
- [x] Add saved quote/attribution choices with authenticated, draft-only, concurrent-edit-safe persistence.
- [x] Add compact edit controls; keep preview/public free of controls and preserve choices across regeneration.
- [x] Verify quote eligibility, organization/person defaults, contributor credit, persistence, conflicts, and edit/preview UI.
- [x] Review and prepare a reviewable PR; commit and push the scoped change.

Plan check-in: preserve article prose and room opening selections; use the existing JSON storage and authorization boundaries. No schema migration or AI call is needed.

### Review

Added an independent quote/credit picker to the existing embedded quote breaks. Its options come from saved direct quotes and pinned contributors; Folio display lines cannot be submitted as quotations. Project.designerOrg supplies the default attribution on owner and public paths, with studio/person fallback and an explicit individual override. Contributor credit remains fixed. Existing automatic quote counts are retained, including after choosing a different quote. Saved choices are carried through the final regeneration transaction and used only while the quote remains in the current saved source pool.

Read-only audit of the reported draft confirms BP Design / Diano Matto and 50 saved quote options. A local snapshot passed the actual builder and mocked PATCH boundary without changing production data. Browser verification used the real component, this snapshot, fixture CSS, and in-memory transport: organization default, quote selection, individual override, and control-free preview all work. This is not a live authenticated owner or database-write test.

Validation: 25 embedded quote cases including the exact-project fixture; existing Folio suite (33 source/UI, 41 API, 11 serialized-reader cases, preparation, room UI and social checks); pull-quote contract; 30 story-editing checks; regeneration-surface checks; actual generation persistence; 5 publish-title checks. TypeScript ratchet 903/904, client boundary guard, migration guard and focused lint pass. Existing Unix-shell test assumptions required the local Git Bash runner on Windows; test transports remained mocked. New checks are wired into quote CI. No dependencies, migration, AI generation, production write, or deployment.

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

# Social Studio review and landing specification — 2026-09-16

Scope: review the reported campaign/carousel cleanliness and navigation; specify the coordinated Studio experience before expansion.

- [x] Inspect the current carousel/editor and campaign entry points and record concrete code findings.
- [x] Reconcile the proposal with the existing spotlight/social publishing specification.
- [x] Write a staged UX proposal and acceptance criteria in docs/reviews/SOCIAL_STUDIO_LAYOUT_REVIEW_2026-09-16.md.
- [ ] Complete signed-in visual review of the supplied project and both originating actions (available browser is signed out).
- [x] Implement cleanup and the shared Studio foundation; native publishing remains gated below.

Review: found eight literal developer annotations, fixed-width left-heavy layout, portrait-only preview despite format selection, and an unbounded campaign modal. Current source distinguishes page vs modal, so reported duplicate live routing is not yet reproduced. Review/spec only; no application or production changes.

# Global publishing hub evaluation — 2026-09-17

- [x] Inspect dropdown, editorial queue UI/API, source relationships and recommendation gate.
- [x] Evaluate global hub with editorial/posts/campaigns views and contextual project entry.
- [x] Revise the social Studio review with navigation, filters, source/consent boundaries and staged delivery.

Review: updated docs/reviews/SOCIAL_STUDIO_LAYOUT_REVIEW_2026-09-16.md. Current queue supports idea/question previews, but answer-and-launch is a placeholder and Refresh queue is an initial unlock call. Proposed hub is always accessible; the three-story threshold applies only to recommendations. Screenshot not attached; evaluation is source-based. No application/schema/production changes.

### Publishing Studio clarification — 2026-09-17

- [x] Preserve project social/campaign sections as views of shared Studio records and actions.
- [x] Include editorial-post-level campaigns and cross-project campaign composition.
- [x] Specify prominent AI story proposals grounded in cross-project signals, with evidence, designer input, and linked editorial/social outputs.

Review: Publishing Studio name accepted. Spec updated; no application changes or AI generation performed. Proposal builds on existing digest/signals/angle code; recurring refresh and completed publishing remain implementation work.

# Publishing Studio implementation — 2026-09-17

Approved scope: global Publishing Studio with project-level views of the same work, editorial and social recommendations across projects, posts and campaigns; preserve source approval and publishing rules. Existing unrelated local changes remain untouched.

- [x] Audit persisted content, source ownership and branch baseline; reuse existing models where semantically appropriate.
- [x] Build shared authorized Studio listing and global/project navigation with project/status/search filters.
- [x] Connect saved campaigns/posts and editorial recommendations to honest supported actions and source evidence.
- [x] Fix carousel annotations, responsive layout, preview ratio and campaign overflow.
- [x] Implement feasible creation/continuation paths; explicitly identify any new persistence contract requiring scoped schema review.
- [x] Verify source isolation, navigation, filters, layout and representative flows; run required repository checks and review diff.
- [x] Commit/push scoped implementation and report remaining gates precisely.

Plan check-in: approved spec is the implementation basis. No unreviewed schema edits or production data writes. Any required schema addition will be authored and shown before application under the repository migration rules.

Implementation review: shared global/project records, workspace authorization, editorial ideas and existing stories, source-based recommendations, saved carousel resume/save/export, corrected responsive previews and campaign modal shipped in the scoped branch. Four regression scripts pass and are wired into CI. Production build, focused lint (warnings only), client boundary, migration discipline and all seven design-system checks pass; TypeScript ratchet passes (903 diagnostics against baseline 904). Local actual-component browser fixtures verified desktop/mobile layouts, filtering and saved-item navigation; production signed-in verification and live AI generation were not performed. No schema or production writes.

Remaining: native standalone story answers/publication, immutable approved social versions, cross-project campaign composition and public/feed integration require the additive proposal in docs/reviews/PUBLISHING_STUDIO_SCHEMA_PROPOSAL.md. Proposed Prisma blocks validate in an isolated copy; applying them awaits the explicit schema review required by AGENTS.md.

# BP Design Studio landing fix — 2026-09-17

- [x] Audit exact workspace records read-only: four public published stories split across two members; zero saved campaigns, exports or ideas.
- [x] Show existing published stories with clear campaign/carousel entry points on Overview.
- [x] Count and compare the active organization's published work for recommendations while excluding private/foreign sources.
- [x] Add regression coverage, verify, review and push a scoped fix.

Plan check-in: correct misleading empty landing and organization eligibility; no automatic campaign creation or live AI requests.

Verification: actual patched Studio loader exercised in a read-only transaction for both active BP Design members: each sees four published stories and four campaign-eligible projects. No records generated or modified. Source-first landing regression and scoped corpus/access tests pass; full lint and reviewer pass. Client boundary and migration discipline pass. TypeScript result recorded with commit. No schema changes; approved broader proposal remains separate.

# Photo-led Publishing Studio — 2026-09-17

- [x] Prepare source-grounded photo/caption/sequence cards with no generation or writes on browsing.
- [x] Replace navigation-heavy landing with responsive 4:5 feed and shared project scope.
- [x] Open the exact prepared content in the editor, preserving saved identity and workspace authorization.
- [x] Verify preview/editor continuity, access, mobile/desktop rendering and repository checks.

Plan check-in: implement the approved photo-first polishing workflow using existing export persistence; no schema migration needed for project/room prepared drafts. Native multi-project publishing remains a separate approved proposal.

Review: source-grounded 4:5 cards share their hero renderer with the editor. Read-only live BP Design loader produced 17 cards (15 directly polishable project/room drafts plus2 existing story directions), all with source photos. Actual components rendered with that local snapshot at desktop,390px and320px; a filter popover overflow found at320px was fixed and rechecked. Exact prepare revision, idempotence, no browse generation, draft preservation, room FK, shared scope and access regressions pass. Production build, full lint, TypeScript ratchet903/904, client boundary, migration discipline and all design-system checks pass. Reviewer found no blockers. Live mutation/AI generation not run; downloaded SVG typography is not asserted pixel-identical to browser previews. Cross-project native editing remains separately scoped.

# Substantive story pitches and polish — 2026-09-17

- [x] Diagnose headline/caption failures and source extraction, fix with grounded generation validation.
- [x] Qualify room stories by substantive published evidence; surface angle, rationale and accurate length before clicking.
- [x] Make editor story-first, preserve prepared text on failure and show usable caption/headline options.
- [x] Correct studio-wide filtering, test actual BP examples and responsive editor, review and push.

Plan check-in: user authorized fixes to pitch quality and polish flow. Prioritize evidence over content volume, preserve saved drafts. No schema change needed.

## Next scope — Story configurator
- [ ] Specify subject (firm/designer/project/multiple projects), optional focus (general/room/material/decision), angle or recurring series (Q&A, material study, 20 Questions), and Folio/social outputs.
- [ ] Reuse published facts and authorized profile context; surface missing substance as targeted interview questions.
- [ ] Preserve chosen direction into the same focused Polish editor; keep curated feed separate from exhaustive combinations.
- [ ] Specify sourced trend discovery and platform adaptation separately before implementation.

Review: BP Design read-only fixture now has four substantive room stories; generic entry/room descriptions excluded. Pitch/options persist into focused caption-first Polish. Caption generation gate, published room extraction, grounded prompt and retry errors corrected. Seven regression suites, full lint, production build, TypeScript budget, client/migration/design guards pass. Desktop and390px component preview checked (no horizontal overflow). Final synthetic paired caption eval documented; production provider configuration not verified. No schema changes.

# Story configurator and interview activities — 2026-09-17

- [x] Build scoped activity definitions, authored questions, readiness checks, and answer-preserving draft assembly.
- [x] Build and visually verify configurator → one-question interview → answer review → draft preview with save/resume adapter boundaries.
- [x] Prepare the exact native editorial schema/SQL and persistence contract using current metadata recon; do not apply unapproved schema changes.
- [ ] Test boundaries, document review results, commit/push a draft PR and present the concrete migration approval gate.

Plan check-in: user approved configurator and actual designer participation. Start with firm/designer/project subjects, optional room, Q&A,20 Questions, material story, method and history. No automatic publication, invented answers or trend claims. Database approval is required by AGENTS.md before applying model blocks/migrations; build a reviewable flow before asking.

# Organization profile visual tightening — 2026-09-17

- [x] Match the organization profile shell to the white navigation canvas.
- [x] Reuse the events feed's dense mosaic for organization project cards at every non-empty count.
- [x] Align loading, filters and responsive/accessibility behavior with the updated feed.
- [x] Verify focused lint/types and visually review desktop/mobile organization states.

Plan check-in: preserve the existing profile information architecture and non-project feed cards. Reuse the established events mosaic rather than introducing a third grid system. No schema, API contract or production-data changes.

Review: organization profile now uses the white canvas token and project cards use the same dense L/M/S FlowMosaic as Events while preserving the selected org-feed sort. Shared responsive spans are static, eliminating render-time viewport reads and dynamic Tailwind classes. Loading geometry and filter accessibility match the result. Focused lint passes with existing warnings; TypeScript remains at the 904-diagnostic baseline. Representative desktop and 390px renders were checked with no mobile overflow. The live org route could not be rendered locally because sandboxed dev-server access to Supabase was blocked; the actual shared component was verified through a temporary mock route, which was removed afterward.

Review: authored three20-question sets and four shorter formats; prototype validates subject/project/room choices, retains answers on failed save, resumes the first unanswered question, requires review and invalidates drafts on edits. Unit/React interaction tests and focused lint pass; mobile390px has no horizontal overflow. Prisma validates all four proposed models/inverses in a temporary schema; no actual schema or database writes. Live persistence/API/Studio wiring is deliberately incomplete until model/migration approval. SQL generated locally, not yet tested on disposable PostgreSQL.

- [ ] After explicit model/SQL approval: apply through migration runbook, implement authorized transactional adapter/routes, wire live Studio and verify durable save/reopen before release.

Final checks: TypeScript budget902/904 with no new fingerprints; client boundary, migration discipline, all design-system guards and focused lint pass. The previous polish PR received its isolated Set-iteration compatibility fix. New activity changes remain a draft pending database approval and live backend integration.

### Horizontal setup and contextual interviews — 2026-09-17
- [x] Replace dropdown configuration with visible Topic → Story type steps; remove angle and destination fields.
- [x] Replace fixed questions with source-cited context generation; default Folio and Instagram outputs.
- [x] Verify revised UI, source boundaries and live synthetic question quality; update draft PR.
Production database approval and real profile/source adapter remain outstanding; this correction does not authorize the pending migration.

Verification: all three activity/interaction/generation suites pass; focused lint, client boundary and TypeScript budget902/904 pass. Horizontal cards verified at623px and1280px,390px has no overflow. Ten bounded synthetic provider calls informed the prompt; structural citations are checked but do not establish perfect entailment. Staged design guards pass; an unrelated in-progress FlowMosaic edit fails the working-tree raw-type guard and was left untouched. No schema changes or real profile generation.

### Topic-specific story choices — 2026-09-17
- [x] Restrict Firm History to origins, people and historical quickfire interviews; remove material and project-process options.
- [x] Share allowed combinations between visible choices and brief validation; reset choices when topics change.
- [x] Pass the selected story meaning into question generation and verify topic switching, invalid combinations and the local browser.
Review: all three focused activity suites and focused lint pass. Local preview shows only the three firm-history choices. No migration or production changes.

### Studio recommendation briefs — 2026-09-18
- [x] Audit publication timing, saved activity and actual trend collection; document honest signal boundaries.
- [x] Group supported pitches into project recommendations with visible reasons and deterministic timing/repetition ordering; preserve saved work and filtering.
- [x] Prepare completion-year/month migration review after metadata recon; never substitute publication or update time.
- [x] Verify ranking, filtering, interaction and responsive layout; commit/push a reviewable PR.
Plan: prioritize evidence before timing. Recompute cheap ranking on load with stable daily time; no paid generation on page load. Do not claim social publication from exports. Keep absent trends neutral. Schema application remains gated on the exact proposed change.

Review: focused Studio ranking, loader and interaction suites pass; focused lint, client boundary, migration discipline and TypeScript ratchet (902/904) pass. Desktop1280px and mobile390px component fixture checked; mobile has no overflow. Read-only metadata confirms no completion fields and an absent trend table. Proposed two-field schema validates in a temporary copy. Completion migration/application, project inputs, real trend collection and persistent impression/social-post feedback remain pending. No production writes or migration application.

### Approved completion migration and merge — 2026-09-18
- [x] Back up schema; add approved nullable year/month fields and exact reviewed migration.
- [x] Validate/generate and test SQL on disposable PostgreSQL; restore schema backup and stop if format/validate/generate/migrate-status fails.
- [x] Apply only the approved pending migration; verify types/constraint and clean migration status.
- [ ] Update PR787, verify CI and merge. Preserve unrelated local edits.
Approval: user explicitly approved the completion migration and merge; no new approval required for that exact change.

Migration review: user-approved SQL applied via migrate deploy; both columns and validated constraint confirmed. Bookkeeping111 records, zero unfinished,110 migration folders and clean migrate status. PGlite PostgreSQL tests pass; Docker unavailable. Compile build passed with existing unrelated import warnings. Project date-entry controls remain follow-up work.

# Editorial readiness implementation — 2026-09-21

Scope: implement attached Publishing Studio Editorial Readiness Specification v1.0 as a controlled-evaluation workflow. Default rollout remains off until the required human benchmark is reviewed. Preserve existing drafts and unrelated local work.

- [x] Read specification and audit baseline; sync merged main and create codex/studio-editorial-readiness.
- [x] Phase 0: align source authorization/inclusion, product validity, material matching, question contracts, campaign accounting.
- [x] Implement canonical candidate/evidence/visual/score/readiness/version contracts and quality-first diverse selection.
- [x] Implement explicit evaluation, durable version/event adapter, authorized lifecycle routes and guided completion UI.
- [x] Connect approved candidate exports/campaigns and explicit publication confirmation; preserve provenance through editing.
- [x] Prepare and validate exact persistence model/SQL proposal; application requires AGENTS.md review gate. If schema format/validate/generate/migrate-status fails after approved application, restore backup and stop.
- [x] Verify representative scenarios, authorization/concurrency/grounding tests, UI rendering and repository checks; review changes.
- [x] Document benchmark/deployment gates and commit/push scoped implementation.

Plan check-in: implement product contract using exact source excerpts for factual copy and explicit image assessment, never inferred intent as fact. Browsing reads persisted recommendations only. Refresh performs bounded evaluation; unknown visual/source quality cannot be promoted to Ready. No production AI calls or database writes during implementation. New database structures will be reviewed in full before application.

Review: implementation and automated checks are complete; see docs/reviews/STUDIO_READINESS_IMPLEMENTATION.md. Exact schema/SQL is proposed only. Migration application and human benchmark remain gated. Preserve feature-off default; no production writes or live AI evaluation.

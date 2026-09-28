# Interview resume screen and Start over — 2026-09-28

Scope: simplify the Story/in-progress screen into one clear resume action, visible Start over, optional saved-answer review and contextual draft controls. Start over requires an in-product confirmation, resets interview-derived state atomically, and opens the first question. Preserve project assets and existing draft/publication. No production answer clearing by the agent and no schema migration.

- [x] Trace existing restart, canonical/projection/cache ownership and concurrent writers.
- [x] Implement scoped reset with stale-tab, late-response, retry and local-draft protection.
- [x] Simplify Story and its step navigation; disclose reset scope and retain draft/review access.
- [x] Verify reset persistence, cancellation/failure/resume, original entry, desktop/mobile and protected paths; review before commit.
- [x] Commit/push the scoped change and record release status.

Plan check-in: the old Story Restart passes an intent that guided ignores; legacy clearAll rejects guided sessions. Use the existing interview transaction/CAS machinery and keep reset separate from question generation so a provider failure cannot restore old answers. The UI offers confirmation rather than deleting the user's current answers during implementation.

Review: dedicated atomic reset, stale-tab/request guards and local draft identity checks implemented. Guided regressions pass; browser workspace 16/16 and entry 16/16; core 10 pass, one disposable-database skip. Full lint, client-import guard, migration discipline and compile pass; TypeScript ratchet 903/904, no new fingerprints. Desktop/mobile/confirmation visually reviewed and final source review has no blockers. No production answers cleared. Details and test limitations: docs/reviews/guided-interview/start-over.md.

Release: PR #801 merged as 691b990. Hosted CI could not start because of account billing. A follow-up updates dependent quote/projection test fixtures for the reset contract; production rollout is being verified separately. The live release result belongs in the PR record rather than being inferred from the merge.

---

# Guided interview conversational quality — correction, 2026-09-26

Implementation plan after the founder's clarification: make each server-validated interviewer reply contain an optional meaningful reaction and one grounded question; display three animated dots only during real pending work. Supply accepted conversation and remaining prepared obligations, adapt overlapping questions to missing detail, and allow explicit evidence reuse confirmation. Preserve raw answers, exact question IDs, correction invalidation, product/spotlight restrictions, budgets, atomic save-before-decision, and existing sessions. No schema migration or flag change is needed.

- [x] Implement the conversational decision/validation contract and preserve contextual preparation; run bounded before/after transcript evaluations with token costs.
- [x] Persist grounded reactions, adapted question history, and explicit reuse confirmation; invalidate dependent wording/evidence after corrections.
- [x] Render the response naturally with real-work three-dot status, accessible reduced-motion behavior, and confirmation controls.
- [x] Verify complete multi-turn continuity, no repetitive coverage, failure/retry/resume, provenance, and browser behavior; obtain final specialist review.

The founder's live screenshots show a substantive regression: a broad answer supplies brief, scope and design direction, yet the guided UI asks generic versions of those topics again. This is core interview behavior, not a cosmetic wording issue.

- [x] Compare the screenshots and original brief with preparation, decision, progression, and verification code.
- [x] Reproduce the fixed follow-up and rejection of grounded contextual wording using the existing offline test boundaries.
- [x] Identify the implementation compromises and define the required conversational behavior before changing runtime code.
- [x] Correct the decision/preparation/controller contract and verify complete multi-turn conversations, preserving evidence and confirmation rules.

Diagnosis: the original decision.ts prohibited model-authored questions/acknowledgments and offers four fixed follow-up strings; it receives only two earlier same-room exchanges and no remaining plan. preparation.ts rejects contextual wording outside narrow regular-expression grammars and substitutes generic fallback questions. controller.ts advances to the first pending obligation without assessing overlap with already accepted material. Offline diagnosis reproduces the exact screenshot follow-up and shows grounded scope/design questions being rejected. Existing tests primarily validate boundaries, persistence and isolated decisions, not conversational continuity or repeated coverage. That diagnosis preceded the implementation below. Required correction: preserve prepared identities/obligations while allowing validated answer-grounded wording, explicit evidence-linked overlap handling under existing confirmation policy, and realistic conversation-level editorial evaluation.

Final review, 28 September: contextual preparation and evidence-first next-turn wording replace the fixed-string interview. Full-history adaptation, exact-passage confirmations (button or simple typed affirmation), correction invalidation and real-work three-dot chat behavior are implemented. Five live synthetic continuations and two complete three-turn sequences pass on the final prompt; trial failures and wording/cost limitations are retained in docs/reviews/guided-interview/conversation-quality.md. Workspace browser 16/16, entry 11/11 and core 10 passing/one disposable-database skip. Full lint, client-import guard and migration discipline pass. Final TypeScript ratchet: 903 diagnostics against 904 baseline, no new fingerprints. Final source review has no blockers. Merge and production verification follow; authenticated production interview behavior remains unverified.

---

# Guided interview entry-flow correction — 2026-09-26

Production follow-up: Vercel showed PR #799 already deployed while the guided flag was absent. The user approved “Enable and redeploy now.” Added `NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW=1` for Production only and rebuilt the same reviewed source without build cache. Deployment `59xQXpdZ45pHdxAGwBjwk2GC8Td7` is Ready and assigned to `folioad.com`; public homepage HTTP 200 and unauthenticated guided API HTTP 401 verified. This browser is not signed into Folio, so private first-question behavior is not live-verified. No schema or interview-answer writes. See docs/reviews/guided-interview/production-rollout.md for the corrected deployment history and verification limits.

Scope: correct the reported live-site Start interview journey while keeping deployment and pilot activation distinct from source-code readiness. Preserve protected spotlight routing and unrelated local edits.

- [x] Reproduce the original CTA-to-interview route and separate live rollout state from UI defects.
- [x] Open the interview directly from an explicit Start/Resume action; hide drafting controls until accepted answers exist.
- [x] Verify actual entry components, pilot/server routing, close/reopen behavior, and regression checks.
- [x] Review the scoped fix for commit/merge and document the concrete live deployment/activation step required by the original brief.

Plan check-in: retain the Story tab as an answer-review destination; carry an explicit interview-open intent from Start/Resume CTAs. Use the existing protected InterviewModal. Keep pilot enrollment default-off; no production changes without resolving the original no-deployment/no-activation instruction.

### Review

User confirmed the live site, which has not received the merged pilot deployment or activation. Explicit lifecycle and tagging actions now open the protected interview immediately; ordinary Story navigation remains review. Accepted nonblank answers gate draft/context/restart controls. Story uses a saved-only read that does not generate room questions or delay entry. Legacy question preparation now follows authorization. The wrapper honors authenticated guided availability even for a flag-off client, while spotlight remains authoritative.

Verification: 11 actual-entry browser checks pass, including a first question while saved-answer loading is held; the same fixture reproduces six failures on merged commit 6885f576. All 14 existing workspace browser cases, guided controller/prompt/service/writer checks, eight GET read/auth modes, generation-context check, client-import guard, migration discipline, and focused lint pass. Core suite: 10 passed, one disposable-database skip. TypeScript ratchet: 903 diagnostics against 904 baseline, no new fingerprints. Final specialist review found no actionable issues. Screenshots and old/new entry results are retained under docs/reviews/guided-interview; these are local fixtures, not live verification.

No schema, deployment setting, or production flag changes. Git deployments remain disabled. To make the reviewed correction and pilot available live requires a production deployment built with NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW=1; the supplied brief explicitly excludes deployment/production activation, so approval for that concrete rollout is still needed. Existing user document edits are excluded from the commit.

---

# Guided project interview pilot — 2026-09-26

Scope: implement the founder's supplied guided-interview brief through the current project interview entry point. This serves Folio's core project-story capture; no biography, realtime infrastructure, new ingestion, deployment, merge, production migration, or production flag activation.

- [x] Review the supplied brief, current interview canon, lessons, entry points, staged generators, and protected spotlight boundary; sync a scoped branch from main.
- [x] Preserve actual prepared questions in a durable, versioned session within ProjectPost interview provenance; commit answers and the canonical evidence together before deciding the next turn.
- [x] Add bounded, canon-composed next-turn decisions, stable parentage, explicit skips and corrections, staged room preparation, failure/retry handling, and safe completion.
- [x] Add an opt-in photo workspace with compact conversation, lossless microphone input, independent browsing, explicit photo attribution, and accurate pause/resume.
- [x] Verify controller/prompt invariants, concurrent/idempotent persistence, protected routing, desktop/mobile browser behavior, and canonical draft handoff; retain review screenshots.
- [x] Review the scoped diff and document activation, tested behavior, and remaining limitations; commit/push scoped implementation only.

Plan check-in: use the existing ProjectPost.provenance.interview JSON and existing generation/projection services. Keep legacy available behind the opt-in flag and private spotlight enrollment authoritative. The guided pilot does not implement the protected spotlight UI. Preserve all existing local document edits. No schema change is planned; if one proves necessary, stop that part for concrete review under the existing migration discipline.

### Review

Implemented the default-off guided workspace and versioned prepared-question plan in existing ProjectPost provenance. Answers, revisions, skips, exact source IDs and canonical projections persist atomically before bounded next-turn decisions. Existing shared-JSON writers have narrow guards/CAS protection. The photo canvas supports independent browsing and explicit attribution; recording waits for its final data event, retains full transcription and retries, and uses immutable recording IDs. Saved sessions remain usable when pilot enrollment is switched off. Private spotlight projects retain their protected existing flow.

Verification: guided controller/prompt/service/writer checks pass; 14 actual-component browser scenarios pass; core suite has 10 passes and one disposable-database skip, including the guided API-to-editable-DRAFT journey with corrections, two rooms/photos and a public-reader denial. Five live synthetic prompt evaluations pass. ESLint, client-import guard, Prisma sync, migration discipline and existing quote/persistence checks pass. TypeScript diagnostic ratchet passes with 903 diagnostics against 904 baseline and no new fingerprints. The authorization scanner has no finding for the new guided route; its overall command still fails on seven pre-existing critical findings in five unchanged Publishing Studio route files. Final specialist review found no remaining issues.

Activation, changed-file map, desktop/mobile screenshots, synthetic prompt results and limits are in docs/GUIDED_INTERVIEW_PILOT.md. Real PostgreSQL isolation, physical microphone/Whisper and a full authenticated browser journey against a disposable database remain unverified. No schema change, production setting change, merge, deployment, or production activation.

---

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

## Approved readiness migration and merge — 2026-09-21
- [x] Back up schema, append exact approved models and migration, validate and generate.
- [x] Apply only approved migration and verify live columns/constraints/indexes/RLS/bookkeeping.
- [ ] Commit/push, verify PR checks, merge PR788; keep rollout disabled.
Approval: user said "approved, merge" after exact SQL/model review. If format/validate/generate/migrate-status fails unexpectedly, restore tasks/schema-prisma-backup-readiness-approved.prisma and stop.

Application review: approved migration applied;3 tables/20 columns and all constraints/indexes/RLS verified,112 bookkeeping records and zero unfinished. Prisma status/client alignment clean. Rollout disabled; merge pending CI.

## Studio explicit draft lifecycle — 2026-09-21
- [x] Trace open-time writes across legacy, readiness and local preview.
- [x] Make legacy proposal opening read-only; persist only explicit saves/downloads.
- [x] Add meaningful dirty checks, save/discard/keep exit choices, and clear saved-work actions.
- [x] Persist incomplete readiness answers as drafts without resolving blockers; remove image reorder autosaves.
- [x] Verify clean open/exit, dirty save/discard, failed save, resume, authorization and existing drafts.
Plan: repair existing editor/persistence contracts without schema or production changes. Do not automatically delete historical drafts that may contain user work.

Review: targeted editor, persistence, readiness, landing and draft-removal regressions pass, including first-save retries/concurrency, failed-save retention and authorization. Local browser verified clean exit, partial-answer save/resume and explicit removal. Client-import and migration-discipline guards pass; TypeScript budget passes at 903 against 904 baseline (existing debt remains). Added configurator and draft-removal checks to CI. Changes remain local, unmerged and undeployed.

## Studio discovery and About me — 2026-09-21
- [x] Replace hidden project/type choices with accessible subject thumbnails and visible format buttons in both Studio paths.
- [x] Surface personal activities, recommended work and archive stories in visible compact feeds.
- [x] Connect preset activities to authenticated persistence and useful profile/social completion actions.
- [x] Verify routing, filters, activity lifecycle, empty states and responsive browser presentation; preserve explicit draft behavior.
Plan check-in: implement the approved proposal using existing source and activity contracts, with no fabricated completion dates or automatic publication/profile edits. Preserve unrelated work and the completed draft fix. Inspect persistence before choosing the smallest safe integration.

Review: see docs/reviews/studio-discovery/README.md. User explicitly approved the exact four-table SQL/model batch; applied with clean postflight. Independent review found no remaining blockers after fixes. Compile, regressions, client/migration guards and TypeScript budget pass (903/904, exact display equivalence proof, baseline unchanged). Browser walkthrough used synthetic content only. Application awaits merge/deployment.

## Studio discovery merge — 2026-09-22
- [x] Inspect PR790 checks and repair Node20 browser globals and approved-schema guard expectations.
- [x] Verify guard mutation tests and activity entry with native navigator disabled.
- [ ] Verify remote CI and merge the approved PR790.
Review: test-only CI corrections preserve exact schema/SQL approval hashes and reject unauthorized changes. No application or database changes in this follow-up.

## Studio purpose-led opportunities — 2026-09-22
- [x] Audit reusable opportunity, activity, profile placement and campaign persistence contracts.
- [x] Add a shared purpose/reason/path/result/destination adapter, contextual selection and nonduplicated presentation.
- [x] Deliver editable personal introductions with real resume/completion state and truthful profile placement.
- [x] Deliver a project-specific release flow with explicit room selection, saved sequence, dates and existing individual editors.
- [x] Verify authorization, stale sources, reload persistence, readiness, purpose-to-outcome parity, desktop/mobile and keyboard states.
- [x] Capture screenshots, walkthroughs, review and scoped commit/PR. No production mutations, migrations, merge or deployment.
Plan check-in: keep the photography-led design and current quality gates. Recommendations lead with a designer purpose; formats are secondary. Reuse existing JSON storage only when its ownership and consumer contracts permit durable plans. Planning dates never imply automatic scheduling. Preserve unrelated work.

Review: implemented and verified; see docs/reviews/studio-purpose/README.md for walkthroughs, screenshots, test evidence and supported boundaries. Production compile, lint, guards, all existing Studio checks and new persistence/UI regressions pass. TypeScript budget 903/904, baseline unchanged. Committed on the scoped local branch. Push and draft PR blocked by automatic approval review pending explicit destination approval; no production writes, migrations, merge or deployment.

## My expertise — 2026-09-22
- [x] Trace Studio, evidence, interview, publication, profile and asset contracts against the specification.
- [x] Implement qualified comparison discovery, durable feedback, source references and feature gate.
- [x] Implement saved adaptive interviews, corrections, gaps and exact evidence selection.
- [x] Implement reviewed illustrated articles, explicit profile featuring and versioned sharing.
- [x] Verify authorization, source revocation, retries, correction propagation and desktop/mobile flows.
- [x] Record supported behavior, pilot limitations, screenshots and scoped commit/PR.
Plan check-in: implement the user-approved My Expertise specification behind a disabled-by-default feature flag, reusing existing storage where its contracts fit. Keep personal introductions and release plans intact. No production data writes, migration application, deployment or feature activation. If schema changes prove necessary, present exact blocks under the repository approval gate before applying them.

Review: implemented behind disabled flag; no schema or production changes. Compile, lint, TypeScript budget (903/904 unchanged baseline), guards, new engine/UI/service/PostgreSQL checks and existing Studio regressions pass. Desktop/mobile synthetic browser walkthrough complete. See docs/reviews/my-expertise/README.md for evidence and required live-model/designer pilot gates. Ready for scoped commit and draft PR; no merge or deployment.

## Studio window shopping — 2026-09-22
- [x] Sync merged main; audit card and feature-gate callers.
- [x] Reduce browse cards to visuals, activity labels and specific titles; move pitches/actions into accessible dialogs.
- [x] Replace crowded project slider with a searchable project gallery and consistent format controls.
- [x] Make My expertise accessible with consistent server-side feature checks.
- [x] Verify browse-without-writes, dialogs, keyboard/mobile, existing routes and regression checks.
Plan check-in: implement the user's correction across both Studio paths using existing data and actions. Keep saved-work behavior intact. No schema changes or production writes; feature availability changes in code, without editing hosted settings.

Review: implemented both Studio paths, shared accessible pitch dialogs, searchable project gallery and default-on expertise with explicit kill switch. Compile, lint, TypeScript 903/904, guards and targeted regression/UI/storage checks pass. Synthetic desktop/mobile browser review complete. See docs/reviews/studio-window-shopping/README.md. No production environment edits or deployment.

## Studio pitch photographs — 2026-09-22
- [x] Carry project and expertise photography into the pitch modal; omit decorative personal covers.
- [x] Verify exact image retention and existing browse/action regressions.
- [ ] Browser-check and merge PR793 after CI passes, as approved by the user.

## Studio concierge publications — 2026-09-23
- [x] Trace prepared sources, saved work, renderers, entry stages and identity assets.
- [x] Define shared publication card contract; show faithful post/article covers and truthful remaining contributions.
- [x] Simplify navigation to Suggestions/In progress plus quiet filter and secondary exports.
- [x] Connect personal/expertise identity and saved previews to production renderers and actual work.
- [x] Update enduring Studio product guidance; verify routes, edits, mobile, keyboard and source fidelity.
- [x] Capture representative screenshots and ship scoped implementation PR.
Plan check-in: follow the new concierge PR definition, superseding modal-first browsing. Reuse actual source identity and existing work; no fabricated prose, new tables, or production writes. Preserve all saved paths and exports.

Review: implemented publication-led cards and direct actions across both Studio paths, shared production previews, actual identity/saved titles, one Filter control and secondary exports. Compile, 37 regression scripts, scoped ESLint, client/migration guards and TypeScript budget (903/904, unchanged baseline) pass. Synthetic desktop/mobile and saved-expertise browser walkthrough captured in docs/reviews/studio-publication-previews/README.md. Scoped implementation ready for commit and draft PR; no merge, deployment or production writes.

## Studio audience hooks and publishing history — 2026-09-23
- [x] Audit every content-card source, headline generator, saved handoff and publication-history store.
- [x] Prepare concise evidence-grounded public headlines before opening, separate from private guidance.
- [x] Apply audience-facing previews across project/room/detail/material, expertise, personal and saved work.
- [x] Use publication/draft/schedule history and semantic angle overlap; add scoped already-shared corrections with existing storage where appropriate.
- [x] Verify source/ownership boundaries, preservation of edits, repeat suppression, direct handoffs and responsive rendering.
- [x] Document supported history coverage and screenshots; commit, push and create a scoped PR.
Plan check-in: refine the merged implementation around audience-facing hooks. Keep uploads, Folio publication, external publication, generated exports and planning dates distinct. Treat the truncated final sentence as a request to avoid repeatedly recommending the same weak or already-covered story. Audit existing persistence before adding any storage; schema changes require the exact review gate.

Review: public hooks are distinct from private guidance across prepared and saved Studio paths; project/room interview covers resolve current INCLUDED source photos, personal covers retain identity, and designer edits remain authoritative. Sharing corrections are explicit, scoped and reversible; confirmed project introductions do not reappear under new wording. 39 focused/regression scripts passed across the run, with affected checks rerun after changes. Production compile, scoped ESLint, client/migration guards and TypeScript budget (903/904; baseline unchanged) passed. Synthetic desktop/mobile correction-and-undo review is recorded in docs/reviews/studio-audience-hooks/README.md. No schema migration, paid model backfill, live publication or deployment.

## Signup and firm onboarding audit — 2026-09-23
- [x] Trace individual signup, firm search/join/create/solo, and posting eligibility.
- [x] Identify mobile layout and form-state friction using supplied screenshot and source.
- [x] Document a short-form replacement flow, implementation priorities and verification cases.
Plan check-in: audit current behavior and prepare a concrete simplification proposal. This directly serves designer onboarding. No application or production changes in this audit.
- [x] Source and screenshot audit completed; findings, replacement forms and acceptance cases recorded in docs/audits/SIGNUP_FIRM_FLOW_2026-09-23.md.
Review: confirmed duplicate enrollment, conflicting join rules, broken skip, hidden create, search errors/races, nested mobile shell, missing initial workspace selection and nonuniform publishing gates. Audit only; no application changes or live-account tests.


## Professional enrollment audit clarification — 2026-09-24
- [x] Map individual-account posting/upgrade entry points to professional enrollment and identify alternate paths.
- [x] Check duplicate prevention and multi-organization identity/context behavior.
- [x] Correct the signup audit to the founder's Find my firm / Create my firm model and record policy decisions still needed.
Plan check-in: refine the existing audit and produce a concrete route and permission contract before implementation. Preserve individual identity and per-organization membership roles. No production or permission changes during the audit.

Review: corrected the product contract and documented route/callback gaps, duplicate-creation paths, existing-member/second-firm UX and claim/workspace authorization gaps. Source review only. Newly created firm verification policy asked, not assumed; no application or production changes.

## Smart firm enrollment implementation — 2026-09-24
- [x] Consolidate professional setup into one autocomplete with explicit join/create outcomes and duplicate-safe creation.
- [x] Preserve one account, callbacks, initial workspace, existing memberships and add-another-firm entry points.
- [x] Send Folio notification and admin email on join requests; reuse pending requests without repeated notifications.
- [x] Apply creator-confirmed posting and an admin-controlled member posting setting, using the required schema review gate if needed.
- [x] Verify permission boundaries, enrollment routes, autocomplete states and mobile rendering; review and prepare a scoped PR.
Plan check-in: implement the founder's smart-field flow using existing NextAuth, organization membership and messaging infrastructure. New firms require creator confirmation, not external verification. No live signup or emails in testing. Any new schema column will be printed for the repository's required approval before application.

Review in progress: mobile synthetic component walkthrough and focused enrollment, routing, notifications and policy checks pass. Core suite 8 passed/1 disposable-DB skipped. Fixed review findings for actual target-firm authorization, vendor destination, and no-admin pending retries. Awaiting explicit approval for the printed membersCanPublish schema/migration before generation, full validation and shipping. No production mutation, live email or deployment. Preview: docs/reviews/smart-firm-enrollment/mobile-create.png.

Studio story/expertise persistence regressions also pass using real permission helpers: personal/no-membership/admin-disabled denied, approved active MEMBER allowed. Existing publication immutability, source revocation and retry assertions retained.

Approval/merge continuation: founder approved exact migration and merge. Only the approved additive migration applied and recorded; 113 migrations, clean status, all four existing organizations enabled. Prisma format/validate/generate/sync passed. Production compile, full source/script lint (zero errors), core 8/1 skipped, vendor access17, posting policy5, 39 focused scripts and exact-schema guards pass. Final TypeScript display-equivalence verification and remote CI/merge in progress. Automatic Git deployment is disabled; this task authorizes merge, not an extra deployment.

Final review: PR796 prepared and reviewed. TypeScript ratchet passed903/904 with unchanged budget; all seven display-equivalence guard tests passed. Pull-quote, Folio lines, story editing and regeneration contracts pass locally (Git Bash used for Unix-dependent scripts). GitHub Actions jobs did not start: account billing/spending-limit restriction, confirmed in run36012720988 annotations. Remote disposable PostgreSQL checks therefore remain unexecuted. Proceeding with the explicitly approved normal merge using local validation; no protection changes or synthetic passing statuses.

## Professional navigation and account context — 2026-09-24
- [x] Audit navigation, marketing/auth aliases and login-state routing; identify fabricated project intent.
- [x] Preserve explicit versus absent return actions across authentication and legacy routes.
- [x] Show signed-in identity and live operating context; expose join/create another firm without launching project creation.
- [x] Verify logged-out, personal, single/multiple firm, stale access and explicit-action flows; review and prepare PR.
Plan check-in: fix the routing distinction and inconsistent professional links with existing enrollment/workspace infrastructure. No schema or permission expansion. Previous merge approval covered PR796; this correction will be prepared for review.

Review: canonical routing, signed-in redirects, account status and view-only membership behavior verified. Focused routing/auth/enrollment/notification regressions, client import guard, scoped lint, production compile and TypeScript ratchet903/904 pass. Core8 passed/1 disposable-DB skipped. Synthetic desktop/mobile walkthroughs passed; screenshots in docs/reviews/professional-account-routing. Specialist reviews found no blockers. No deployment or live account writes.

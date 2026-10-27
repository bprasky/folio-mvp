# Founding-designer intake and project privacy — 2026-10-26

- [x] Read guidance/audits and compare scoped patches against main f787200d, then integrated ea459003 (#823).
- [x] Restrict includeDrafts to authenticated own-designer reads or current database admins.
- [x] Serialize manual intake saves, autosave and continuation around one acknowledged ID.
- [x] Surface failed autosaves and remove intake controls with no persistence contract.
- [x] Add focused regressions and wire them into the existing core CI job.
- [ ] Pass hosted CI, including the actual manual form at desktop and narrow mobile sizes.
- [ ] Verify the complete signup → public project/profile journey on an isolated database.

Plan check-in: preserve the existing Photos → Rooms → Tags → Story → Publish workflow and completion-year requirement. No schema or publication-policy changes. Prepare a draft PR; assess verification gaps before merge. No deployment or production test content.

### Review

The legacy project listing allowed anonymous includeDrafts=true to bypass the publication filter, exposing private rows and nested photos/tags. Own-designer requests now require authentication and scope to the session; other-designer requests are denied unless the database still records ADMIN. Public listing semantics and admin selection remain intact.

Manual Save draft followed by Create project used to POST a duplicate. A serialized writer retains the confirmed ID for all subsequent writes and rejects failed/malformed responses. Continuation waits for saves and opens the canonical Photos workspace. Autosave includes location/type changes and reports failure. The form remounts across actor/workspace changes to prevent cross-account draft reuse. Unsupported cover/discipline/tags/visibility inputs never reached storage; removed those misleading controls and point photos/tags/publication at their existing workflow stages. No mandatory workflow step was removed.

Local verification: four writer regressions and six actual-handler privacy scenarios pass with synthetic boundaries. The privacy suite fails on unchanged main (anonymous draft request returned 200 instead of 401). Browser-script syntax passes, but execution is blocked locally by unavailable npm dependencies (esbuild); the environment proxy prevents clone/install. The new desktop/mobile form test runs in existing CI with the repository's esbuild/Puppeteer setup.

This is a scoped hardening patch, not complete journey sign-off. Signup, external storage, live interview, publishing studio, real commit durability, complete public profile projection, platform-specific interview branches and full journey navigation have not been reverified. No real invitations, outreach, paid model calls or production writes occurred.


The integrated authorization audit also identifies an unresolved private-photo object-storage policy gate; listing authorization alone does not make public storage URLs private.

---

# Designer interruption recovery — 2026-10-26

- [x] Read guidance, prior rollout/persistence findings and trace active workflows.
- [x] Reproduce interruption failures with isolated browser and route fixtures.
- [x] Harden upload retries/validation, request completion and accurate tagging feedback.
- [x] Run focused regression suites and required guards; record real-service limitations.
- [x] Update rollout evidence and remaining gaps. No deployment, merge or production migration.

Plan check-in: reuse existing synthetic harnesses and inline feedback. Preserve project intake, manual rooms, interview versioning and publication authorization. No live services or communications. Inspect current persistence before changing contracts.

### Review

Implemented local intake recovery and stable project/photo/tag retry identities, atomic opt-in tagging, position conflict checks, bounded workflow requests, accurate failed/pending feedback, tab-local interview recovery and generation lease ownership. Reused mounted toast/inline feedback. The upload batch stops scheduling work after navigation; late completion cannot navigate the user back.

Release follow-up authorized by the owner: rebased onto PRs #823–#825; core now passes 21 tests with two explicit integration skips. Guided, project-guide, interruption and rollout checks pass, including seven interruption browser groups, 26 project-guide scenarios and desktop/mobile manual draft recovery. Removed the unsupported unused route export; prepared TypeScript passes and baseline decreased from 904 to 880. Hosted CI exposed two outdated fixtures, now corrected and passing locally. PR #826 is rerunning CI before merge/deployment. See docs/reviews/designer-interruptions/README.md for integration limits. No production migration.

---

# About page and first-project journey — 2026-10-23

- [x] Review the current About page, approved product positioning and signup/firm/upload routing.
- [x] Add About beside welcome signup and carry explicit first-project intent through professional signup.
- [x] Replace the About manifesto/application dead end with an editorial introduction, practical workflow and direct project entry.
- [x] Verify actual signup callbacks, firm gating, welcome/About navigation and responsive layout; prepare the reviewed follow-up.

Plan check-in: preserve the approved magazine headline. Lead About with publication access for studios of every size, explain the project-informed interview and designer review, and guide the next action to signup, firm setup and project upload. Generic signup/browsing and professional navigation keep their existing destinations; no schema, permissions or provider changes. Merge the already-approved PR #817 once its checks pass.

### Review

The About page now leads with full editorial features, new story ideas beyond project uploads, and Publishing Studio for social assets/sharing. A separate Coming soon section introduces a printed studio magazine for office copies, portfolios and promotion, including projects, team stories and design perspective. The editorial layout reuses approved imagery and canonical typography. Welcome has About beside Sign up, with sign-in/browsing still available.

The About project CTA waits for session resolution and routes existing users through projectEntryHref. Anonymous visitors start signup with designer/project intent or use sign-in with the same firm-setup/project callback. Signup preserves that explicit intent across credentials and provider auth; generic signup, browsing and explicit claim callbacks retain their prior behavior. Removed stale invitation/waitlist language from the auth UI. Existing firm and project authorization remain unchanged.

Verification: 16 actual-component browser cases pass, covering five viewport widths (320–1440px), the signup/new-firm/project destination, sign-in/existing-firm destination, signed-in/loading cases, auth switching, Google/Apple callback routing, role/browsing/explicit callbacks, failed-auth retry and pending firm approval. Professional entry/routing/alias suites pass. Focused lint, client boundary and migration guards pass; TypeScript ratchet passes at 895 diagnostics against 904 baseline. Screenshots inspected; evidence in docs/reviews/about-first-project. Auth/providers/API responses are synthetic and the final project URL is an asserted route boundary; no live accounts or uploads were created. Full application build and production verification were not run.

Release: original PR #817 merged as 272d2382 after nine successful active checks (Supabase Preview skipped). This follow-up is prepared separately on codex/about-first-project for review.

CI follow-up: the existing live-interview browser test tried to restart before React rendered the start control after stop. Wait for the enabled start button before retrying; all 46 live browser/capture checks pass locally with the same synthetic provider boundaries. The founder approved the About design and merge; PR #818 remains gated on hosted checks.

---

# Logged-out signup entry points — 2026-10-23

- [x] Trace welcome dismissal and header account actions to the existing authentication pages.
- [x] Add prominent signup and clear sign-in actions to the welcome and logged-out header; retain guest browsing.
- [x] Verify navigation, keyboard access and narrow-screen layout; review the scoped diff.

Plan check-in: use the existing /auth/signup and /auth/signin routes. Keep dismissal remembered for the visit and preserve the signed-in menu. This directly supports designer onboarding.

### Review

Added primary Sign up and secondary Sign in actions to the welcome and logged-out header, using the existing auth pages. Explore remains available; account actions persist after dismissal. Narrow screens use the existing menu search so both account actions fit. Retained the latest magazine headline and the signed-in menu.

Verification: actual welcome and masthead browser fixture passed at 1440x1000, 390x844, 320x568 and 667x375. Verified all four auth navigations, initial signup focus, Escape/Explore/close dismissal, remembered dismissal and authenticated/loading suppression; inspected mobile screenshots. Focused ESLint passes with two pre-existing UserMenu warnings; client-import and migration-discipline guards pass. Browser fixture uses synthetic auth/destination pages and blocks external requests, so photography, authentication submission and production are not verified. No full application build.

Release: scoped branch codex/logged-out-auth-links; not deployed.

---

# Contextual interview wording — 2026-10-23

- [x] Replace Sofia-specific README wording with a project-informed interview tailored to the designer and their work.
- [x] Align the workflow step and capture the founder's wording preference in lessons.
- [x] Verify the scoped prose diff and update PR #816.

Plan check-in: two README passages plus task/lesson records; preserve universal publication positioning and the existing technical tour.

Review: both README passages now describe Folio reviewing the supplied project material before a tailored interview that develops with the designer's answers. Sofia is no longer named in the README. Reviewed the two prose changes and passed git diff --check; links, commands, technical claims, and runtime code are unchanged. No runtime tests needed for this wording-only correction. Continuing PR #816 without merging.

---

# Publication economics framing — 2026-10-23

Scope: incorporate the founder's correction that Folio addresses the cost and access barriers of design-industry publishing. Lead with universal publication access and designer economics; explain AI interviewing as the mechanism. Keep future influence-based earnings and potential client affordability benefits explicitly aspirational, without promising third-party editorial placement or measured savings.

- [x] Revise the README's problem, value proposition, and future direction; align the engineering tour's introduction.
- [x] Record the positioning correction in lessons and review the wording for unsupported outcome claims.
- [x] Check documentation links and the scoped diff, then update the existing documentation PR.

Plan check-in: the founder clarified that Folio is for studios of every size; smaller studios illustrate the access benefit but do not define the audience. Documentation only, continuing PR #816. No new product, pricing, payout, publishing, or deployment behavior.

### Review

Updated the README to lead with “Good design deserves to be published.” The problem statement now covers editorial production, PR/publication access, and the pressure those costs place on project margins. Universal applicability is explicit; studio size and media budget do not define the audience. A separate future-vision section describes intended margin/client-affordability benefits and earnings from completed projects’ influence without claiming measured savings, third-party placement, or currently delivered payouts. Aligned the engineering introduction and recorded both founder corrections in lessons.

Verification: reviewed the four-file prose diff, checked all 38 relative links/anchors in the revised README and tour, and passed git diff --check. Runtime code and commands are unchanged; the previous core/guided suite results remain the relevant implementation evidence. Continuing the same PR #816; no merge or deployment.

---
# Repository presentation for AI builder application — 2026-10-23

Scope: make Folio understandable to an external reviewer through a product-first README, a source-linked AI engineering tour, and accurate development instructions. Documentation only; retain existing product behavior and the repository's private visibility.

- [x] Inspect repository presentation, latest main, core AI implementation, CI, and current development instructions.
- [x] Rewrite the README around the problem, product workflow, implementation evidence, and an authentic existing preview.
- [x] Add a concise AI engineering tour and development guide; verify commands and relative links against the source.
- [x] Check tracked files for obvious credentials and document the limits of that check.
- [x] Review the scoped diff, record verification, and prepare a documentation PR.

Plan check-in: the application targets builders who use AI. Lead with demonstrated product and engineering choices; do not claim unverified traction, authorship detail, performance, or complete test coverage. Work from origin/main in an isolated worktree so existing uncommitted work stays intact.

### Review

Replaced the minimal README with a product introduction, an existing synthetic UI preview, workflow, source-linked engineering highlights, stack, verified local checks, and an honest development-status note. Added an AI engineering tour and a development guide matching the npm lockfile and current CI. Reviewed source links, state/persistence claims, optional service requirements, and the screenshot's fixture context. No runtime, dependency, schema, or feature-flag changes.

Validation in a fresh worktree at origin/main 06e52199 on Node 22.17.0: npm ci; Prisma Client 6.18.0 generation; test:core (10 pass, 0 fail, 1 explicitly skipped live-database group); test:guided (all four scripts passed); client-import boundary guard; migration-discipline CI check; 45 relative documentation links and named npm scripts; git diff --check. A configured application startup, full build, live model evaluation, production/database writes, and historical secret scanning were not performed.

Sharing finding: the tracked legacy src/DATABASE_SETUP.md contained an apparent non-placeholder Supabase database password. Its validity was not tested and the value was not printed. The old guide was replaced by links to the current development and migration instructions, removing the value from this branch's current files. A literal-match search found the same value only in that tracked file on origin/main. Git history still contains it: confirm revocation or rotate it before granting new access. The targeted scan covered common API-token/private-key patterns and credential-bearing PostgreSQL URLs in current tracked text, not every secret format or the repository history. The GitHub repository remains private; reviewer access must be arranged separately.

Release: prepared PR #816. Rebased onto the concurrent welcome-copy change 0df0c322; both task records are preserved. That update changes marketing copy and does not alter the documented interview, setup, or regression paths.

---

# Magazine welcome promise — 2026-10-23

Scope: lead the logged-out homepage modal with the founder-approved headline, “Folio is your studio’s magazine.” Explain how the work and the thinking behind it come together in a publication of the designer's own. This makes the interview's value clear to prospective designers.

- [x] Confirm the intended wording and inspect the current modal on latest main.
- [x] Update the headline and supporting copy while retaining the current photograph, Explore Folio dismissal and existing modal behavior.
- [x] Check real-component desktop/mobile/landscape layout, keyboard dismissal and focused lint; review the scoped diff.
- [x] Prepare the scoped change for commit and PR review, recording verification and release status.

Plan check-in: the founder approved the more editorial “Folio is your studio’s magazine.” and its three-sentence description, superseding the earlier “magazine of YOU” wording. Apply the exact copy, recheck layout and dismissal, and merge PR #815 under the founder's explicit approval. Physical print editions are separate work.

Review: headline and description only; the photograph, CSS, CTA, authentication, telemetry and session dismissal logic are unchanged. Supporting copy: “Your projects tell people what you create. The stories behind them reveal how you think. Folio brings both together in a publication of your own.”

Verification: focused ESLint and whitespace checks pass. Actual component/CSS/Radix/Next Image browser fixture passed at 1440×1000, 390×844, 320×568 and 667×375, with the existing photograph and loaded Cormorant Garamond/Instrument Sans fonts. Screenshots were inspected. Escape, remembered session dismissal, Explore dismissal and authenticated/loading suppression pass without browser exceptions. The fixture supplies synthetic auth and bypasses Next image optimization; it does not verify the integrated homepage or production. A full application build was not run for this copy-only change. Scoped diff review found no blockers.

Release: PR #815 on codex/magazine-welcome. The founder explicitly authorized the revised wording and merge; merge and deployment status are recorded in the PR.

---

# Welcome promise wording — 2026-09-29

- [x] Apply the founder-approved description naming expertise, editorial features, social posts and designer control.
- [x] Keep the current photograph pending permission to use another image.
- [x] Check desktop, mobile and landscape text fit in the existing Next.js fixture.

Review: description-only change; image, styles and Explore dismissal are unchanged. Browser layout checks passed at 1440×1000, 390×844, 320×568 and 667×375; whitespace check passed. Signup guidance remains a product discussion, with no routing changes in this patch. No deployment.

---

# Single-screen editorial welcome — 2026-09-29

Scope: replace the logged-out homepage's three-video tour with one interior photograph and the promise “Folio. Your new publishing team.” Explore Folio dismisses into the existing page. Preserve per-session dismissal, hide during authentication/loading, and provide keyboard/focus/mobile support. No deployment or publishing-flow changes.

- [x] Inspect the current modal, repository guidance, shared primitives and existing photography.
- [x] Implement the static photographic welcome and truthful single-screen telemetry.
- [x] Verify desktop/mobile presentation, dismissal, keyboard access, authentication and storage failure.
- [x] Review and commit the scoped change on a branch for review.

Plan check-in: reuse existing Folio login photography and the already-installed Radix dialog primitive. Keep instructional content out of the welcome; existing marketing-page videos remain available.

Review: replaced the tour with one still interior, canonical Folio typography, the publishing-team promise and an Explore dismissal. Reused the installed Radix dialog for focus trapping, Escape, backdrop dismissal and scroll locking. Existing session key is retained; blocked storage has an in-memory fallback. Telemetry reports frame 1 for the new CTA.

Verification: seven browser checks passed against the actual component in a local Next.js fixture, using real brand CSS/fonts and the existing photograph served locally. Desktop (1440×1000), mobile (390×844 and 320×568) and landscape (667×375) were checked; focus restoration, auth/loading, remembered dismissal, blocked storage and failed imagery passed. Focused ESLint, strict fixture TypeScript and whitespace checks passed. The fixture mocks session state and image delivery; full application compile/typecheck:prepare/typecheck and integrated homepage verification were not run because this workspace only contains the scoped repository files. No baseline, deployment or production settings changed. Prepared on codex/editorial-welcome-modal for draft PR review.

---

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

# Live interviews, private recording, and media outputs — 2026-10-01

Scope: implement the supplied live interview specification across actual Folio interview entry points, retaining authoritative editorial services. Branch `codex/live-interviews-media` starts at current main; unrelated local edits remain untouched. No production migration, deployment, flag activation, or merge is authorized.

- [x] Audit canonical interview types, source authorization, provider contracts, capture storage, and publishing/export machinery.
- [x] A: Implement default-off authenticated live sessions, per-session Tavus configuration, durable receipts, guided-engine answer ingestion, and existing-workspace call UI.
- [x] B: Implement explicit recording consent, bounded private uploads, ordered recorder runs, playable validation, and source review.
- [x] C: Wire shared adapters into every implemented interview type with its own gates and persistence.
- [x] D: Implement versioned source edit plans, durable FFmpeg rendering, actual preview files, exact-version approval and publication/export checks in Studio.
- [x] Verify targeted security/turn/recording/media/cross-type tests, existing guided/core/browser checks, type ratchet, lint and import/migration guards.
- [x] Review diff, commit coherent changes, push and prepare PR; document precise setup and mocked/local/live evidence.

Verification plan: provider boundaries mocked unless a bounded live test is explicitly available; synthetic recordings rendered with real FFmpeg; external database state inspected read-only. Any schema proposal is additive and remains unapplied to production. Before schema edits create a backup; if format/validate/generate/migrate-status fails, restore from backup and stop schema work. Migration application is a separate approval gate.

Review: draft PR #805 contains seven real entry integrations, canonical speech ingestion and recovery, private creator capture, Studio review/publication and native FFmpeg outputs. Transport19, browser17, native media2, composed project/bio2, adapter seven-kind, guided, core10/1 skipped and existing recorded-media33 checks passed. Guided browsers16+16, lint/import/migration guards, approved Prisma format/validate/generate/verify and type ratchet903/904 passed. IDOR retains the identical existing nine Critical findings. Rebased onto main0127d3a4; unrelated local work preserved. User approved only branch schema alignment; read-only migration status shows the one expected unapplied migration. No production changes or real paid call. Missing Tavus/origin/allowlist configuration, bucket MIME expansion, migration application, worker deployment and bounded real device/provider smoke test remain rollout gates. Precise evidence/exclusions: docs/reviews/live-interviews/results.md. Setup: docs/LIVE_INTERVIEWS.md and docs/LIVE_INTERVIEW_MEDIA_WORKER.md.

## Live interview release — 2026-10-01

User approved merging and proceeding after adding the Tavus key to Production. Release plan: repair hosted CI, merge the verified revision, release the committed web application, and verify production readiness. Preserve the separate migration review gate and keep unavailable recording/worker capabilities disabled.

- [x] Inspect hosted failures; repair older component fixtures and pin the approved schema in the exact-scope guard without weakening assertions.
- [x] Verify all 36 Publishing Studio scripts and schema scope/negative tests locally.
- [x] Fix and browser-test the production CSP; verify missing-schema rollout and flags-off archive reads.
- [x] Obtain separate SQL approval, verify production identity and apply the exact reviewed migration with the repository guard.
- [x] Verify hosted CI and merge PR #805.
- [x] Deploy the merged revision and verify the public homepage and private-route authentication boundaries.
- [x] Complete or explicitly report remaining migration, account allowlist, bucket, persistent worker and real device/provider acceptance requirements.

Release review: PR805 merged as b3d570c6 after all ten required hosted checks passed (Supabase Preview skipped). Deployment dpl_4n7cyKPaUe8uUpuQPGdCF5q67XDj was built from the identical committed file tree and promoted to folioad.com. Public homepage200 and all three live/media authentication probes401; corrected CSP confirmed publicly. All114 migrations current; production postflight12/12 passed. Private bucket audio/video MIME expansion succeeded; requested512MiB rejected by project maximum, so existing20MiB limit preserved. Worker native/storage checks pass but OPENAI_API_KEY is absent. Live/recording/export flags remain off pending account allowlist, persistent worker and minute-based cleanup hosting, transcription credentials, storage capacity and real provider/device acceptance. No paid call. Awaiting founder's account email and worker host details; merge, deployment and approved SQL application are complete.

## Activate live project interview — 2026-10-01

The founder supplied javier@phase3.us to enable the first live test from the existing guided workspace. Plan: verify exact account/source access, schedule authenticated bounded session cleanup on the existing Vercel Pro project, then enable only live interviewing for that account and verify the actual visible entry. Recording and exports stay off; their worker/ASR/storage requirements are separate. Branch codex/live-interview-activation starts from merged main b3d570c6; unrelated local edits remain preserved.

- [x] Verify approved account and project access for the supplied email.
- [x] Add and test fail-closed scheduled cleanup, including flags-off reconciliation and bounded work.
- [ ] Configure the account allowlist/live switch and cleanup secret; review, merge and deploy the activation change.
- [ ] Verify production scheduling, authorization, visible live entry and report real-device test limits.

Activation review: exact account APPROVED/DESIGNER and screenshot project ownership/write access confirmed read-only. Production CRON_SECRET, account-ID FOLIO_LIVE_ALLOWLIST and FOLIO_LIVE_INTERVIEWS=1 saved; recording/export flags remain absent/off. Cleanup regression (including reproduced/fixed overlapping termination race), transport19, seven-kind adapters, browser17, lint, import/migration guards and type ratchet903/904 pass. Reviewer reports no remaining blockers. Browser awaits account sign-in; merge/deployment, registered schedule and real-device/provider behavior are not yet verified.

## Live-first interview correction — 2026-10-01
User corrected the in-progress activation: Tavus is the prominent default and Type instead keeps the same avatar speaking while the designer types. Hold promotion of activation-only build and extend PR806. Plan: keep photo navigation, reuse one Tavus conversation and Folio canonical engine, add explicit typed receipts through documented conversation.respond, preserve draft/review controls and microphone consent. Recording remains off.
- [x] Make enabled project interview live-first with full-width avatar and secondary keyboard mode.
- [x] Support microphone-free typed starts and same-call switching with durable typed receipts and single canonical save.
- [x] Verify auth, retries/stale answers, voice/text switching, draft restoration and desktop/mobile presentation.
- [ ] Review final scope, update PR806, merge/redeploy and verify actual signed-in production UI.

Live-first review:30 transport checks, seven-kind adapter/provenance checks,26 actual-panel browser/capture checks,20 guided workspace and16 entry browser checks passed. Browser fixtures use synthetic provider/recording data; actual Tavus audiovisual quality is still unverified. Reviewed actor/source draft isolation, frozen question attribution, pending/late-save recovery, speech echo boundaries, capture-stop failure and stable mounting. Lint passes with existing warnings; hosted CI now includes actual live and guided browser suites. Production build from activation-only commit is held; release uses final revised UI.

Release checkpoint: PR806 merged as 6f24c2f5 after all nine active CI checks passed (Supabase Preview skipped). Identical-tree final build dpl_961vnsHH9pkqvigjzMzJHhmSERWf promoted. Signed-in entry and input selection verified, authenticated cleanup200 and unauthenticated401 verified, natural minutely executions200 observed. The founder subsequently reported actual live startup failing and rejected the second Start step; real provider acceptance remains unmet.

## Direct interview entry and startup repair — 2026-10-01
Plan check-in: the original Start/Resume click starts the live greeting. Diagnose the actual production failure, remove the duplicate start step while preserving passive/review behavior and typing, then verify the real path and release the correction. Conversation-led Create+ uploads are the product direction; this repair first establishes the working interview entry. No schema change or recording activation.
- [x] Identify the failing browser/provider startup boundary using production evidence.
- [x] Carry explicit entry intent into one live startup with clear connecting/error recovery and typed input.
- [x] Add targeted regressions for entry, failure and duplicate prevention; verify actual provider readiness.
- [ ] Review, commit, push, merge and deploy the repair; document precisely what was observed.

Diagnosis: production live-start requests returned503 because Prisma could not deserialize PostgreSQL void from SELECT pg_advisory_xact_lock. Actual Prisma against the configured database reproduced P2010 and verified the execute-only replacement, transaction-held lock and release. Probe transactions were read-only, with zero application rows changed and zero provider calls. Read-only Tavus configured-face lookup returned200/completed. New real-Prisma reservation tests cover the boundary missed by the previous PGlite wrapper.

Source verification:33 live panel browser checks and17 composed entry regressions pass with synthetic provider/device boundaries. Actual Start/Resume handoff, passive review/refresh, microphone-denied typed fallback, pending-mic typing, once-only entry, cancelled late join and retry identity are covered. Full/scoped lint and client/migration guards pass. Hosted real-Prisma concurrency, final build and actual Tavus connection remain release verification steps.

## Tavus as project guide — 2026-10-02

Plan: make Tavus present on Create+, upload/tagging and interview progress. Use saved readiness and stage-aware greetings, preserve typed and stepped-workspace options, and keep setup guidance separate from editorial evidence. Podcast conversation follows useful stories before returning to the prepared outline; detect when earlier answers already cover later topics.

- [x] Audit entry points, readiness data, provider turns, feature gates and latency boundaries.
- [x] Implement new/partial/completed guidance and safe canonical begin/resume/restart/detail transitions.
- [x] Embed the host beside working URL/file inputs on Create+ and project surfaces.
- [x] Verify ownership, stale context, retries, guide/editorial separation, exact evidence and voice/text confirmations through local integration and browser tests.
- [x] Pass final actual-model calibration, independent scenarios and complete project conversations including designer reflection.
- [ ] Complete review, scoped commit/push and PR; run hosted CI including real Prisma reservation races.

Review checkpoint: local mechanics, lint, client/migration guards, production compile and TypeScript ratchet pass. Browser/model data is synthetic; no fabricated answers or destructive resets touch the founder's project. Current production remains PR807. Recording/media rollout is separate.

Quality re-plan: actual-model tests exposed broad repetition, coverage priming and unsupported causal bridges. Independent raw-answer coverage and separate factual/conversation audits address those responsibilities without adding another serial stage. Selection is four normal/seven maximum requests per invocation, with one repair. Failed trials remain in docs/reviews/project-guide; no isolated pass supersedes a later failure.

Disabled, low and medium Sonnet factual-review experiments still inferred unsupported causality or rejected ordinary questions. Offline SDK/wire parity ruled out integration differences. A fixed-input comparison justified a separate Opus grounding class, preserving Sonnet generation/coverage/conversation review. The direct joint calibration remains honestly 7/8 because of an intermittent neutral-question false rejection; all unsupported-assertion controls passed. Evaluate that false rejection through the real bounded repair path rather than treating one checker verdict as the whole conversation. No canned-question or regex workaround.

Five actual selection scenarios passed on the narrowed reviewer context. Full sequences then exposed two application/grammar issues: an allowed advance rationale was rejected by the strict local shape, and repair confused a covered target ID with the meaning of a new consequence question. Accept only the optional advance rationale and project it to a clean state action; preserve useful follow-up wording when repairing a target/action mismatch, with all coverage/evidence guards intact. Re-run the independent scenarios and complete project conversations after those scoped fixes. Repeated consent exchanges remain an explicit pacing concern, not proof of podcast polish.

Final evidence and cost/wall-time comparison will be recorded in docs/reviews/project-guide/results.md. Summed provider durations are not response latency; actual Tavus voice delivery remains a separate acceptance boundary.

Full-dialogue review after provider-enum repair found three consecutive reuse confirmations before an untouched reflection topic. Preserve that trial as a pacing failure. Prioritize unanswered topics before administrative reuse and keep spatial follow-ups about lived experience. The sequence fixture also repeated its authored application answer to a different question; record that limitation explicitly rather than claiming the host elicited another useful quote.

Final calibration correction: distinguish ordinary invitations to describe unspecified goals ("none" is a valid answer) from embedded specific unsupported premises. The unchanged eight-case joint calibration passes, including all negative controls. Final independent scenarios pass manual review with minor wording limitations retained; complete final-source sequences and hosted CI are the remaining checks. Source and provenance policies were not weakened to obtain a pass.

Final-source model review: independent5/5, joint calibration8/8, unchanged raw coverage3/3 and two complete six-turn sequences pass. Both sequences accept the actual fictional designer-reflection reply and complete the project phase; source hashes match all frozen production model modules. Minor scope-menu/generic wording and explicit reuse pacing remain documented. Final sequence turns3.977–9.279s before Tavus; an earlier repaired turn26.008s warns against a speed claim. Cost, historical failures and full transcripts are preserved in docs/reviews/project-guide. Full guided regressions and scoped lint pass after the schema changes; final type ratchet903/904. Commit/PR and hosted DB/CI checks follow.

## Live interview reset repair — 2026-10-02

The founder reported repeated confirmations, navigation and failure to clear answers in the deployed live host. Plan: reproduce the composed live/Story flow, make one stable confirmation own the reset through success or recoverable error, preserve idempotent retries and verify restart from saved state. No destructive tests on the founder's project and no schema changes.

- [x] Reproduce the deployed reset path and identify the failing boundary.
- [x] Repair confirmation, pending/error state and fresh-session transition with minimal scope.
- [x] Verify composed browser regressions and reset persistence/authorization checks.
- [ ] Review, commit, push, merge and deploy the repair; verify the deployed revision.

Scope correction from the founder's screenshot: the host is stacked above the full old project page, with duplicate headings/navigation and restart below the fold. Replace that composition with one focused interview workspace and keep saved-answer/restart controls beside the host. Preserve the stepped fallback. Investigate the screenshot's failed startup after reset before release and verify actual page-shell layout at desktop/mobile sizes.

Review: production recorded two successful resets three seconds apart and subsequent zero-answer reads. The remaining call had status ending with provider cleanup already complete. Reproduced the late-start resurrection in the actual transport service, and navigation/unstable confirmation through the composed host. One host-owned dialog now waits for acknowledgement, preserves uncertain receipts, refreshes rejected stale receipts and removes the ended-call cache before fresh entry. Completed cleanup is terminal and repairs historical stuck reservations. Story renders one project header and photo/host workspace, with review disclosure, nearby restart, photo thumbnails and the explicit stepped fallback; project routes use the small Folio wordmark. Unrecorded guide calls no longer show recording-recovery controls, and duplicate notices are suppressed.

Verification: 18 composed guide browser checks, 33 live browser/capture checks, 17 guided/legacy entry checks, 39 transport checks, reset service/atomicity tests, cleanup concurrency, scoped lint and client/migration guards pass. Desktop/mobile screenshots inspected; all browser/provider/database test boundaries are synthetic. TypeScript ratchet passes at904/904. No designer answers were created or reset by testing. Hosted checks and deployed cleanup recovery remain the release gate.

## Guided setup, media recording and retry — 2026-10-02

The founder wants uploads only in the opening guided setup, a recording-ready media opportunity with preparation/consent, and a working retry. Trace setup → live reservation → consented capture → private media before claiming success. Preserve automatic host presence, canonical answers, typed input and the stepped fallback. No schema changes or destructive production tests.

- [x] Establish daily/concurrent limit cause and recording infrastructure readiness from read-only evidence.
- [x] Keep upload controls in Photos & details; route spoken upload requests there and keep Interview focused.
- [x] Add truthful media preparation and explicit in-call recording consent, using the existing private capture/media pipeline.
- [x] Repair quota accounting/retry feedback and verify real store, transport and composed UI boundaries.
- [ ] Review scoped changes, commit/push and finish the authorized release with infrastructure limitations stated precisely.

Design: the host greets on arrival without a second start button. Recording begins only after the designer explicitly chooses and consents; camera/voice controls and private/publication status must reflect actual capture. Upload guidance and editorial evidence stay separate. Never present an identical retry as a solution to an unchanged daily quota.

Review: 41 transport, 35 live browser/capture, 19 composed guide browser, 15 guide adapter, planner/seven-kind adapter and native media/SQL checks pass. TypeScript remains904/904; scoped lint has existing warnings only; client and migration guards pass. Desktop/mobile inspected. The pilot hit exactly five ended provider conversations, the previous default daily cap. New default20 plus separate reset-time/capacity errors repair that limit UX. Recording is consented in-call with stable project media identity and private camera preview; upload actions navigate to setup and leave Story clean.

Remaining production dependency: private storage accepts all capture formats but its20MiB object cap needs expansion for normalized files. Production recording/export flags and an OpenAI transcription key are absent; persistent worker hosting is not established. Asked the founder which background host is available. Keep capture flags off until infrastructure acceptance; release the setup/retry repair without claiming recorded media is active. See docs/reviews/interview-media-setup.md.

## Tavus inside the guided steps — 2026-10-02

PR810 is merged; its build is held for this correction before promotion. Preserve the existing adaptive tracker, active step tools and publish gates. One persistent host accompanies the actual workflow rather than creating a second one. No schema changes or real designer test answers.

- [x] Restore one existing project stepper and active-step surface inside the host layout; keep the original workspace available without Tavus.
- [x] Pass the viewed step to guidance without reconnecting; keep uploads in Photos and editorial answers in Story.
- [x] Verify navigation, saved progress, single-call continuity, reset, fallback, responsive layout and current-step greetings.
- [ ] Review, commit/push, pass hosted checks and finish the authorized merge/deployment. Recording remains dependent on storage/worker/transcription readiness.

Review: the same project call survives all five step transitions. Guide history and saved project facts follow the active step; unchanged refreshes do not repeat a greeting. Create-to-project handoff carries only authorized same-workspace guide history. Back to setup finalizes a recording while keeping the host and canonical answers. Local20 composed browser,35 live/capture,42 transport,16 adapter and planner/seven-kind/upload checks pass; type ratchet903/904, scoped lint and import/migration guards pass. Mobile step navigation and desktop layout inspected with synthetic step bodies. No real designer test answers, resets or paid calls. See docs/reviews/tavus-guided-steps.md.

## Interview call presentation — 2026-10-02

Preserve the guided workflow and live behavior. Rebalance the interview to approximately55/45 with aligned photograph/host stages, an integrated call toolbar, one caption surface and event-backed activity states. Keep the provider frame uncropped and camera preview tied to explicit capture consent. No backend, schema or activation changes.

- [x] Refine stage proportions and the active/inactive call presentation while retaining accessible controls and all recovery paths.
- [x] Verify live controls, captions, step continuity and responsive screenshots with synthetic provider/device boundaries.
- [ ] Review, commit/push and finish the authorized release after hosted checks; document visual and production verification limits.

Review: Story uses approximately55/45 photography/host columns with aligned stage heights; the host retains the full video frame. Primary calls have one icon control dock, consented camera picture-in-picture, in-frame audio recovery and a single bounded caption surface. Real provider speaking events drive activity, and new canonical questions clear stale captions. Setup retains its guided steps and the same mounted call. Local36 live/capture checks and20 composed guide browser checks pass, including320–1920px overflow/touch sizing, stage geometry, caption toggle, microphone controls, mismatched-conversation rejection and step continuity. Desktop/mobile screenshots inspected. Scoped lint has only existing warnings; client/migration guards pass; TypeScript903/904. All device/provider/API tests are synthetic; no paid live session or designer answers were created. Hosted checks and production release remain pending.
# Simplify project setup — 2026-10-05

The walkthrough exposed unnecessary transition screens and an intrusive live host during uploads/tagging. Keep the short create form, useful review steps, saved data and Story interview; remove setup ceremony. No schema or provider changes.

- [x] Remove Tavus from the short create/upload form and all non-Story project steps; end the call when leaving Story.
- [x] Route successful initial photo uploads directly into room organization.
- [x] Replace the duplicate completed-project wizard with the shared upload control and canonical Rooms workspace. Remove its Specs/Done stops and interview launcher; specs remain optional in tagging.
- [x] Verify upload/import failure recovery, direct navigation, Story entry/exit and responsive layout with the existing browser harness; run focused lint, types and guards.
- [x] Review the scoped diff and prepare the verified change for commit/push and draft PR review.

Design review: the old wizard only saved room labels while the canonical tracker requires room IDs. Reusing the existing workspace removes that duplicate flow without changing database or publishing gates. Historical session restoration now updates progress without replaying old navigation commands.

Verification: 21 composed guide browser checks, 7 setup browser checks, 36 live browser/capture checks, 42 transport checks, source adapters and upload authorization pass. Desktop and 320/390px screenshots inspected; shared file chooser overflow fixed. Full/focused lint (existing warnings), client-import and migration guards pass. TypeScript compared with identical dependencies/route declarations: main 903, changed 903, no added diagnostics. The standard ratchet's worktree path/type-display differences also occur on main; its committed baseline is unchanged. All browser/provider/API data was synthetic; no paid call or designer data was used. Canonical room persistence was reused, not rewritten or exercised against production.

## Completed-project entry and factual setup review — 2026-10-05

Focus initial designer intake on completed archives. Hide Concept/In progress choices but preserve their existing models and workspaces for later feature review. Review the factual fields before replacing the advanced form; avoid inventing required data or collecting fields that are discarded.

- [x] Audit creation entrypoints and trace displayed fields through persistence and downstream use.
- [x] Remove stage choices from the three main designer intake forms and persist PAST explicitly, including fallback forms.
- [x] Save completion year and optional month through creation/editing, expose it on project cards and add completion-date sorting. Keep unknown months null; validate future/invalid dates. Existing columns require no migration.
- [x] Verify direct and fallback creation payloads, navigation and existing upload recovery; review and prepare the scoped changes for the existing draft PR.
- [x] Document the recommended single-page factual intake, with deferred questions and data gaps identified, in docs/reviews/completed-project-intake.md.

Review: completed-only intake preserves the unfinished concept/in-progress models for later review. Completion date is required in the new intake UI and optional for existing API callers; year-only dates remain truthful in persistence, cards and sorting. Private Folio draft status remains distinct from completion of the underlying design project. The wider one-page form replacement is a product review specification, not an implemented redesign; scope/country need storage decisions, and separate sourcing modals need review before applying an app-wide creation restriction.

Verification: 26 composed guide browser checks and 14 completion normalization/API/authorization/query/sort checks pass. The browser suite covers all three intake forms, year-only/month-year payloads, missing-year protection, draft edits, upload recovery and real project-list sorting. Desktop/mobile screenshots inspected. Dated cards suppress the legacy Concept phase label; undated cards retain their existing phase. Prisma client parity and read-only database column/migration audit pass; no schema changes or database writes. Full/focused lint (existing warnings), client-import and migration guards pass. TypeScript compared against main with identical dependencies/route declarations: 903 each, no new diagnostics. Browser/provider/auth/API boundaries are synthetic. Broader factual-page replacement and production deployment remain outside this reviewed increment.

## Remove AI photo room detection — 2026-10-05

The founder rejected automatic photo room detection as slow and insufficiently specific. Stop automatic calls and inferred room suggestions, retaining explicit room naming/assignment and product tagging. Preserve saved rooms/photos/tags and background search indexing; no schema or production data changes.

- [x] Remove upload/import/board auto-detection triggers and the analysis waiting screen; use the manual room workspace immediately.
- [x] Remove AI-prefilled room choices; retire both room-detection endpoints so old tabs cannot run them.
- [x] Verify no detection request on uploads/board visits and manual create/assign/exclude/rename; review and prepare the changes for the existing draft PR.

Review: both retired endpoints return 410 without importing model, auth or database services. Manual room controls retain saved assignments, create/name rooms, assign photos, rename rooms, exclude and restore photos. Product tagging and explicitly reviewed document extraction are untouched. Background search indexing remains independent of room sorting. No schema or production-data changes; existing AI-created rooms are preserved.

Verification: six focused manual-room/retired-route checks and seven upload/recovery browser checks pass against actual components with synthetic action/API boundaries. Both retired handlers execute with only NextResponse mocked. The upload check covers the real MediaSection and ProjectCreationModal completion path. Desktop/mobile screenshots inspected. Full/scoped lint passes with existing warnings; client-import and migration guards pass; same-environment TypeScript comparison remains 903 on main and 903 here with no added diagnostics. Code and database-boundary reviews found no blockers. Not deployed.

## Recover Tavus after waiting/disconnect — 2026-10-05

- [x] Inspect client/provider/session evidence for the reported pause followed by nonfunctional reconnect; distinguish quota from stale/ended provider state.
- [x] Reproduce the failure with synthetic provider/browser boundaries and implement the smallest recovery fix without losing saved answers or duplicating uncertain provider calls.
- [x] Verify disconnect/retry, capacity/quota feedback and existing live flows; review and prepare the scoped commit/push. State any production-verification limits.

Review: provider-ended conversations can outlive an active Folio reservation. Reconnect now verifies the provider before reusing credentials and reconciles confirmed shutdown. Unexpected participant departure or meeting exit closes the browser call and offers explicit Resume; delayed events from old calls cannot end a replacement. A deliberate Resume may replace one confirmed-ended call in the same click, while unknown results and retained answers preserve their request identity. No automatic paid reconnect or quota changes.

Interrupted voice now becomes explicitly reviewable on shutdown/expiry, like typed answers; active saves keep their lease and can finish once. New receipts preserve interview-phase evidence. Historical receipts recover phase only from stored prepared speech, never by inventing a heard question or using unrelated current state. Missing phase evidence remains guarded.

Verification: 52 service/transport checks, 46 actual-panel browser/capture checks and scheduled-cleanup checks pass. Old-code probes reproduce failed disconnect cleanup and unusable confirmed-ended retry. Coverage includes delayed join/HTTP responses, reuse of the same session/request, unfinished speech, active/expired save leases and legacy guide/interview separation. Code review found no remaining blockers. Scoped/full lint passes with existing warnings; client-import and migration guards pass. Same-environment TypeScript comparison is 903 diagnostics on main and here, with no new fingerprints; the final live files have no diagnostics. Six manual-room checks pass with the reload-stable upload fixture included.

Production incident attribution remains unverified: Vercel runtime/deployment read access returned 403, and cached production database credentials failed authentication. No incident records were read, no production state changed and no paid provider calls were made. The local diagnostics entrypoint is missing from this checkout; targeted transport/browser regressions provided verification. Changes remain in draft PR 814; not deployed.

## Designer rollout authorization audit — 2026-10-26

- [x] Map actual roles, sharing, publication, storage, public projections and prior findings.
- [x] Reproduce direct-handler failures with isolated designers, anonymous, participants, firm roles and admin.
- [x] Fix confirmed authorization, validation and integrity failures using existing helpers; preserve public/share paths.
- [x] Run focused regressions, core/persistence suites, type preparation/ratchet and repository guards.
- [x] Record evidence and remaining storage/database/HTTP limitations. No production access, migrations, merge or deployment.

Review: confirmed nested-room destructive IDOR, viewer mutations, project-delete alias bypass, private tag/User/interview leakage, unsafe storage deletion and external image fetching. Fixed with existing authorization/schema/transport patterns and atomic writes. Tests include two designers, anonymous, participants, firm roles, admin and vendors; actual PostgreSQL rollback/concurrent retry checks pass. See `docs/audits/DESIGNER_AUTHORIZATION_2026-10-26.md` for results and the unresolved private-photo storage policy gate. Local only; no production access, migrations, merge or deployment.

## Founding-designer rollout hardening — 2026-10-26

- [x] Reconcile merged 1020fef5 / PR826 and responsive f000a0da; isolate codex/rollout-hardening and preserve other worktrees.
- [x] Implement private photo/crop transport, atomic creation and credits, project/room identities, tag/Selection consistency, canonical page permissions, readiness and essential feedback.
- [x] Integrate responsive fixes; prepare large original photos within the existing transport cap.
- [x] Execute exact native PostgreSQL groups, independent worker/lease races, actual HTTP image bytes, Chrome image-quality and authenticated Next/session/database journey.
- [x] Finish final combined validation/evidence and operational storage procedure; prepare the reviewed branch for PR publication. Do not merge or deploy.

Review: 37 required core checks, 8 independent-process concurrency checks and 8 byte-storage checks pass without skips. Final committed desktop/mobile Next/session/database journeys each pass 12 groups. Prepared TypeScript ratchet passes at 867/880; lint, client, DB and migration-discipline guards pass. No schema change or baseline update. New uploads require a separately provisioned private project-photos bucket; legacy public objects need reviewed copying/reference migration and retirement before rollout. Synthetic AI and storage-policy boundaries remain explicit. See docs/reviews/rollout-final-gap-audit/README.md for evidence, remaining gates and Brad's smoke.

## Authorized PR827 release — 2026-10-27

- [x] Inspect current main, PR checks/reviews, production target and required storage configuration.
- [x] Repair the hosted focus-test timing failure without weakening assertions; rerun all responsive interactions.
- [x] Provision the separate private photo bucket; verify and remove a synthetic hosted byte canary.
- [ ] Wait for updated hosted checks, merge the reviewed SHA, deploy that exact merged commit and verify production domain/anonymous boundaries.

Release preflight is recorded in docs/reviews/rollout-final-gap-audit/evidence/release-preflight.md. Runtime source is unchanged; legacy image retirement and signed-in/device rollout smoke remain separately scoped.

# First-time designer journey — November 5, 2026

## Scope and baseline

Journey: sign up → verify email → join/create a firm → import a website → review the private profile → open a project → organize photos/materials → interview → leave/resume → prepare a draft.

Baseline: `4675da22`, matching the READY production deployment `dpl_4bj8LoqDwyaLgshQTG85kMeV7J1V`. Work is isolated on `codex/designer-journey-loose-ends`. The original checkout and its unfinished work are preserved.

The live walkthrough initially used the signed-in designer account and BP Design workspace with founder authorization. The founder then redirected the live test to **IG Workshop**, whose website/upload were already tested; tagging and interview are the remaining intended live stages. IG Workshop is absent from the current account's firm switcher. Browser control subsequently stopped because it could not reliably verify the existing Chrome window's URL. No IG Workshop account, project or answer was changed. Stateful automated checks use synthetic authentication/providers and disposable or in-memory persistence. They do not prove real email or Tavus delivery.

## Priority fixes

| Priority | Finding and evidence | Resolution / acceptance |
| --- | --- | --- |
| P0 — open operational blocker | **Real interview startup fails before reaching Tavus.** A fresh private QA project reached Story, then displayed “Connection paused — Please wait before starting again.” Production log at `2026-11-05T22:30:12.947Z`, request `kw5g2-1793917812790-61639feec549`, reports `[rate-limit] {"outcome":"backend_outage"}` on `POST /api/live-interviews`. | Restore the production rate-limit service and verify the real IG Workshop interview. Production URL/token variable names are present, but sensitive values are not readable through the connector; the specific credential/network/provider cause remains undetermined. Keep protection enabled. |
| P1 | **Infrastructure denial is presented as a user quota.** The live service collapses every denied rate-limit result into the same 429 message. | Preserve a bounded denial reason and return an honest 503 for backend failure, while keeping true quota rejection at 429. This improves diagnosis and recovery messaging; it does not repair the service. |
| P1 | **Import is a dead button.** Clicking My Projects → Import on production does nothing; the source button has no handler or destination. | Link to the existing workspace importer, preserving the active firm and a return to Projects. Resume its saved import rather than silently start another. Keep destination-side membership checks. |
| P1 | **Phone users cannot reach the project actions normally.** Actual component fixture measured a 758px document at both 320px and 390px; New project ended at x=439.55px. | Stack the header and allow controls/tabs to wrap. The fixed document measures 320/390px respectively and New project ends at x=256.14px. Preserve desktop composition. |
| P2 | **New designers finish import in Settings.** Generic professional signup encodes `/settings` as its return destination despite promising a ready workspace. | Designer/architect/builder signup defaults to Projects. Preserve explicit destinations, first-project intent, vendor behavior and browsing. |
| P2 | **Project cards claim saved rooms do not exist.** The live interview demo card says 0 rooms; opening it shows 15 rooms and 19 photos. The list query omits room and image counts. | Return the existing Room relation count and already-fetched photograph count. Verify private drafts, zero counts, firm isolation, pending deletion hiding and anonymous denial without new per-project queries. |
| P2 | **Generate draft can open Publish before a draft exists.** The real generation route returns HTTP 202 while a generation lease is active; the Story client treats it as completion. Three new failure scenarios reproduce incorrect navigation on baseline. | Stay on Story for pending or unconfirmed results; preserve answers and retry. Open Publish only on a successful `{ok:true}` acknowledgement. |
| P2 | **The old onboarding browser regression skips the current journey.** It assumes direct signup → firm → upload and omits email verification and website import. | Exercise the actual verification/import components, retry states and workspace return. Run the repaired journey and new count regression in CI. |
| P3 | **The profile link promises the wrong destination.** “View directory listing” can now resume the private imported profile. | Rename it “View my profile,” retaining the canonical route. |

P0 means the observed production service must be restored before accepting the interview journey. P1 means a likely first-use action is blocked or inaccessible. P2 means misleading progress, a wrong transition, or a gap that lets these regressions escape. These priorities are product impact, not security severity.

## What was exercised

### Live production

- Account menu → My Profile resolves to the firm profile for the current workspace.
- My Projects resolves to the project list; Import is inert on baseline.
- A project opens its saved photos, 15 rooms, tags and interview continuation controls.
- New project exposes completed-project intake, year/month precision, URL import and file upload.
- The canonical workspace import destination is accessible; member permissions correctly omit editing the business profile while allowing project/bio import.
- Browser warnings/errors on this observed path: none. The scoped production runtime-log query returned no error/fatal records in its one-hour window; this is not proof that unexercised mutations succeed.
- BP Design's configured `bpdesign.com` website fails browser certificate validation (`ERR_CERT_COMMON_NAME_INVALID`). No warning was bypassed. A valid portfolio URL was requested before successful live import.
- With founder authorization, created one private project, **Folio QA — First-time journey — 2026-11-05**, ID `64d55224-5540-5e0b-b2b1-ab958f443631`. Uploaded a visibly labeled synthetic 1200×800 PNG (image ID `c439c4bf-9a17-5165-bc2a-b0523f9b38c6`), verified protected image delivery, saved `QA Living Room`, and marked the synthetic photo product-free. Completed year is 2025 with no invented month. The project remains private and is retained for debugging; existing BP Design projects/profile were untouched.
- Followed the actual Continue to interview action. Startup failed in rate-limit infrastructure before provider conversation/session reservation. Type instead changed the input choice but did not provide an active interview. Left Story for Projects. No interview answer or recording was created, and no article was generated or published.
- After assigning every QA photo to a room, the Rooms page still displayed “Next · Sort into rooms” rather than advancing its suggested action. Tags was reachable through the step tracker; recorded as additional P2 guidance friction.

### Isolated journey evidence

- Signup verification: invalid/expired verification, replay and delivery behavior through actual handlers.
- Durable import: consent, selected-firm scoping, private drafts, saved-return navigation, retries, duplicate prevention, revoked access and JSONB lease fencing.
- Manual import walkthrough: progress → private profile mosaic → profile details → save business details → save bio context → profile interview link. Synthetic data only.
- Project setup: seven cases, including partial uploads and failed-photo retry.
- Guided entry: 21 cases, including the original lifecycle action and four generation-response cases.
- Guided interview: 21 cases covering saved answers and continuation.
- Live browser/capture: 46 cases; composed project host: 26 cases; interruption scenarios: seven cases; live transport: 54 cases; adapters pass. Provider/Daily/microphone boundaries are synthetic. The limiter regression verifies each denial reason and excludes credentials/identifiers from logs and results.
- Core suite: 21 passed, two intentionally skipped database-backed cases, zero failed.
- Workspace counts: four checks; completion-date regression: 14 checks; Prisma schema/client alignment: 236 models and 103 enums.

## Remaining acceptance work

### Hybrid interview follow-up

The founder prioritized forgiving first attempts: accepted answers should stay visible, with editing, a fresh written replacement, optional light AI cleanup and an explicit way to resume. This work keeps the existing voice-led interview and its canonical evidence history. It does not reset the interview or silently rewrite testimony.

The implemented boundary pauses the call and capture before editing, binds the replacement to its saved question and canonical revision, and retains the original until a correction is accepted. Retry uses the same request receipt when acknowledgement is uncertain. The AI cleanup preview is deliberately limited to removable filler spans; it must preserve meaningful wording, facts, uncertainty and emphasis. The designer chooses whether to use the preview and then saves separately. Corrections can regenerate dependent follow-up questions. Text cleanup does not edit saved audio/video.

The synthetic speech checks accept “uh/um,” repeated words and a self-correction verbatim without duplicate saving. A thought continuing after an interrupted next question is retained for review rather than attributed to a question the designer did not hear. These are ingestion guarantees, not measured speech-recognition or turn-timing performance.

Five bounded calls to the actual configured cleanup model (`claude-sonnet-5`) matched the expected conservative results: filler removal while retaining voice, stutter removal without flattening emphasis, facts/negation preservation, quoted filler/acronym preservation, and instruction-like speech treated as data. Total usage was 3,280 input and 53 output tokens (about $0.011 at the repository's rate table); no actual designer text or records were used. The application restricts deletion to candidate spans and explicitly protects quoted filler/acronyms. The retained local report is `.tmp/live-answer-cleanup-eval.json`.

After service restoration, run this real IG Workshop acceptance sequence:

1. Answer naturally with an “um,” a repeated word and a mid-sentence correction. Confirm the visible saved question and answer.
2. Pause for several seconds mid-thought, then finish. Check whether the provider split the answer and whether any review prompt recovers the full thought accurately.
3. Interrupt the interviewer and continue an earlier thought. Verify the text is preserved and explicitly attributed before it counts as evidence.
4. Edit an answer, preview AI cleanup, reject it once, then accept an edited version. Confirm earlier saved answers remain and the next follow-up fits the correction.
5. Disconnect during a replacement save; retry once, reload, and verify exactly one accepted correction with the original retained.
6. Resume explicitly, continue by voice or typing, then leave and return. A stopped microphone must not claim to hear a spoken resume command. When the live host is listening, test “let’s continue” through its existing resume choice.

Follow-up verification: 59 actual-component browser cases, 63 live service/route/controller cases, 17 guide adapter cases, canonical controller and source-adapter checks pass. Cleanup preview/authorization/model-output cases pass. Mobile390/desktop1280 screenshots show contained layout and correct editor focus. A delayed pause response leaking the previous project's state was reproduced before the fix, then all delayed pause/cleanup/save source-switch checks passed. Review also closed completed-interview editing, cleanup-preview mutation during uncertain save, and malformed200 draft-loss paths. Final review found no remaining source blockers. Live acceptance remains open.

Final hybrid-source verification also passed production compilation, the TypeScript ratchet at 851/862 with no new fingerprints, source lint (zero errors, one pre-existing ref warning), client/migration guards and all 26 composed project-host browser checks. The source changes are in draft PR #848, separate from deployment and the remaining live acceptance.

### Other remaining journey work

1. **IG Workshop tagging and interview:** use the founder's already-imported IG Workshop account. First restore the rate-limit backend. Then confirm product tagging/placement persists, a real interview answer saves, leaving/resuming preserves it without duplication, and the provider conversation ends when leaving. Fixture checks do not close this acceptance item. Do not repeat its website import unless specifically needed to reproduce an import defect.
2. **Consistent project status wording:** list “Drafts” currently means an empty project; the project breadcrumb uses editorial/interview readiness. A project can consequently appear “In progress” in the list and “Drafts” inside. Choose one user-facing interpretation without changing stored lifecycle semantics incidentally.
3. **Legacy archive metadata:** an undated completed project may display the stored default “Concept” on its card. Reconcile with the canonical timeline and show an honest fallback; do not invent a completion date or bulk rewrite existing projects.
4. **Full rendered media journey:** the composed media test could not start because local FFmpeg is missing. Live-answer/capture recovery tests pass, but playable exported recordings remain a separate acceptance gate.
5. **Completed room sorting guidance:** make the suggested next action advance when every photo is assigned or intentionally excluded; keep the existing step tracker and data gates. Reproduce with one uploaded photo assigned to one room.

No publishing, migration, feature activation or production deployment is part of these source fixes. Merge and deploy only after review and checks; rerun the live smoke test against the deployed revision.

## Final verification and handoff

Production compile passed. TypeScript diagnostic budget passed again after the final outage-reporting change at 851 against the committed 862 baseline, with no new diagnostic fingerprints. Full source ESLint passed with zero errors and 3,419 existing warnings; final changed-file lint passed. Client-import and migration-discipline guards passed. The repaired marketing/import browser suite passed all 24 cases with zero browser errors. Both source reviews reported no blockers. Outage-reporting tests pass while preserving denied requests, provider-call ordering and saved data. Changes are reviewable on `codex/designer-journey-loose-ends`; no merge or deployment has occurred.

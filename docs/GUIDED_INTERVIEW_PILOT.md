# Guided project interview pilot

Implementation of the supplied **Folio Guided Interview Codex Prompt**, reviewed against main `b79564f8` on 26 September 2026.

**Production activation, 26 September 2026:** after explicit approval, Production was rebuilt from PR #799 with `NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW=1`. Vercel reports the deployment Ready on `folioad.com`. See the [rollout record and verification limits](reviews/guided-interview/production-rollout.md). The original implementation kept activation separate; the approved rollout supersedes that original hold.

## Use locally

Keep the existing database, authentication, storage, and AI configuration. No schema migration or new service is required. From the repository in PowerShell:

```powershell
$env:NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW = '1'
npm run dev
```

Sign in as an authorized project editor, open a project, and select **Start interview** or **Continue interview** in project progress. The action opens the interview directly; the tagging handoff does the same. A normal **Story** tab/step visit remains the saved-answer review, with its own Start/Resume control. The pilot prepares or restores its saved questions automatically. Recording starts only when the microphone button is pressed. The same protected wrapper covers the project wizard and designer preview entry points.

The Story review hides Generate draft, its context options, and Restart until accepted nonblank answers exist. Its room-answer requirement still controls whether generation is available. Closing an interview consumes the original start action so a refresh does not immediately reopen it; a later explicit Start/Resume opens it again. Saved-answer reads use `?savedOnly=1` and do not prepare questions or delay opening the interview. Remaining legacy question preparation runs only after project authorization.

This is a build-time public flag: restart development or rebuild a local production build after changing it. No production settings or flags were changed by this implementation.

**Merging does not activate the live pilot.** This repository has Vercel Git deployments disabled. The live site needs a deployment containing the change, built with `NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW=1` in its production environment. Setting the flag locally or merging the branch does neither. The wrapper also honors the authenticated server's guided availability when a client has an older disabled flag; authorization errors still block entry, and protected spotlight enrollment still takes precedence.

For rollback, unset the variable or set it to `0` and restart/rebuild. Projects without a saved guided session use the existing interview. Existing guided sessions keep their guided reader/writer so they can finish without losing their cursor or history. The flag controls **new pilot sessions**, not an emergency kill switch. Spotlight enrollment and its existing account gates/kill switches remain authoritative in either flag state.

## Implemented flow

- Photographs occupy the main canvas; the conversation occupies reserved space at the lower right. Mobile puts the photo above the panel, with the active question kept immediately above the composer.
- The five project categories remain `CLIENT_BRIEF`, `SCOPE_PARAMETERS`, `DESIGN_DIRECTION`, `SIGNATURE_IDENTITY`, and `SURPRISE_PIVOT`. Room preparation waits for the project section to finish and uses its accepted answers.
- Section navigation selects an eligible prepared question without dropping the remaining obligations. Individual and room skips are recorded separately from answers. A room entry from the Story tab is honored once room preparation is eligible.
- Each accepted answer is committed before the next decision. A useful immediate follow-up consumes the existing allowance, records an editorial purpose and exact parent answer, and cannot recursively produce unlimited follow-ups. Sufficient answers move on. Exact conversational skip/move-on/pause requests are controls, not designer evidence.
- Corrections retain the original exchange, supersession links, and recordings. Dependent follow-ups are excluded from accepted draft evidence and clearly labeled in the transcript. Unsent corrections survive pause/reload.
- Photo browsing never changes the question or attribution. **Discuss this photo** explicitly attaches an authorized image; **Unlink** deliberately removes the attachment without deleting text. Automatic room-photo transitions wait while typing, recording, transcribing, or saving; later manual navigation cancels a queued transition.
- **Finish with what I have** explicitly describes shorter/skipped coverage. **Prepare editable draft** uses the existing generation endpoint and the same context options. It opens the existing draft review. Publication remains a separate explicit action.

## Prepared questions and evidence

The durable session lives in `ProjectPost.provenance.interview.guided`, alongside the existing canonical `interview.payload.answers` and `payload.followups`. There is no parallel database or migration. The session includes the actual prepared question IDs, original generated wording, validated displayed wording, categories, source and room IDs, statuses, turns, version, cursor, and request receipts.

The existing project/room generators are reused. Their older product-targeting behavior is not trusted: this pilot supplies no product candidates to the general-room generator and validates complete question wording. Uncertain or disallowed wording receives a deterministic project/room question. The original candidate remains in `preparedText`/`preparedCategory`, with a validation reason; the active category describes the question actually asked. Missing required categories and room budget slots receive safe fallback questions. No model declaration of “covered” silently completes another obligation.

This conservative validation can replace contextual generated wording with more general questions. That is a pilot limitation. The model selects from bounded follow-up purposes, with exact supporting answer references; it cannot choose products, overwrite the prepared plan, move the cursor, or publish.

Every accepted turn retains its question text, raw user text, modality, question/room/image references, and any immutable recording token. Canonical answers and `EditorialInterviewAnswer` projections commit in the same transaction. JSON compare-and-swap, version checks, and request digests prevent stale writes or changed-content replays. A failed next decision leaves the already accepted answer saved; a prepared-question continuation or retry preserves the plan.

Existing generation, transcription, legacy question/follow-up caches, reverse sync, realtime conversion, and room-rename writers were audited. Their narrow guards/CAS writes prevent an older tab from replacing newer guided provenance or projections. Legacy answer editing of a guided session returns a conflict; corrections belong in the guided transcript.

## Text and microphone handling

The canonical save limit remains **2,000 characters per answer**. Typed text and transcription are never sliced by the new UI. Over-limit material remains in the composer and cannot be sent until shortened. Unsent text and pending request IDs are stored on that device under the signed-in actor/project key; the UI distinguishes this from server-saved accepted answers. Browser-storage failure is reported.

The existing microphone hook now waits for the final recorder data event, supports transcription retry without re-recording, and releases microphone tracks on cancellation/unmount. Guided transcription returns an immutable recording ID. The server validates that recording against the project and question; another tab's later recording cannot become this answer's audio. Text edits preserve the original recording history while invalidating obsolete quote timings.

## Verification

Repeatable checks:

```text
npm run test:guided
npm run test:guided:browser
npm run test:core
npm run typecheck
npm run guard:client-imports
node scripts/phase5e-check-plan.mjs --ci
```

The browser script uses installed Chrome/Edge/Chromium, or an executable supplied in `GUIDED_TEST_BROWSER`. It serves only on loopback, blocks external browser requests, and writes screenshots/results to `docs/reviews/guided-interview/`. It uses the actual React component and controller, with synthetic preparation, microphone, API persistence, and draft-generation boundaries. The illustrated room images are labeled synthetic fixtures.

Verified:

- Prepared categories, original wording/IDs, room budgets, safe scope, bounded next actions, and answer references.
- Actual guided HTTP/service/store/projection code with isolated boundary doubles: auth and spotlight denials; repeated/concurrent/stale requests; changed request payloads; save/model/projection failures; late responses after pause; source changes; recording identity; corrections; staged preparation; partial finish; rollback drain.
- Actual existing writer code: JSON CAS and transaction orchestration preserve guided history through legacy writes and generation. Structural JSON and `Prisma.DbNull` behavior in the existing core test double was corrected and regression-tested.
- Canonical integration journey: guided HTTP handlers capture five project answers and six room answers across two rooms, preserve a correction's raw history, then generate and fetch an editable DRAFT with the correct room/photo references. The public reader still returns no article. The core suite has **10 passing tests and one disposable-database skip**.
- Browser: automatic start, independent browsing, save failure/retry, lost successful acknowledgement, pause/reload, complete long transcription, room transitions, scroll preservation, desktop/mobile bounds, correction-draft resume, and explicit draft handoff.
- Five live **synthetic** follow-up evaluations: rich answer advances, thin answer gets one room-level follow-up, corrected premise advances, volunteered unselected pendant is not pursued, and “move on” advances. The shared provider/model configuration was reused.
- Focused ESLint, client-import guard, migration-discipline check, Prisma schema/client sync, existing generation/quote persistence checks, and core regressions.
- All **14 workspace browser scenarios** and **11 entry-flow browser scenarios** pass. Entry coverage includes the original lifecycle CTA through its first question while Story reads are held, consumed close/reopen intent, empty/question-only evidence, canonical generation, server-enabled routing with a flag-off client, legacy fallback, availability errors, and spotlight precedence. The entry script reproduces six failures on the original merged commit `6885f576`; both result files record their verification scope. Eight actual GET-handler cases also check saved-evidence reads and authorization before model preparation.
- The TypeScript diagnostic ratchet passes with **903 diagnostics against the existing 904 baseline**, with no new diagnostic fingerprints; this repository does not have a clean full-project TypeScript baseline. Guided regression checks are included in the existing CI core job.
- The authorization scanner reports no finding for the new guided route. Its overall CI command remains failing on seven critical findings in five unchanged Publishing Studio route files. Those pre-existing scanner findings were not changed or treated as verified vulnerabilities in this work.

Review screenshots: [desktop](reviews/guided-interview/desktop.png), [mobile](reviews/guided-interview/mobile.png). [Browser check results](reviews/guided-interview/browser-results.json). [Synthetic prompt evaluation](reviews/guided-interview/prompt-evaluation.json).

Entry correction: [first question after the original CTA](reviews/guided-interview/entry.png), [passing checks](reviews/guided-interview/entry-results.json), and [original merged-code failures](reviews/guided-interview/entry-baseline-results.json). All are synthetic local fixtures, not live-site verification.

## Changed code

- `src/lib/interview/guided/`: durable types, deterministic controller, transactional store/service, preparation and bounded model decisions.
- `src/app/api/posting/project/[projectId]/interview/guided/route.ts`: authenticated, versioned command and restore API.
- `src/components/posting/interview/GuidedInterviewWorkspace.tsx`, `guidedWorkspaceState.ts`, `InterviewModal.tsx`, and `useVoiceRecording.ts`: workspace, local recovery, protected entry routing, and lossless recording lifecycle.
- Existing interview save/generation/transcription/follow-up/status/completion/realtime routes, room rename, and editorial question/reverse-sync helpers: narrow guards and concurrent-write protection for shared provenance.
- `src/lib/flags.ts`: default-off pilot enrollment flag.
- Project progress and tagging CTAs, `ProjectTabs.tsx`, and `StoryInterviewPanel.tsx`: consume explicit interview intent, preserve ordinary Story review, and require accepted answer content before exposing draft controls.
- `scripts/check-guided-*`, `scripts/eval-guided-interview.cjs`, `scripts/fixtures/guided-interview-evaluation.json`, and existing core/quote checks: regression coverage and synthetic evaluation. `package.json` and `.github/workflows/lint.yml` expose and run the focused checks.

## Limits of this delivery

- **Private spotlight interviews remain in the existing protected UI.** This pilot does not implement spotlight interviewing or bypass enrollment/kill switches. Existing spotlight selection, confirmation, parentage, product budgets, and publication behavior remain in that flow.
- Tests of database writes use transaction/CAS boundary doubles. Real PostgreSQL isolation, a real microphone/Whisper round trip, and a full authenticated browser run against a disposable database were not exercised. The repository's disposable PostgreSQL/private-spotlight browser runner requires infrastructure not provisioned here.
- Desktop and mobile screenshots verify a local fixture, not a live designer project. Mobile software-keyboard behavior is not a real-device test.
- The UI preserves existing sessions rather than exposing destructive restart. Prior legacy answers remain canonical evidence, but are not silently credited to freshly prepared guided questions.
- No avatars, full-duplex voice, simulated realtime transport, new ingestion, automatic publishing, production migration, deployment, merge, or production activation was added.

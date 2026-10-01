# Live interview implementation verification — 2026-10-01

Branch: `codex/live-interviews-media`, rebased onto main `0127d3a4` after the two welcome-copy PRs landed. All live/recording/export flags remain off. No production migration, storage change, deployment, merge or paid provider call was performed. The founder separately approved the two Prisma model blocks and User inverse fields for the branch only.

## Implemented coverage

The embedded Folio Interviewer is mounted in the existing guided project/room, protected Spotlight, My Expertise, Story/About You/20 Questions, personal bio, organization bio and collaboration/vendor workspaces. Existing canonical services own wording, persistence, corrections and editorial completion. A minimal authenticated collaboration page now mounts the already-existing participant workflow. Exact authorities and public source requirements are in [the inventory](../../LIVE_INTERVIEW_INVENTORY.md).

The browser captures only consented creator tracks. Private ordered chunks become decoded, normalized recordings with actual recording-aligned transcription. Publishing Studio's media library offers transcript-backed selections, trims, scene ordering, authorized imagery, portrait/landscape/audio formats, actual marked previews, exact-version approval, Folio publication and clean export. Native rendering runs in a separate durable worker. Neither avatar-containing media nor mixed-contributor assembled media is offered; own collaboration output is independent of pending other-party participation, while the existing joint article publication still requires both approvals.

## Completed verification

| Command/check | Result and boundary |
| --- | --- |
| `node scripts/check-live-interviews.cjs` | 19 transport/security checks passed. Actual service, turn reducer, provider request builder; canonical engine/database/provider HTTP doubled. Includes stale-state refresh, original receipt retry, explicit photo links, wrong-round substitution, unresolved speech restoration, no blind paid retry and revoked-access cleanup. |
| `node scripts/check-live-adapters.cjs` | Seven source kinds passed. Actual bio/org/collaboration shared writers with schema-aware database doubles; other native engines doubled in this suite. Includes independent collaboration media and real joint approval route checks. |
| `node scripts/check-live-interview-browser.cjs` | 17 actual Chromium/IndexedDB checks passed. Daily and MediaRecorder transports synthetic. No paid mount call, consent/permission failure, microphone permission-loss cleanup, partial versus full speech, legacy duplicate events, final flush, bounded chunks/backpressure, initial mute, expiry, scoped authenticated discard and reload recovery. |
| `npm run test:live:media` | 2 native suites passed. Disposable PGlite executes the real migration twice and real session/media SQL. FFmpeg 9.0.2 normalizes/decodes source and renders a portrait photo clip, chaptered landscape camera episode, audio-only output and distinct marked previews. Authorization, exact approval/publication/export, revision invalidation, round-scoped restore, lease exhaustion, retries and cancellation covered. Storage, ASR and source resolver doubled. |
| `npm run test:live:journey` | Project and designer-bio composed journeys passed. Real in-process HTTP routes, transport, adapters, guided controller/service/store/projection, bio writer, media SQL/worker and FFmpeg. Start/replay, voice evidence, pause/resume, consented finalization, playable source, suggested moment, actual render, approve/publish/export and correction invalidation. Real guided stale-version refresh and linked-image projection included. Existing Prisma delegates doubled; new tables use PGlite. External LLM/Tavus/storage/ASR synthetic. |
| `npm run test:guided` | Existing prompts/controller/HTTP/service/store/provenance checks passed. Existing native interview engine tests use their documented fixtures. |
| `npm run test:guided:browser` | 16 workspace and 16 entry regressions passed. Entry fixture explicitly handles the new read-only disabled-live availability check. |
| `npm run test:core` | 10 passed, 1 disposable-database test skipped by its existing opt-in contract. |
| `npm run test:recorded-media` | 33 passed, preserving existing recorded-interview behavior. |
| `npm run lint` | Exit 0, existing warnings remain. |
| `npm run typecheck` | Diagnostic ratchet passed: 903 against baseline 904, no new diagnostic fingerprints. The repository is not globally TypeScript-clean. |
| `npm run guard:client-imports` | Passed; server credentials/Prisma remain outside client boundaries. |
| `node scripts/phase5e-check-plan.mjs --ci` | Passed: loose SQL 32/32, phantom calls 0, missing SQL 0, non-idempotent recent DDL 0. |
| Prisma format, validate, generate and `npm run verify:prisma` | Approved schema edit passed; 235 models and 103 enums match the generated client. Post-rebase read-only `npm run prisma:status` reports only the expected unapplied `20261001120000_live_interview_private_media` migration (114 total). Application remains a separate gate. |
| Worker `--check-native`, cleanup `--check` | Actual standalone imports and native FFmpeg/FFprobe work. Cleanup import check makes no session/provider mutations. |

CI includes the pure live/adapter suites, native FFmpeg media tests and composed journeys, with Ubuntu FFmpeg installed. Local browser tests use installed Chromium; no live hosted-browser result is implied.

## Failures and rollout prerequisites

- `npm run security:idor:ci` exits 1 with **9 Critical, 1 High, 18 Medium and 16 Low** heuristic findings. An isolated scan of unchanged HEAD routes returns exactly the same counts/findings. No new live/media finding remains. Existing Critical findings are on reset/expertise/readiness/story routes; this branch does not suppress scanner rules or allowlist new routes.
- `npm run db:check` points to the already-missing `scripts/db-check.ts`. It cannot establish database cleanliness. The focused private-table metadata/Prisma checks and disposable SQL tests are reported separately.
- Read-only setup reports missing `TAVUS_API_KEY`, `FOLIO_LIVE_BASE_URL` and `FOLIO_LIVE_ALLOWLIST`. Native binaries were verified using local `FFMPEG_PATH`/`FFPROBE_PATH`, but are not on default PATH. The supplied worker container was not built because Docker's daemon is unavailable.
- The existing private `interview-media` bucket has a legacy audio MIME allowlist. It must allow `audio/webm`, `video/webm`, `audio/mp4`, `video/mp4` and sufficient output size before capture is enabled. The actual worker storage preflight currently stops here; no bucket setting was changed.
- The new database migration is deliberately unapplied. Review it and choose a development/preview database before migration execution. A persistent worker plus once-per-minute live-session cleanup must be deployed separately.
- No real Tavus join time, speech-to-audible-response latency, stock face delivery, provider event ordering, real microphone/camera capture, actual Whisper quality, or deployed worker execution was observed. These are bounded smoke-test acceptance checks after development configuration is available, not inferred from mocks.
- Composed native HTTP-to-export journeys cover project and personal bio. The other five types have adapter/native-service fixture coverage and mounted entry inspection, not the same composed browser/device journey. Multi-person assembled media is intentionally not exposed; foreign-actor recordings cannot be substituted into own media plans.

## Founder test path

Release follow-up, 2026-10-01: the founder added `TAVUS_API_KEY` to Vercel Production and approved merge/release. Initial hosted CI exposed older VM component loaders and the historical exact-schema guard. The three UI fixtures now explicitly model disabled live UI (and the bio fixture's authenticated owner). The schema guard pins the approved live proposal/SQL while still rejecting changes to either model, User inverse relations, deletion semantics and proposal artifacts. All 36 Publishing Studio scripts and focused schema scope/negative checks pass locally. Production activation still requires the documented infrastructure and acceptance steps below.

Follow [setup and tunnel commands](../../LIVE_INTERVIEWS.md) and [worker/migration/bucket setup](../../LIVE_INTERVIEW_MEDIA_WORKER.md). Open an existing supported interview, choose **Start live interview**, select the recording choice and consent, then explicitly start. Review raw source and actual rendered pieces at **Publishing Studio → Interview recordings and media** (`/designer/studio/media`). Review, approve the exact version, publish to Folio, then export.

Stopping the rollout means disabling new-live/recording/export flags and stopping new worker work. Preserve canonical answers, private tables and original recordings. End and cleanup remain available when access/flags change; provider maximum duration remains a final bound if cleanup is unavailable. Private signed URLs already issued expire normally; external downloaded files cannot be recalled.

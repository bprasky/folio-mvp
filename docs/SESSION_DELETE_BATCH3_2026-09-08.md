# Great Folio Delete — Batch 3 session

Date: 2026-09-08. Branch: `codex/folio-hardening`.

## Scope

Removed only the exclusive obsolete interview presentation generation. The current graph confirmed 18 audit candidates, totaling 1,890 production-source lines. No additional files were selected for deletion. All three known live biography components were preserved unchanged. No route, API, package, Prisma, migration, data or current application behavior changes.

## Current architecture and caller proof

- Project: `src/app/project/[id]/page.tsx` → StoryPanel → StoryInterviewPanel → `src/components/posting/interview/InterviewModal.tsx`. NewProjectWizard and designer project preview also import the current modal.
- Current text branch: InterviewModal → its own QuestionCard and useVoiceRecording; useInterviewQuestions/useRoomInterviewQuestions load `/api/posting/project/{id}/interview/questions`; useRoomInterviewFlow supplies room progression. The modal loads/saves `/api/posting/project/{id}/interview`, calls the existing single/batch/general follow-up endpoints, and completes through the canonical interview/generate endpoint.
- Biography: designer ProfileClient → AboutTab → BioSetupFlow → BioInterviewModal. The modal directly imports `TextInterview/FollowUpTransition.tsx`, `shared/InterviewQuestion.tsx` and `shared/ProgressIndicator.tsx` from the otherwise obsolete folder. Those three files remain unchanged and functional.
- Recorded interview: `/designer/interviews/[id]` loads Prisma InterviewSession for its owner, then mounts RecordingInterface for DRAFT/UPLOADED or InterviewStatusView for later states. Upload, processing, status and highlight approval paths remain intact. The session can represent a project or product interview.
- Vendor boost: `/designer/boost-inbox` → BoostInboxClient → vendor-boost accept API → `/designer/interviews/{sessionId}`. Product DesignerInsights still reads the interview status API.
- Realtime: current InterviewModal → RealtimeInterviewView → `/api/interview/realtime/session`; completion uses `/api/interview/realtime/convert`. The current QuestionCard's separate voice hook still uses the posting interview transcription API. EditReflectionModal and all current answer/projection/quote helpers remain intact.
- Old roots: `components/interview/index.ts` had no inbound importer and exported InterviewFlow and its old text/shared/hook tree. `VoiceInterview/index.ts` was a separate callerless barrel. Every inbound edge for each deleted file came from the deletion set. Shared biography files were outbound dependencies, not deletion candidates.
- Checked TypeScript-resolved static imports, re-exports, literal require/dynamic imports, JSX/symbol references, routes, tests/scripts, documentation and history. Searches after deletion found no dangling runtime imports. Same-named current QuestionCard and shared/data types are separate live modules.

## Exact deletion set

Paths are relative to `src/components/interview/`. All 18 are original audit candidates, including the five internal barrels. No additional closed-tree artifact was removed.

| File | LOC |
|---|---:|
| InterviewFlow.tsx | 287 |
| ModeSelection.tsx | 136 |
| TextInterview/QuestionCard.tsx | 202 |
| TextInterview/TextInterview.tsx | 217 |
| TextInterview/index.ts | 3 |
| VoiceInterview/AIResponse.tsx | 72 |
| VoiceInterview/ActiveRecording.tsx | 94 |
| VoiceInterview/MicCheck.tsx | 40 |
| VoiceInterview/VoiceInterview.tsx | 56 |
| VoiceInterview/VoiceTranscript.tsx | 54 |
| VoiceInterview/index.ts | 5 |
| hooks/index.ts | 1 |
| hooks/useInterviewSession.ts | 462 |
| index.ts | 28 |
| shared/EditorialPreview.tsx | 89 |
| shared/ModeSwitcher.tsx | 44 |
| shared/index.ts | 4 |
| types.ts | 96 |
| **18 files** | **1,890** |

Candidates retained because a new live caller was discovered: none. The three already-known live biography files were explicitly excluded. No renderer-only CSS/assets/tests were found requiring additional deletion. Shared GenerationProgress, flags, cn/utils, current audio primitives, schemas and provenance helpers remain untouched.

## API impact — retain every endpoint

| Endpoint called by deleted useInterviewSession | Remaining repository runtime callers | Status / action |
|---|---|---|
| `/api/interview/start` | None found | Repository-callerless; external usage unknown; DO NOT DELETE |
| `/api/interview/respond` | None found | Repository-callerless; external usage unknown; DO NOT DELETE |
| `/api/interview/complete` | None found | Repository-callerless; external usage unknown; DO NOT DELETE |
| `/api/posting/project/{id}/interview/generate` | Current InterviewModal and StoryInterviewPanel, among current generation surfaces | Still live; preserved |

The old hook called start at line 156, respond at 222, complete at 344 and canonical generate at 362 before deletion. Remaining mentions of the old endpoints are definitions, logs, comments or historical documentation, not runtime clients. API history includes recent write-safety and model/prompt changes; repository callerlessness does not prove external retirement safety. Endpoint deletion needs a later explicit batch.

## Verification

| Check | Result |
|---|---|
| All five core journeys | PASS: 8 tests total; 1 live-DB group skipped |
| Interview question validation + editorial lifecycle | PASS: 6 tests; 1 live-DB group skipped |
| Current initialization/question route | PASS: real init and question GET handlers, nonempty room-question response with existing deterministic model fixture |
| Current answer persistence/resume | PASS: real interview GET → POST → GET with existing memory database |
| Completion/generation and provenance | PASS through core journey 4 and existing quote/projection checks |
| Current modal/question presentation | PASS: modal import/SSR, real question prompt and answer textarea markup |
| Biography | PASS: BioSetupFlow → BioInterviewModal initial SSR, all three shared component render assertions, real base-question GET and three answer POSTs |
| Recorded/realtime | PASS: resolved mount graph and real initial SSR; current voice hook imported through QuestionCard |
| Single generator, block bounds, quote audit, pull-quotes | PASS |
| Forward/reverse projection and stable provenance pointers | PASS in check-pull-quotes |
| Generation context, room matching, product naming | PASS |
| Regeneration surfaces, story editing | PASS |
| Type preparation, ratchet, baseline update | PASS |
| Ratchet guard tests | PASS: 5 tests |
| Client-import guard | PASS: 0 violations |
| Production build | PASS |
| Changed-file lint | Not applicable: no surviving JS/TS source changed |
| IDOR | Unchanged: 558 routes, 0 Critical / 1 existing High / 16 Medium / 19 Low |

All five core journeys retain their existing status: signup/onboarding; project/room/image/product tagging; ownership isolation; interview → ProjectPost → publication and withdrawal; vendor/designer collaboration.

The focused checks used existing deterministic fixtures and real handlers/components. No live LLM calls were made. They do not prove live database execution, browser hydration, microphone capture, realtime transport or interactive follow-up behavior. Existing projection tests and source reachability cover the deletion regression; no new full feature harness was introduced.

## TypeScript

| Metric | Before | After |
|---|---:|---:|
| Diagnostics | 994 | 988 |
| Fingerprints | 627 | 625 |
| Files with diagnostics | 255 | 253 |
| New fingerprints | — | 0 |

The six removed diagnostics belong to InterviewFlow (five occurrences) and TextInterview (one occurrence). Only those two fingerprints disappeared; no fingerprint increased. The lower baseline is included in the batch.

## Findings and documentation

- The audit's approximate 1,908-line count included an extra trailing empty line per file; Git records 1,890 deleted source lines.
- Three old endpoints now have zero found repository runtime callers. All remain preserved; external usage is uncertain.
- Older consolidation/elicitation audits describe an earlier flag-gated StoryPanel mount. Those are historical observations, superseded by this current graph. No flag or current caller was changed to enable deletion.
- Windows grep-based scripts ran under installed Git Bash. Standalone component checks needed React/router context, and handler checks used the full tsx loader for dynamic alias imports. Test fixture setup was corrected without changing application code.
- Detailed local logs and smoke scripts are under `tasks/delete-batch3-*`; they are verification artifacts, not production additions. Existing unrelated untracked files are preserved.
- Live database and P0 infrastructure verification remain parked; prior batches were not reopened.

Production reduction: 18 files / 1,890 LOC / 0 routes / 0 API routes / 0 dependencies / 0 Prisma changes.

GREAT FOLIO DELETE BATCH 3 COMPLETE

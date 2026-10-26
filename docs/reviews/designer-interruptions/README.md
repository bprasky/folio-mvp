# Designer interruption recovery — 2026-10-26

Local hardening on `codex/designer-interruption-recovery`, based on `f787200d0cbb00af81fcade2aa9fe80a782a563b`. **Not deployed. No production database, credentials, communications, paid providers or migrations were used.**

Read alongside [guided production rollout](../guided-interview/production-rollout.md), [project-guide findings](../project-guide/results.md), [core journey boundaries](../../CORE_REGRESSION_JOURNEYS.md) and [persistence findings](../../PERSISTENCE_INTEGRITY_2026-09-09.md). These local results do not replace their outstanding integration checks.

## Persistence inspected before changes

- Short intake created a private project only when an upload/import began. Its in-memory promise prevented simultaneous clicks, but refresh/lost acknowledgements discarded the identity. Photos were sequential independent writes; failed files lived only in component memory.
- Manual photos passed through Supabase storage, then ProjectImage creation, then best-effort search indexing. Storage used fresh names, so retrying after a database failure could upload another object. Indexing is not a durable queue.
- Tag creation wrote ProductTag, cleared the image's no-products flag and linked/created a Selection. Several mounted mutation controls ignored non-2xx responses. Position changes were unconditional writes.
- Guided interviews already saved pending request IDs locally, retained accepted answers before model decisions, used versioned server writes and rejected stale/reset sessions. A shared local draft key could replace another tab's unsent text on refresh. Browser requests had no deadline.
- The publish hook read canonical drafts; the editorial lifecycle already used one project post, authorization, serializable transitions and original publication timestamps. Forced generation bypassed its generation lock. Generation already checked interview reset/guided versions before saving.
- Staging keeps the article editor mounted during preview; StoryEditContext uses explicit saves. Older InterviewModal/AnswerForm paths have local/debounced saving, while DraftsPanel's autosave is disabled. Those older editors are not covered by the new intake/guided protections.

## Confirmed failures fixed

| Failure | Change | Executable evidence |
| --- | --- | --- |
| Creation succeeds but acknowledgement is lost; retry creates another project | Actor/firm-scoped persisted creation request, stable UUIDv5 identity, unique-key replay handling; intake fields and request snapshot survive refresh | Core real-route replay plus browser lost-response/reload scenario |
| Retrying a photo after storage/DB/response failure duplicates it | Opt-in project/content identity, stable storage path and unique image ID; concurrent unique-key collision reads canonical row | Upload route fixture injects storage failure, DB failure, concurrent retry and discarded success |
| Invalid files silently disappear; oversized JSON uploads fail without guidance | Shared MIME/size checks in browser and route; mixed batches retain valid results and explain rejected files | Unsupported/empty/oversized route cases; browser rejection before creation |
| Navigation while uploading allows old callbacks to redirect or continue the batch | Unmounted uploader stops scheduling files and applying completion callbacks; confirmed project remains recoverable | Browser unmounts during held upload, releases late success, reopens and reselects files |
| Tag errors appear successful or remain console-only | Check response status; use the application's mounted react-hot-toast host, retaining controls for retry | Actual TaggingSection browser checks for 401, 503 and successful retry |
| Repeated tag creation can duplicate tags/selections | Opt-in deterministic tag identity and serializable transaction around tag/image/selection; replay returns existing result | Core route repeat preserves one tag and linked selection; picker guards same-tick clicks and reuses a confirmed product during retry |
| A delayed tag move overwrites a newer position | Compare-and-set the original photo/coordinates; already-applied retry succeeds, conflicting edit returns actionable 409 | Core PATCH success, replay and stale-move rejection/readback |
| Stalled requests never release controls | Shared deadline covers headers and body; no automatic write retries; 401 explains sign-in recovery | Four transport failure tests; guided browser shortened-deadline injection retains text/request ID |
| Second tab overwrites the first tab's unsent interview draft | Tab-local recovery copy takes precedence; actor/project local copy remains available for reopening | Two browser tabs, refresh, navigation away and browser back preserve independent text |
| 202 generation response closes the interview as if draft preparation finished | Keep workspace open and explain pending generation | Guided browser pending-generation response followed by deliberate retry |
| Force regeneration ignores an active generator; an expired writer can save/unlock over its replacement | Forced recomposition respects active lease; atomic acquisition carries request identity; final write and cleanup require that identity | Core forced request makes no model call while locked; expired lease permits retry; save-path fixture rejects superseded writer |
| Same-tick publish clicks repeat requests; old reads replace newer draft data | Synchronous action guard and sequenced draft read responses | Actual publish hook: 503, repeated clicks, retry, reload and held stale read |

The UUID shape is preserved because existing project/image actions validate UUIDs. Existing callers without opt-in identities retain their contracts. Same photo content in one project intentionally resolves to the existing image, including its current name/room/tags. The manual JSON upload limit is **3 MiB** to leave room for base64 expansion within hosted request limits; JPEG, PNG, WebP and GIF are accepted. Larger images need resizing before this upload path. This is not a direct-storage multipart uploader.

Generation leases cover the route's 800-second maximum runtime plus 30 seconds. A browser deadline does **not** prove that server work stopped. The UI directs users to check saved work; an active server lease prevents repeating generation. If the process dies, a deliberate retry after expiry can take ownership. This is bounded recovery, not a background job scheduler.

## Verification and boundaries

Passing local commands:

- `npm run test:core`: 10 passing tests, one explicitly skipped live-database group. Actual routes/authz/lifecycle with the existing stateful database double and synthetic external services; no PostgreSQL durability or transaction-isolation proof.
- `npm run test:guided`: existing prompt, controller, service and provenance checks pass.
- `npm run test:project-guide`: planner/adapter checks and extended upload route fixture pass.
- `npm run test:interruptions`: four controlled transport cases, upload failure/replay fixture and generation save-path checks pass.
- `npm run test:interruptions:browser`: seven scenario groups pass against actual React intake/upload components, tagging controls and publish hook. HTTP/auth/storage/database are synthetic. Chromium offline mode, reload/back and component unmount are real browser actions.
- `node scripts/check-guided-browser.cjs`: 21 browser scenarios pass. Added session-expiry and timeout injection to save recovery, separate-tab drafts, and pending-generation handling. Transport/model/microphone/persistence remain simulated.
- `node scripts/check-project-guide-browser.cjs`: 26 existing composed scenarios pass. Independent fixture explicitly clears the preceding intentionally incomplete intake, since reopening now correctly restores it.
- `node scripts/check-project-completion-date.cjs`: 14 checks pass.
- Type preparation (`prisma generate` and Next compile-mode build) completed. Build reports existing import warnings; it is not an authenticated application smoke test.
- **Final prepared TypeScript ratchet is blocked:** 895 diagnostics against the 904 baseline, but one unbaselined generated-route fingerprint rejects `listAllContacts` exported by unchanged `src/app/api/rep-contacts/route.ts:141`. Earlier runs before all generated route artifacts were available reported 904/904; they are not the final verification result. The route has no diff from the starting commit. No diagnostic introduced by a changed source file was reported. Focused ESLint has zero errors and existing warnings; client-import and migration-discipline guards pass. No baseline increase or schema change.

New transport/upload/generation checks and browser interruption checks are wired into existing CI jobs. Hosted CI has not been run for this local branch.

Responsive evidence: [desktop partial failure](partial-desktop.png), [320px partial failure](partial-mobile.png). Actual application CSS with fallback fonts and synthetic data. Mobile has no horizontal overflow; retry and continue controls remain usable by scrolling. Existing guided tests also exercise mobile composer layout. This is not physical-device or assistive-technology certification.

## Remaining gaps and release checks

Resolve the existing unsupported `listAllContacts` route export and rerun the prepared TypeScript ratchet before release. This change deliberately does not raise the baseline or alter that unrelated route.

1. **Real integration remains unverified.** No disposable PostgreSQL/Supabase environment was supplied. Exercise unique-key races, serializable retries/rollback, independent connections, storage upsert permissions and actual processing failures there before release. The in-memory database cannot prove these properties.
2. **Real auth/network behavior remains unverified.** Browser 401s are injected; signing in again through NextAuth/OAuth, cross-device recovery and actual proxy/platform timeout behavior were not exercised. Files themselves are not persisted in browser storage: after refresh/navigation, users must reselect unconfirmed files. If browser storage is unavailable the intake explicitly warns that local recovery is unavailable.
3. **Background processing is only partly covered.** Injected search-index failure retains the saved image; process termination, durable indexing retry, Sharp decoding/EXIF behavior, remote-site imports, and recorded/live-media worker restarts were not tested with real services. Existing fire-and-forget indexing can still require operational repair.
4. **Other writers/editors remain separate work.** Legacy/full-form project creation clients do not yet send creation keys. Older tag clients without the opt-in identity/expected position retain old semantics. Unsaved inline article editing and legacy answer autosave are not given refresh or cross-tab conflict protection here. A lost catalogue-product-creation acknowledgement before a tag is created still lacks an end-to-end durable receipt; the picker only caches a product whose creation was acknowledged. Review these paths before claiming all designer editors are interruption-safe.
5. **Publication coverage is layered, not a real release.** The UI failure/retry scenario uses synthetic HTTP; canonical lifecycle repeat/timestamp/visibility checks use the core database double. Real commit-then-disconnect, concurrent publication and vendor notifications need a disposable integration with delivery suppressed.

No merge, deployment, production migration or external publication was performed.

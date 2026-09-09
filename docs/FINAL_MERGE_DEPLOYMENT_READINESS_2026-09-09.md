# Final merge and deployment readiness audit

Date: 2026-09-09. Branch: `codex/folio-hardening`. Scope: audit only; no application changes, migration application, data cleanup, infrastructure provisioning, merge or deployment performed.

## 1. Merge status

**MERGE READY**

No concrete branch-caused merge blocker was found in the protected release contract. This is a recommendation based on local execution and read-only database evidence, not a claim that every application feature or remote CI run has passed. If merging main automatically deploys production, hold that deployment until section 12 is satisfied; the code-merge recommendation does not authorize an unsafe automatic release.

## 2. Deployment status

**PRODUCTION DEPLOY BLOCKED — production Upstash configuration and live distributed-limit verification are not established; missing configuration denies credentials login and signup.**

The configured local application environment has neither Upstash variable. Deployment-provider environment settings were not accessed, so their absence there is not asserted. Production readiness requires positive evidence, which is currently missing. Renderer and recorded-media gates are separable optional capabilities.

## 3. Main synchronization

| Item | Evidence |
|---|---|
| Audited application SHA | `e383185e275936fd33cd375a1916fd37ef176b2f` |
| Fetched origin/main | `05303220a06c3aece2381067d98e0717ee972eda` |
| Merge base | `05303220a06c3aece2381067d98e0717ee972eda` |
| Branch-only commits | 30 before this documentation commit |
| Main-only commits | 0 |
| Rebase/merge | Neither needed; main is an ancestor |
| Conflicts | None |

Origin was fetched at baseline and again after validation; main remained unchanged. Initial tracked tree was clean. Existing untracked session artifacts were preserved. This audit changes only this report and `tasks/todo.md`.

The range includes prerequisite migration-guard and quote-provenance work starting at `b46b2084`, before the named P0 checkpoint `b9f7acc5`. These commits are included in the inventory and migration analysis, not omitted as unrelated history.

## 4. Change inventory

| Group / principal commits | Behavior and user-visible change | Migrations | Configuration / infrastructure | Rollback |
|---|---|---|---|---|
| Security: `b9f7acc5`, `38de2682`, `1d57d5e0`, `1b8eaf95` | Raw-body signed inbound webhook; distributed production limits; pinned public-address fetch and redirect checks; protected URL-only renderer; scoped prompt, inquiry, product and project access. Unsupported scrapes return errors/manual capture rather than unrestricted browser fallback. | None | Upstash; Resend signing secret; optional isolated Linux Docker/nftables renderer and HTTPS controller | Removing limits/signatures/ownership predicates restores vulnerabilities. Keep renderer disabled until verified. |
| Editorial: `13b1e0d7`, `39fea0b2`, plus quote prerequisites `0bb40a22` through `ba893301` | Persisted ProjectPost lifecycle and canonical review/public reader; saved quote authorship/ranking/provenance; safe answer re-entry; snake_case mappings resolve. | Answer row-key unique index | Existing Prisma DB and generation-provider configuration; no new editorial production env | Keep safe writers with the unique index. Reverting mappings reintroduces P2022; reverting lifecycle can disagree with persisted statuses. |
| Quality rails: `f85d4b24`, `3714d284` | CI diagnostic budget and five actual-handler core journeys; canonical project-write authorization regression protection | None | CI Node/npm/Prisma generation; optional disposable test DB | Removing rails loses enforcement. Build alone still skips TS/lint; separate checks remain necessary. |
| Deletion Batch 1: `21a3c944`; Batch 2: `e2f8b8cc`; Batch 3: `f017ba38` | Callerless legacy UI/role wrappers, superseded editorial renderer and old interview UI removed. Canonical mounted paths retained. | None | None new | Restore only with caller/contract review; old trees assume superseded lifecycle interfaces. No reason to restore them for deployment. |
| Product attribution: `c5b88e6f` | Unclaimed products remain unowned; display brands no longer create synthetic vendor Users | None | Existing DB | Reverting recreates false identities/ownership. Current source-fingerprint count is zero. |
| Persistence: `50388cb4` | Explicit 410s replace fake data/success; PDF spec sheets use existing imports storage and Selection fields; image update success requires DB persistence; honest email/config failures | None | Existing Supabase imports storage/service role and outbound email configuration | Reverting revives fictional success/local-file state; durable stored URLs should remain readable. |
| Vendor claims: `8de750ea` | Canonical authorized claim queue, atomic terminal states and direct product User ownership; preview tokens no longer authorize claims | None | Existing organization verification/membership data | Old claim endpoints must not be restored as a token bypass; pending and terminal claim semantics must remain compatible. |
| Recorded media: `2d5d8e81`; recorded identity: `e383185e` | Private WebM upload/playback; guarded process/approve/publish states and quote provenance; vendor boosts use canonical User plus membership/project/product context. Same-origin camera/microphone permission restored. | Recorded vendor User FK change | Private interview bucket, storage service role, existing transcription/extraction providers | Code/schema identity rollback is coupled; keep recordings private. See section 9. |

No new recorded creation/boost-request navigation was added: API correctness does not prove every optional leaf component has a mounted entry point. Existing recorded interview pages and boost inbox remain the supported surfaces.

## 5. Migration state and database consistency

Exactly two migration files were added relative to main. Both are recorded applied in the currently configured application database. `prisma migrate status` reports **107 migrations, up to date**. Main has no newer unique migrations, and there is no ordering conflict.

| Migration file under `prisma/migrations/` | Effect / guard | Current state | Rollback implications |
|---|---|---|---|
| `20260904193000_add_row_key_unique_to_editorial_interview_answers/migration.sql` | One unique index on `editorial_interview_answers(interview_id, question_id, is_follow_up)`, using `IF NOT EXISTS`; no DML. Duplicate data would fail index creation; source documents preflight. | Applied; catalog confirms the exact unique index; duplicate groups = 0 | Old re-answer/convert writers can violate the new constraint. Keep corrected writers; removing the index loses stable row-key enforcement. No automatic rollback proposed. |
| `20260909180000_recorded_vendor_user_identity/migration.sql` | Transaction and SHARE ROW EXCLUSIVE locks; explicit guard rejects any non-null session vendor or any boost row. Drops/re-adds only two vendor FKs, targeting `users(id)`: session DELETE SET NULL, boost DELETE CASCADE, both UPDATE CASCADE. | Applied; actual FK catalog and regenerated schema/client agree | Zero data conversion. Repeat execution is guarded only while references remain empty; it intentionally refuses after population. Reversing to historical Vendor requires an explicit identity decision once User refs exist. |

The recorded migration changes no table/column types and contains no inserts, updates, deletes, backfills or historical Vendor removal. Current aggregates: sessions **0**, non-null session vendors **0**, boosts **0**, orphan session vendors **0**, orphan boost vendors **0**, historical Vendors **4**. Missing media references, inconsistent boost context and quote/product mismatches are all **0**. Empty tables prove catalog consistency, not populated migration behavior.

Further read-only evidence:

- `EditorialCategory`, `EditorialAssignment`, and `EditorialEdition` Prisma reads all resolve; each returns zero sampled rows. This establishes mappings, not a populated editorial lifecycle journey. No known prior editorial mapping error remains.
- Synthetic vendor email pattern and exact fixed-path source fingerprint: **0** Users, **0** linked products/memberships/historical Vendor links.
- Products: **175** unclaimed, **16** owned. ProductClaimCandidate rows **0**, VendorProductClaim rows **0**, preview tokens **0**. Confirmed-without-owner, confirmed-reviewer-not-owner and orphan candidates all **0**; no impossible candidate terminal states exist in this snapshot.
- Admin-verified vendor organizations **0**: the new claim workflow correctly requires legitimate verification before a user can exercise that capability. This is an operational feature prerequisite, not justification to weaken authorization.
- Search of active API/library source finds no retired projects/designers/videos JSON state reader or local filesystem business-state writer. Explicit demo JSON imports remain. Existing Supabase analytics JSONL is best-effort telemetry, not authoritative project/claim/interview state; this is not a claim that all JSON usage was removed.
- Private bucket read succeeds: not public, audio/WebM restriction, 20 MiB bucket cap. Application limit remains 4 MiB. No objects were listed or downloaded by this audit.

All new database probes used read-only transactions and emitted only aggregate counts/catalog metadata. Bucket verification was metadata-only. No cleanup or new migration was run. Migration discipline passes: loose SQL **32/32**, phantom delegates **0**, missing SQL **0**, non-idempotent recent DDL **0**. Prisma validate and schema/generated-client sync pass; the latter is not a whole-database drift proof.

## 6. Environment matrix

No variable in this matrix is newly required **before merge**. CI has its own generated-type and fixture setup. No secret values are included. “Local” is not evidence of deployment-provider configuration.

| Variable | Purpose | Required for deploy? | Failure if absent | Verification status |
|---|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Shared production limit backend | **Yes** | All production limiter calls deny; credentials login returns null, signup returns 429 | Real limiter + actual auth handler fixture proof; absent locally; live smoke pending |
| `UPSTASH_REDIS_REST_TOKEN` | Backend authentication | **Yes** | Same; outage/timeout also deny rather than local fallback | Local failure tests; deployment config unknown |
| `RESEND_WEBHOOK_SECRET` | Verify inbound raw-body signatures | For inbound email replies | Webhook 503 before dispatch/DB; invalid signature 400 | Local signature/handler tests; absent locally; live signed delivery not verified |
| `INTERVIEW_MEDIA_BUCKET` | Select the exact private interview bucket | For recorded audio | Upload unavailable, signing/download unavailable; no public fallback | Present locally; bucket metadata live-verified; deployed env/browser flow unknown |
| `RENDER_WORKER_URL` | Exact authenticated HTTPS render endpoint | Only to enable verified renderer | Renderer returns unavailable; static scrape/manual paths remain | Absent locally; client/route tests only |
| `RENDER_WORKER_API_KEY` | Application-to-controller authentication | Only to enable renderer | Worker unavailable; invalid endpoint/key configuration rejected | Absent locally; local authentication tests |
| `RENDER_API_KEY` | Controller current key | Renderer host only | Controller auth/startup contract cannot operate normally | Source/local controller tests; no live host |
| `RENDER_API_KEY_PREVIOUS` | Optional rotation overlap | No | Prior key stops working after rotation | Source/local tests |
| `RENDER_IMAGE_ID` | Immutable local renderer image identity | Renderer host only | Isolation startup refuses unusable image configuration | Local tests; Linux acceptance pending |
| `RENDER_DNS_IPV4` | Trusted public resolver | Optional override on renderer | Uses built-in public resolver default | Source/local policy tests; live network unverified |
| `RENDER_BLOCKED_IPV4` | Additional public control-plane/proxy addresses to deny | Required where those addresses exist | No additional configured denies; automatic local/gateway/private denies remain | Deployment topology inventory and live canaries pending |
| `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` | Existing server-side durable storage and media | Existing core upload requirement; now also media/spec sheets | Storage operations fail | Not newly introduced; live bucket metadata succeeds; hosted deployment not checked |
| `RESEND_API_KEY` | Existing outbound email provider | For supported email-dependent flows | Missing config now reports failure instead of fake send success | Local persistence tests; live delivery not exercised |
| `TYPESCRIPT_BUDGET_BASE_REF` | CI baseline comparison | CI only | Falls back to repository guard behavior; explicit base used in this audit | Local ratchet and guard tests |
| `CORE_TEST_DATABASE_URL`, `CORE_TEST_DATABASE_DISPOSABLE` | Isolated full core Prisma journeys | No, test-only | DB execution group skips without target; unsafe targets/absent acknowledgement rejected | Guard tests pass; live journey parked |
| `EDITORIAL_TEST_DATABASE_URL`, `EDITORIAL_TEST_DATABASE_DISPOSABLE` | Isolated editorial lifecycle DB journey | No, test-only | DB execution group skips; configured unsafe target rejected | Local safety/route tests; live journey parked |
| `RENDER_ACCEPTANCE_RESULTS` | Feed verified Linux results into parity tests | No, verification-only | Linux output-dependent parity test skips | Not supplied |
| `FOLIO_RENDER_TEST_HOST`, `FIXTURE_ORIGIN`, `FIXTURE_PUBLIC_IPV4`, `FIXTURE_ADMIN_KEY`, `FIXTURE_ZONE`, `FIXTURE_TLS_KEY`, `FIXTURE_TLS_CERT` | Dedicated-host interlock and public TLS/DNS acceptance fixtures | No, acceptance-only | Harness/fixture cannot execute authoritative acceptance | Source/harness tests; live run not completed |
| `DIFFICULT_RETAILER_URL`, `DIFFICULT_DNS_IPV4` | Real retailer parity probe and resolver override | No, acceptance-only | Optional real-retailer probe omitted/default resolver used | Parked |

Diff inspection also found references to existing DB/auth/AI/posting configuration (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_ENABLED`, `OPENAI_API_KEY`, `OPENAI_ENABLED`, `POSTING_V1`, `NEXT_PUBLIC_POSTING_V1`, `POSTING_FORCE_FALLBACK`, `NODE_ENV`). These are not new production variables; many added references are isolated test fixture assignments. Preserve existing valid production settings. Legacy Browserless keys no longer enable an unrestricted provider fallback.

### Exact production failure paths

**Authentication — CORE LOOP BLOCKER.** `src/lib/rateLimit.ts` checks production configuration and returns denied before any local-map access. The real credentials provider in `src/app/api/auth/[...nextauth]/options.ts` returns null on the first denied IP check, before user lookup/password validation. An isolated actual-handler probe made every DB access throw: credentials returned null and signup returned 429 with no DB access. Production backend timeout/outage tests also deny. This affects already-authenticated rate-limited operations too, including scraping. OAuth/session existence must not be described as proof that credentials login works.

**Product scraping — OPTIONAL CAPABILITY UNAVAILABLE when rendering is disabled, provided Upstash works.** `/api/scrape-product` validates and uses pinned cheap fetch first. Sufficient static fields bypass browser rendering; absent worker returns null, unavailable/misconfigured worker is caught, and no unrestricted browser is attempted. Existing key-gated AI extraction can still recover text. A blocked page with no recovered fields returns 422 plus explicit manual-entry guidance; empty unreadable content returns 502; transport failure returns 500. Partial content is editable, not falsely asserted complete. `ProductTagPicker` surfaces the API error, automatically opens manual capture for blocked/422/502 and network failures, and retains an explicit manual-entry control for other responses. Catalog selection and manual tagging do not depend on renderer infrastructure. The persisted `/products/[productId]/scrape-bql` path reuses valid cache before rendering; unavailable rendering marks the scoped product scrape failed and returns 502. It does not invent completion. Legacy website/product-image enrichment similarly loses browser-dependent extraction. Live retailer parity is still unproven.

**Recorded audio — OPTIONAL CAPABILITY UNAVAILABLE.** Exact bucket selection is enforced by `mediaBucket()` with no fallback. Missing setting yields a generic upload-unavailable 500; authorized media signing yields 503, and processing cannot download audio. Text interview/posting code does not depend on this bucket. Missing configuration is not a supported complete UI feature toggle: do not advertise/release recorded audio until its deployment configuration and browser flow are verified.

**Inbound Resend — OPTIONAL CAPABILITY UNAVAILABLE.** Missing or malformed signing secret yields 503 even for `email.test`, before matching/persistence. Invalid signatures yield 400. Unrelated app use and outbound mail do not depend on this signing secret; outbound mail still needs its own existing provider configuration. If inbound replies are in the release scope, configure and verify them before release.

## 7. Core-loop release contract

All executed commands below completed successfully. Skips are listed separately.

| Contract | Result and practical limit |
|---|---|
| Journey 1 | Signup, real credentials provider, signed cookie, onboarding and subsequent request pass |
| Journey 2 | Project/room/image upload/product tag and canonical relationship readback pass |
| Journey 3 | Owner/stranger direct requests and organization write authorization pass |
| Journey 4 | Saved interview, deterministic generation, review/publication/public slug identity pass |
| Journey 5 | Mounted collaboration invitation, designer acceptance/readback and unrelated vendor isolation pass |
| `npm run test:core` | 8 passed; **1 DB group skipped**. Actual orchestration with memory DB and external-boundary fixtures; not live services/browser |
| Product attribution | 8 passed, 0 skipped |
| Vendor claims | 17 passed, 0 skipped |
| Persistence | 34 passed, 0 skipped |
| Recorded media (includes boost identity cases) | 33 passed, 0 skipped |
| Security + editorial lifecycle combined | 26 passed, **2 skipped**: editorial DB lifecycle; Linux-rendered parity |
| Renderer controller/worker/harness | 13 passed, 0 skipped; local tests are not kernel acceptance |
| Type preparation + ratchet | Pass; **904 diagnostics / 574 fingerprints / 233 files**, 0 added; compared with origin/main, which has no prior baseline, so initial-baseline review remains explicit |
| Ratchet guard tests | 5 passed, 0 skipped |
| Product Record invariants | All three checks clean |
| Quotes/provenance | Quote audit and pull-quote checks pass |
| Editorial generation checks | Single generator, bounds, room matching, story editing, regeneration surfaces, generation context and product naming pass |
| Client-import guard | Pass |
| Prisma validate / generated-client sync / migrate status / migration discipline | Pass |
| Production build | Exit 0; all 150 static pages generated |
| Full CI ESLint command | Exit 0; **0 errors, 3,333 warnings** |
| IDOR scan | 559 routes scanned: 0 critical, 1 high, 15 medium, 11 low; not a zero-findings claim |

The IDOR high is `products/route.ts` conditional `updateMany`: `vendorId: null` plus unchanged-empty-field predicates constrain add-only enrichment. Its scanner message overlooks these predicates; actual P0 regression coverage verifies the write conditions. Retired routes produce no new finding. Remaining static warnings are recorded as follow-up, not hidden by changing the scanner.

The build still warns about pre-existing `FaNotes` in admin organizations and `getServerSession` in generated-image feedback; both callers and `src/lib/auth.ts` have no branch diff. It also emits dynamic-prerender notices and stale browser-data warnings. Build skips type/lint by existing configuration, so the separate passing checks above matter. No P2022 editorial mapping failure appeared.

Windows shell adaptation: ordinary story-editing/regenerate-surfaces/generation-context invocations initially failed because cmd lacks `grep`/`true`. Their unchanged scripts then passed with the existing Git Bash `execSync` preload, as did pull-quotes. These initial harness failures are not recorded as product passes.

Local evidence is saved in `tasks/readiness-*.txt`, `tasks/readiness-idor.md`, and aggregate-only audit outputs. Temporary audit probes are local artifacts, not new application code. Supporting committed architecture/session reports remain under `docs/` and `docs/audits/`.

## 8. Parked gates

| Gate | Implementation | Live verification | Merge blocker? | Deploy blocker? | Feature blocker? |
|---|---|---|---|---|---|
| Linux renderer | Isolated worker/controller/acceptance harness implemented | **NOT completed**: adversarial kernel/network cases and live product parity; earlier run executed no network cases | No, while disabled | No for core release with worker unconfigured | **Yes** before renderer enablement |
| Upstash | Distributed fail-closed limiter implemented | Independent-process/host shared limit and reset smoke **pending** | No, if production deployment is held | **Yes**: credentials/signup/core limited operations | Not merely optional |
| Disposable DB journeys | Explicit safety-interlocked core and editorial harnesses implemented | Both execution groups skipped, targets absent | No under the explicitly parked verification scope | No new universal gate inferred; confidence limitation remains | No; follow-up verification |
| Live media upload/browser compatibility | Private storage, state guards, format checks and owner access implemented | Bucket metadata verified; browser WebM/Opus record→upload→process→approve→publish and playback not run | No | Not for core text publishing with media unreleased | **Yes** before recorded media release |

Also unrun: live signed Resend delivery, live generation/provider smoke, hosted staging browser core journey, and production process-restart behavior. Local fixture tests do not establish these. No skipped group is counted as passed. P0 implementation was not reopened and no infrastructure was provisioned.

## 9. Rollback

**An arbitrary old-code rollback after these migrations is not safe.**

- Recorded vendor FK: columns remain text but identity semantics changed from historical Vendor to User. Old Prisma relations can resolve the wrong table and old Vendor-ID inserts can fail FK checks. Once new User references exist, reversing the FK requires explicit mapping/data review; current zero rows are not a lasting guarantee. Coordinate code/schema rollback or retain the canonical identity code.
- Answer unique index: old insert-on-reanswer writers can fail with P2002. Keep the safe writer commits even in a targeted rollback. Durable quote pointers depend on the stable answer key.
- Editorial: repaired mappings represent existing database columns, so reverting them restores a known runtime failure. Persisted lifecycle states and canonical public reader must remain aligned.
- Private media: retain the private bucket, object keys and metadata. Old code expecting public URLs cannot read internal storage references. Never make the bucket public to make a rollback work; retain the authorized signing path or withhold recorded media.
- Claims/attribution: old preview ownership and synthetic-user code reintroduce integrity/security defects; existing claim terminal states and direct User ownership cannot be treated as display metadata.
- 410 APIs: restoring handlers restores fake persistence or removed local-file assumptions. There is no data rollback needed for constant tombstones.
- Rate limiting: preserve shared configuration and fail-closed behavior. A code rollback to process-local production counters weakens enforcement; disabling Redis is not an availability-safe rollback.
- Scraper/renderer: application renderer settings can be removed to disable browser enrichment; static/manual flow remains. Do not restore unrestricted Browserless as fallback. Worker/image rollback requires acceptance on the exact network boundary being deployed.

Recorded processing remains synchronous: a hard process kill can leave an in-progress state, and compensating storage deletion can fail. Existing conditional guards protect integrity but do not provide durable crash recovery. This is a stated optional-media operational limit, not a new implementation project in this audit.

## 10. Branch statistics and reviewability

Counts are relative to fetched main at the audited application SHA, before this documentation commit:

| Metric | Count |
|---|---:|
| Unique commits | 30 |
| Changed files | 280 |
| Deleted files | 52 |
| All lines added / removed | 15,936 / 16,521 |
| Production lines added / removed | 3,501 / 15,859 |
| Added migration files | 2 |
| Added test files (`*.test.*`) | 17 |
| Changed API route files | 83 |
| Added API route files | 2 |
| Retired API route files retained as 410 | 30 |
| Added root direct dependencies | 5 |

Production LOC means `src/**`, root middleware, and renderer implementation/deployment files, excluding renderer tests/docs/lockfile and seccomp policy JSON. These are textual diff line counts, not executable statements. All-line counts include docs, tests, lockfiles and the diagnostic baseline. This documentation commit adds one new report and modifies the already-counted todo file: 31 commits / 281 changed files after it, with production LOC unchanged.

Added routes: `/api/admin/editorial-review`, `/api/interviews/[id]/media`.

Added root dependencies: `@upstash/ratelimit`, `@upstash/redis`, `ipaddr.js`, `puppeteer-core`, `svix`. The new standalone worker package separately pins `ipaddr.js` and `puppeteer-core` (two declarations of already-counted package names). No dependency installation/upgrade was performed by this audit.

Retired routes, relative to `/api/`:

- `assign-projects`, `designer/folders/[id]/assign-sections`, `event-import`, `events/[id]/live-activity`.
- `export-all-tagged-products`, `export-project-tags`, `export-tearsheet`, `get-designer-profile`, `inspire`.
- `interviews/[id]/confirm-upload`, `interviews/[id]/upload-url`, `projects/[id]/notify-vendors`, `projects/handoff`.
- `rep-contacts/request-spec`, `set-active-profile`, `update-designer-profile`, `vendor-actions/create-appreciation-dinner`.
- `vendor/actions/confirm-spec`, `vendor/actions/invite-event`, `vendor/actions/priority-support`, `vendor/actions/promote-project`.
- `vendor/claim-product`, `vendor/invite-designer`, `vendor/qbr`.
- `vendor/projects/[id]/quick-actions/extend-discount`, `invite-to-event`, `offer-boost`, `request-missing` (same prefix).
- `videos/[id]`, `videos/clips`.

Each retained method returns a stable error/code-only 410; persistence, claims and media suites execute the relevant tombstones without DB/storage effects. Legacy preview page renders a retirement notice without consuming a token or authorizing ownership. Replacements/limitations are documented in the persistence and canonical claim reports. External client traffic was not available, so retained URLs deliberately explain retirement rather than disappearing.

## 11. Recommended landing strategy

**LAND AS ONE PR**

Review the workstream groups above within one atomic landing. The quote index depends on safe writers; editorial mapping/lifecycle/deletion agree on one rendering contract; shared core fixtures verify attribution, claims and recorded identity as a stack. Both migrations are already applied to the configured DB. Artificial cherry-pick groups would require re-proving intermediate schema/writer/reader states, adding risk without a demonstrated independent release benefit. Preserve the existing commit history for review; no split/cherry-pick operation was performed.

## 12. Required actions before production

1. Configure valid shared Upstash credentials on every production instance; pass the existing independent-process/host limit, rejection and window-reset smoke, then verify credentials login/signup against that configured release. Keep any main-triggered production deployment held until this is done.
2. Keep renderer unconfigured until authoritative Linux adversarial acceptance and live extraction parity pass. Recorded media remains unreleased until deployed private-bucket/service configuration and the live supported-browser recording/playback journey pass. Configure and verify the Resend signing secret if inbound replies are part of the release.
3. Deploy against the audited schema state. The currently configured DB already has both migrations; any different target must be checked and migrated in order under their guards. Do not run identity conversion implicitly or pair this release with incompatible old vendor code.

No new migration, TypeScript cleanup, deletion batch or hardening phase is required by this audit.

## 13. Final recommendation

Merge the verified integrity stack as one PR with production deployment held; establish Upstash first, then release the core loop while keeping unverified optional renderer/media capabilities unavailable.

# Persistence integrity — session report

Date: 2026-09-09  
Branch: `codex/folio-hardening`  
Starting commit: `c5b88e6f04738531bbcfebba3cff43db4b886e31`

## Outcome

Legacy compatibility URLs now return explicit HTTP 410 responses rather than fictional account data or successful no-ops. Mounted PDF spec sheets use existing Supabase document storage and existing Selection fields. Image re-upload success requires the canonical database update. Upgrade request details are recorded for claimed as well as unclaimed organizations, with active membership required. Missing email configuration cannot acknowledge delivery.

No database models, migrations, dependencies, storage buckets, production records or infrastructure were created or modified. Product attribution, Great Delete batches, editorial consolidation and parked P0 work were not reopened.

## Persistence integrity map

Route names below are relative to `/api/`; exact source files are `src/app/api/<route>/route.ts`. Page and component paths are explicitly named. Classification describes the **before** state. “Callerless” means no executing repository caller was found, not that external clients cannot exist. All retired URLs remain mounted with constant 410 error bodies, without authentication-dependent data, reads or side effects.

| Surface / methods | Current callers found before changes | Backing store / actual behavior before | Canonical replacement or current alternative | Classification | Action |
|---|---|---|---|---|---|
| get-designer-profile GET | None | Hard-coded Sarah Chen profile for any supplied ID | /profile → auth/me GET; designer/profile and current biography flow | CALLERLESS BUT EXTERNALLY UNCERTAIN | 410 |
| update-designer-profile POST | None | Echoed submitted profile, updated timestamp, success; no write | /profile → auth/me PUT | CALLERLESS BUT EXTERNALLY UNCERTAIN | 410 |
| set-active-profile POST | None | Echoed role/profile ID; no database change | Current authenticated profile/account context, different semantics | CALLERLESS BUT EXTERNALLY UNCERTAIN | 410 |
| assign-projects POST | None; reassign-projects CLI is independent Prisma tooling | Missing projects.json/designers.json; round-robin JSON write; swallowed write errors | Current Project ownership/collaboration flows; no equivalent global round-robin operation | CALLERLESS BUT EXTERNALLY UNCERTAIN | 410 |
| export-all-tagged-products GET | src/app/admin/export/page.tsx | Missing projects.json became successful empty global export | Project-specific canonical exports | LIVE + BROKEN LEGACY | Retire API/page together |
| export-project-tags GET | None | Old embedded JSON tags, CSV/JSON; missing project → 404 | projects/[id]/export-spec reads ProductTag; project export reads Selection | CALLERLESS BUT EXTERNALLY UNCERTAIN | 410 |
| export-tearsheet GET | None | HTML tearsheet from missing JSON project database | Current project specification export | CALLERLESS BUT EXTERNALLY UNCERTAIN | 410 |
| src/app/admin/export/page.tsx | Direct admin URL | Client-only role redirect; broken aggregate export and mismatched CSV field names | Export within the relevant project | LIVE + BROKEN LEGACY | Server-authenticated, DB-admin-checked retirement notice |
| videos/[id] GET/PUT/DELETE | None | Missing videos.json; GET mutated view count; PUT/DELETE rewrote local file | InterviewSession + MediaAsset recording workflow; not an equivalent standalone-video contract | CALLERLESS BUT EXTERNALLY UNCERTAIN | All old methods 410 |
| videos/clips GET/POST | None | Missing videos.json; GET masked absence with successful empty list; POST stored metadata only, no actual clip extraction | QuoteHighlight on recorded interviews | CALLERLESS BUT EXTERNALLY UNCERTAIN | Both methods 410 |
| upload-spec-sheet POST | src/app/vendor/project/[id]/rooms/[roomId]/page.tsx | Wrote src/public/uploads/spec-sheets; returned /uploads URL dependent on deployment disk | Supabase imports bucket + Selection.specSheetUrl/specSheetFileName | LIVE + BROKEN LEGACY | Migrate PDF upload; project write authorization; fail on storage error |
| projects/[id]/images/reupload-client POST | InstagramExportModal | Supabase object upload, but returned success after failed ProjectImage update | Existing ProjectImage.url | LIVE + BROKEN LEGACY | Require project write access and DB success; 500 on failed save |
| inspire GET/POST | None | Fictional feed; POST created response object only, never stored it | Published projects; no compatible old feed/post model | CALLERLESS BUT EXTERNALLY UNCERTAIN | 410 |
| event-import GET | ConciergeEventCreate, mounted by events/create | Invented event metadata based on URL substring | Manual event entry and existing event persistence | LIVE + BROKEN LEGACY | 410; caller displays unsupported message/manual-entry guidance |
| projects/handoff GET/PUT/POST | PUT: projects/[id]/claim page. No GET/POST caller found | GET fictional project; PUT fictional ownership transfer. POST did write Prisma project/visit, but was a callerless, partial-write older handoff implementation | Current vendor project/visit flows; separate collaboration-story invitation/acceptance is exercised by core journey 5 | LIVE + BROKEN LEGACY (PUT); CALLERLESS BUT EXTERNALLY UNCERTAIN (GET/POST) | Retire old contract as a unit; no silent semantic wrapper |
| designer/folders/[id]/assign-sections POST | FolderAssignPanel, mounted by designer/folders/[id] | Verified rows, then reported section changes without writing them | No equivalent section persistence in old folder contract | LIVE + BROKEN LEGACY | 410; propagate explicit error, no local success update |
| vendor/projects/[id]/quick-actions/offer-boost POST | QuickActions dynamic URL builder, mounted by vendor/dashboard/VendorDashboardClient | Session/project checks then constant ok; no request stored | Current canonical vendor boost/collaboration workflows | LIVE + BROKEN LEGACY | 410 |
| vendor/projects/[id]/quick-actions/invite-to-event POST | Same mounted QuickActions builder | Checks then ok; no invitation | Current event invitations | LIVE + BROKEN LEGACY | 410 |
| vendor/projects/[id]/quick-actions/extend-discount POST | Same mounted QuickActions builder | Checks then ok; no discount | No matching canonical operation | LIVE + BROKEN LEGACY | 410 |
| vendor/projects/[id]/quick-actions/request-missing POST | No caller | Checks then ok; no request | No matching canonical operation | CALLERLESS BUT EXTERNALLY UNCERTAIN | 410 |
| vendor/actions/promote-project POST | VendorQuickActionsMenu → project/[id]/SpecsQuotesPanel | updatedAt/analytics only; no promotion queue | Existing editorial/boost workflow, different contract | LIVE + BROKEN LEGACY | 410; surface response error |
| vendor/actions/priority-support POST | Same menu | Notes or updatedAt, analytics; no support request/queue | No supported equivalent | LIVE + BROKEN LEGACY | 410 |
| vendor/actions/confirm-spec POST | Same menu | Selection note on one branch; project branch only updatedAt; no reliable spec-change contract | Existing project selections/specifications | LIVE + BROKEN LEGACY | 410 |
| vendor/actions/invite-event POST | Same menu | Fabricated invitation ID, analytics only | Current event invitation workflow | LIVE + BROKEN LEGACY | 410 |
| vendor-actions/create-appreciation-dinner POST | CreateAppreciationDinnerModal via vendor insight cards | Fictional guests, venue recommendations and account economics from sample data | Manual event creation | LIVE + BROKEN LEGACY | 410; existing modal error path retained |
| rep-contacts/request-spec POST | ProductForm | Logged “would send email”, then “Spec request sent” | Contact representative directly/current email workflow | LIVE + BROKEN LEGACY | 410; existing non-2xx handling retained |
| events/[id]/live-activity GET | LiveActivity | Returned empty list regardless of persisted event activity | No equivalent implemented reader in old contract | LIVE + BROKEN LEGACY | 410; UI displays unavailable instead of “no activity yet” |
| vendor/invite-designer POST | SmartInvitesCard string caller; no mounted card importer found | Optional edge upsert with swallowed errors; no email; always successful invitation message | Current event invitations | CALLERLESS BUT EXTERNALLY UNCERTAIN outside the unused card | 410; replace fake-success card with notice/link |
| vendor/qbr GET | QBRExportButton | Unconditionally accessed client demo store; sample export or server/client-boundary error | No current equivalent canonical quarterly report | LIVE + BROKEN LEGACY | 410; export button replaced with notice |
| src/app/designer/analytics/page.tsx | Link from designer dashboard | Imported two sample JSON files as “Your Analytics”; local boost confirmation and fake review-sent alert | Designer dashboard/current projects | LIVE + BROKEN LEGACY | Retirement notice; retain sample JSON files unused |
| orgs/share-upgrade-request POST | ProfessionalUpgradeModal | Claimed-org branch updated contact timestamp but omitted requested details; UI falsely said emailed | Existing Organization.salesNotes/salesContactedAt | LIVE + BROKEN LEGACY | Persist details for both states; require active membership; UI says recorded, no email |
| src/lib/email/sendEmail.ts | Claim-invite email, email send/reply, recap and notification callers | Both send helpers returned success with no provider configured | Existing configured Resend integration | LIVE + BROKEN LEGACY (unconfigured branch) | Return failure; configured delivery path unchanged |
| VendorAnalyticsDashboard | vendor/dashboard feature-selected analytics view | Immutable fictional vendor figures lacked an explicit sample-data description | Explicit demo presentation | LIVE + BROKEN LEGACY presentation | Label as demo, fictional data, not account analytics; no new persistence |
| auth/me GET/PUT; designer/profile; canonical project exports | Profile and project UIs | Prisma user/project/tag/selection reads/writes | Already canonical | LIVE + CANONICAL | Keep |
| interviews/[id]/upload; recorded interview pages/process/status/approval | RecordingInterface, InterviewStatusView, designer interviews/boost flow | Supabase object storage + Prisma InterviewSession/MediaAsset/QuoteHighlight | Already canonical model design | LIVE + CANONICAL authority; pre-existing runtime limits below | Keep unchanged |
| src/lib/vendor-data demoStore/demoState and adapters | Explicit vendor demo flag or demo URL; DemoStateProvider | Immutable seeds + namespaced browser localStorage | Explicit demo only | DEMO-ONLY EXPLICITLY | Keep |
| src/lib/events.ts getLiveActivity | No callers found | Hard-coded sample activity helper | None | DEAD | Leave unused helper; HTTP route separately retired |
| event-concierge/parse; orb-agent fallback | Event input assistant/system-map assistant | Input-derived heuristics or general explanatory text, not account persistence | Existing non-mutating assistance | LIVE + CANONICAL with respect to persistence | Keep; parser/LLM quality outside this task |
| vendor/projects/kpi; vendor/events/kpi | Vendor KPI adapters | Null metrics indicate unavailable data; no fabricated counts or writes | Future actual metrics | LIVE + CANONICAL with respect to truthful unavailable values | Keep |

### Authentication, authorization, jobs and external evidence

Before retirement: profile GET, legacy exports, live activity, QBR, and handoff GET were public. Profile update/switch, assignment, inspire, folder assignment, dinner planning, representative requests and vendor-invite checked sessions; folder assignment checked folder ownership; video PUT/DELETE checked ownerId; clips POST checked session without video ownership. The four project quick actions checked session + project write access. The four vendor action handlers used canVendorUseQuickActions where applicable, but their acknowledged business actions were not durably implemented. Handoff PUT trusted requested designer identity for the fabricated response; old POST used a session/JWT/development-header resolver.

After retirement, no caller identity is needed to receive the same constant public 410. Explicit IDOR002/IDOR005 annotations describe that narrow reason; regression tests verify every retained method returns only an error/code, without database or storage access. The scanner itself was not changed.

For surviving affected mutations, upload/re-upload use server session identity and assertProjectWrite; upgrade requests require an active OrganizationUser membership. Admin export notice reads the current User.role rather than trusting a client role. The email route's existing session, membership and token checks remain intact.

Repository source, scripts and historical documentation were searched for literal and dynamic URL builders. No executing job/script callers of the retired APIs were found. The independent scripts/reassign-projects.ts uses Prisma and does not call the retired assignment API. Historical audit/docs references are not external-usage evidence. No production traffic logs, client registry or external bookmark inventory were available. URLs were retained as explicit 410s for this reason; lack of repository callers was not used to silently delete them.

## Fake-success findings

The following previously acknowledged an action without its promised durable result:

- update-designer-profile POST; set-active-profile POST; inspire POST; projects/handoff PUT; folder assign-sections POST.
- assign-projects POST swallowed filesystem write errors; with missing seed files it instead returned a validation error.
- All four vendor/project quick actions returned ok without creating their claimed business records.
- Vendor promote-project, priority-support, confirm-spec and invite-event acknowledged operations unsupported by their timestamp/note/analytics-only implementation.
- vendor/invite-designer acknowledged invitation even with no event/failed edge write and never sent email; its card also marked failed HTTP/network requests as invited.
- rep-contacts/request-spec reported an email sent while only logging it.
- upload-spec-sheet reported a usable upload from deployment-local src/public storage; the returned URL did not establish durable hosted storage.
- Image re-upload explicitly reported success after a caught ProjectImage update failure.
- Organization upgrade requests omitted requested details in the claimed branch; the UI separately claimed delivery to the owner without sending email.
- Both email helper no-configuration branches acknowledged sending without a provider.
- Designer sample analytics confirmed boosts/review requests solely in component state/alerts.
- Legacy videos, when a file existed, acknowledged only instance-local JSON changes; clip creation wrote metadata without extracting a clip. These files are currently absent, so most mutation attempts failed before reaching that branch.

Separate false-read findings: fictional profile and handoff GETs, inspiration posts, URL-derived fictional events, sample dinner plans/QBR/account analytics, successful empty global exports and missing-video clip lists. These were retired or explicitly labeled; they are not described as failed database writes.

## JSON and filesystem findings

| File/store | Exists? | Old access and mounted use | Final status |
|---|---|---|---|
| src/data/projects.json | No | Assignment R/W; three export readers; admin export mounted | All affected APIs 410; admin notice; no runtime authority |
| src/data/designers.json | No | Assignment read | Assignment 410 |
| src/data/videos.json | No | videos/[id] GET view update + PUT/DELETE R/W; clips GET/POST R/W; no old-route caller found | Both APIs 410 |
| src/public/uploads/spec-sheets | No tracked durable backing; directory was created on demand | Mounted upload wrote bytes locally and returned /uploads URL | Removed filesystem dependency; PDF objects in imports bucket |
| src/data/designer_analytics.json | Yes | Static read on mounted designer analytics page, represented as user data | File retained; page retired, no remaining runtime import |
| src/data/designer_projects.json | Yes | Same | File retained; page retired, no remaining runtime import |
| src/data/demo/vendor/{projects,designers,events}.json | Yes | Immutable demo seeds, browser localStorage editing in named demo stores | Keep explicit demo usage; production QBR access retired |
| src/scripts/audit-ai-coverage.ts dump output | Tooling | Writes developer audit output | Keep; not a production business-state endpoint |

Post-change filesystem search across src finds no affected API/server filesystem writer or missing-root-JSON reader. Browser CSV/Blob downloads and JSON generated from Prisma are exports, not local databases.

### Module-local state

- lastGoodFollowups maps in the two posting/interview followup handlers cache generated question suggestions. They are not the saved answer/project authority; canonical interview writes remain separate.
- Instagram analysisCache is an image-analysis performance cache.
- rateLimitStore is the existing environment-specific limiter fallback. Security infrastructure is parked and unchanged.
- Demo stores use explicitly named localStorage keys and sample seeds; no production account persistence is claimed.
- Editorial queue reads Prisma EditorialQueueItem. Per-request arrays, Sets, lookup maps, prompt banks and constant spec lists are not stores.
- The inspiration array and fake POST were removed from the API.

## Profile and project/export outcomes

Both mock profile APIs and the old profile switch return 410; no semantic compatibility wrapper was introduced. /profile continues using auth/me GET/PUT against Prisma User. Current designer profile and biography surfaces were preserved.

All three old JSON exports were retired. The global admin export's old nested-image-tag representation and mismatched CSV fields were not rebuilt into a new aggregation product. The administrator gets a server-checked notice directing them to current project exports. Existing projects/[id]/export, designer/projects/[id]/export and projects/[id]/export-spec remain unchanged and use canonical Project/Selection/ProductTag data. Bulk assignment's round-robin ownership semantics were retired.

PDF spec sheets now use the existing **imports** bucket, UUID object names under projects/<projectId>/spec-sheets, a 10 MB application limit and project write authorization. A read-only bucket metadata audit verified imports is public and permits application/pdf. It also showed event-images permits only image/* up to 5 MB; using that bucket would have been incorrect. DOC/DOCX/TXT are explicitly unsupported rather than silently accepted into incompatible storage. The UI advertises PDF only.

Upload success means the object upload succeeded. Saving its URL onto Selection remains a separate mutation; tests exercise a separate canonical create/read. An abandoned selection can leave an unassociated uploaded object. No atomic storage/database transaction, process restart or garbage-collection guarantee is claimed.

## Video outcome and limits

The standalone JSON video APIs have no connection to the current recorded interview handlers and no repository caller was found. Their old GET/PUT/DELETE/clip methods now return 410. No media model, recorded route, boost route or interview component was deleted.

RecordingInterface posts to interviews/[id]/upload; that handler verifies createdByUserId, uploads to Supabase and writes MediaAsset + InterviewSession. InterviewStatusView calls process/status and links to approval; approved quotes use QuoteHighlight. This is distinct from videos.json metadata.

VideoUploader and the old vendor room photo upload still refer to /api/videos/upload, whose route does not exist. VideoUploader has no mounted importer found. The vendor room caller checks non-2xx and does not claim success; this pre-existing missing photo-upload path was not rebuilt.

Recorded upload authorization, storage failure and separate MediaAsset/InterviewSession readback pass through the unchanged real handler using external-boundary doubles. Current recording and realtime components also pass initial SSR/import checks. **This does not prove a working live recorded upload.** The unchanged recorded handler still targets the image-only bucket, which the read-only audit shows rejects audio. Existing recorded pages/status also refer to relation names absent from the current Prisma mapping; those diagnostics were already present and remain outside this compatibility-retirement task. No microphone, hydration, real media processing or live DB journey was executed.

## Verification

- npm run test:persistence: **34 passed**. Covers every retired route/method anonymously and authenticated; no DB/storage access; upload validation/auth/write/read and storage failure; re-upload DB failure; server admin-role checks; upgrade persistence/membership; missing email configuration; retired UI notices; explicit vendor demo label.
- npm run test:core: **8 passed, 1 live-database group skipped**. All five journeys passed: (1) signup/credentials/session/onboarding; (2) project/room/image/product tagging/readback; (3) owner/stranger/org authorization; (4) interview/generation/review/publication/slug; (5) vendor collaboration invitation/designer acceptance/readback/isolation.
- Existing recorded/realtime/component smoke: **passed**, SSR/import scope only.
- Type preparation: **passed**. TypeScript: **988 → 985 diagnostics; 625 → 622 fingerprints; 253 → 251 files; zero new fingerprints**. Lower baseline committed.
- Ratchet guard tests: **5 passed**.
- Client-import guard: **passed**.
- IDOR: **558 routes; 0 Critical / 1 existing High / 16 Medium / 11 Low**. Before: 0/1/16/19. Retirement annotations suppress only constant-error handler false positives.
- Changed-source lint: **0 errors, 47 existing warnings**.
- Prisma validate: **passed**. Migration discipline: **passed**, 32 grandfathered loose SQL / 0 phantom delegates / 0 missing SQL / 0 non-idempotent recent DDL.
- Production build: **passed on final source**. Final post-build TypeScript check: **985/985, zero new fingerprints**.
- No live production write, storage upload, email delivery, database migration or deployment performed. Bucket metadata was read only.

## Exact changes

No files deleted. No HTTP route paths removed. No page paths removed. **26 API paths explicitly retired**; the admin export and designer sample analytics page paths now render retirement notices.

The scoped change contains **47 files**: 42 existing production source files, three existing support files (package.json, tasks/todo.md, tools/typescript-baseline.json), and two new files (this report and scripts/persistence/integrity.test.cjs). Production source reduction: **3,567 net lines** (280 added, 3,847 deleted).

PRISMA SCHEMA CHANGES: NONE

Prisma query effects are limited to the admin role lookup, canonical project-write authorization on affected uploads and persisting upgrade details for claimed organizations. Existing Selection and ProjectImage fields are reused; no schema or migration edits.

Exact source file list, added/deleted line counts and prior activity are appended below. Test/tooling changes: package.json adds test:persistence; scripts/persistence/integrity.test.cjs is new; tools/typescript-baseline.json lowers debt; tasks/todo.md records the work; this report is new. Raw task logs remain local untracked evidence.

## Durability rule after

**NO** affected mounted production flow uses process memory or deployment-local JSON/files as its business-state authority. Retired actions fail explicitly; surviving affected persistence uses existing Prisma/Supabase boundaries. Explicit demo data and non-authoritative caches remain.

## Deferred compatibility questions

None. Unknown external usage is handled by retained, explicit 410 contracts, not by retaining known broken behavior. The three callerless older interview endpoints were not changed.

## Final status

All scoped implementation and verification checks are complete. Live database and media limitations are explicitly documented above; they are not claimed as passed.

## Changed source files and prior Git activity

Each row is a changed file, not a deleted path. History is the last pre-session commit touching that file.

| File | Added lines | Deleted lines | Previous activity |
|---|---:|---:|---|
| src/app/admin/export/page.tsx | 20 | 318 | b51f89b5 2026-04-06 feat: bulk migrate 555 files to canonical color tokens |
| src/app/api/assign-projects/route.ts | 7 | 99 | 2dda803d 2026-04-13 Bucket D (partial) + fix real SQL injection in messages/inbox |
| src/app/api/designer/folders/[id]/assign-sections/route.ts | 6 | 66 | b7fac084 2026-06-08 Use the shared Prisma singleton in all API routes |
| src/app/api/event-import/route.ts | 6 | 122 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/events/[id]/live-activity/route.ts | 7 | 23 | b6bd7356 2026-04-13 Patch all 71 Critical IDOR findings |
| src/app/api/export-all-tagged-products/route.ts | 7 | 73 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/export-project-tags/route.ts | 6 | 178 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/export-tearsheet/route.ts | 7 | 286 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/get-designer-profile/route.ts | 7 | 55 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/inspire/route.ts | 6 | 198 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/orgs/[orgId]/claim-invite/email/route.ts | 1 | 2 | 2c78fd2d 2026-05-26 feat(auth/org-setup): request-based joins, founder/member fork, publish gating |
| src/app/api/orgs/share-upgrade-request/route.ts | 2 | 6 | d47c9d2e 2026-02-04 Add professional tier upgrade modal for image generation |
| src/app/api/projects/[id]/images/reupload-client/route.ts | 7 | 8 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/projects/handoff/route.ts | 7 | 230 | 2dda803d 2026-04-13 Bucket D (partial) + fix real SQL injection in messages/inbox |
| src/app/api/rep-contacts/request-spec/route.ts | 7 | 129 | 093bbc45 2026-01-22 Add vendor rep contact section to edit product form |
| src/app/api/set-active-profile/route.ts | 7 | 34 | 2dda803d 2026-04-13 Bucket D (partial) + fix real SQL injection in messages/inbox |
| src/app/api/update-designer-profile/route.ts | 7 | 40 | 2dda803d 2026-04-13 Bucket D (partial) + fix real SQL injection in messages/inbox |
| src/app/api/upload-spec-sheet/route.ts | 31 | 68 | 2dda803d 2026-04-13 Bucket D (partial) + fix real SQL injection in messages/inbox |
| src/app/api/vendor-actions/create-appreciation-dinner/route.ts | 6 | 277 | 2dda803d 2026-04-13 Bucket D (partial) + fix real SQL injection in messages/inbox |
| src/app/api/vendor/actions/confirm-spec/route.ts | 6 | 92 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/vendor/actions/invite-event/route.ts | 6 | 88 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/vendor/actions/priority-support/route.ts | 6 | 75 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/vendor/actions/promote-project/route.ts | 6 | 75 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/vendor/invite-designer/route.ts | 6 | 74 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/vendor/projects/[id]/quick-actions/extend-discount/route.ts | 6 | 19 | b6bd7356 2026-04-13 Patch all 71 Critical IDOR findings |
| src/app/api/vendor/projects/[id]/quick-actions/invite-to-event/route.ts | 6 | 20 | b6bd7356 2026-04-13 Patch all 71 Critical IDOR findings |
| src/app/api/vendor/projects/[id]/quick-actions/offer-boost/route.ts | 6 | 20 | b6bd7356 2026-04-13 Patch all 71 Critical IDOR findings |
| src/app/api/vendor/projects/[id]/quick-actions/request-missing/route.ts | 6 | 19 | b6bd7356 2026-04-13 Patch all 71 Critical IDOR findings |
| src/app/api/vendor/qbr/route.ts | 3 | 30 | f0ae2110 2026-01-08 Force dynamic rendering for all API routes |
| src/app/api/videos/[id]/route.ts | 8 | 161 | ccb45f6e 2026-04-13 Videos/[id]: enforce owner-only PUT and DELETE |
| src/app/api/videos/clips/route.ts | 7 | 137 | 2dda803d 2026-04-13 Bucket D (partial) + fix real SQL injection in messages/inbox |
| src/app/designer/analytics/page.tsx | 5 | 494 | b51f89b5 2026-04-06 feat: bulk migrate 555 files to canonical color tokens |
| src/app/vendor/project/[id]/rooms/[roomId]/page.tsx | 4 | 3 | b51f89b5 2026-04-06 feat: bulk migrate 555 files to canonical color tokens |
| src/components/ConciergeEventCreate.tsx | 4 | 5 | 049cd9ae 2026-05-01 Consolidate accent color: one gold, two roles |
| src/components/events/LiveActivity.tsx | 14 | 3 | b51f89b5 2026-04-06 feat: bulk migrate 555 files to canonical color tokens |
| src/components/projects/FolderAssignPanel.tsx | 4 | 4 | b51f89b5 2026-04-06 feat: bulk migrate 555 files to canonical color tokens |
| src/components/upgrade/ProfessionalUpgradeModal.tsx | 7 | 7 | b51f89b5 2026-04-06 feat: bulk migrate 555 files to canonical color tokens |
| src/components/vendor/SmartInvitesCard.tsx | 7 | 211 | b51f89b5 2026-04-06 feat: bulk migrate 555 files to canonical color tokens |
| src/components/vendor/VendorAnalyticsDashboard.tsx | 2 | 2 | 5ca79e7a 2026-07-21 phase2: remove Grok vendor-analytics chat + shelve discovery-lunch demo |
| src/components/vendor/VendorQuickActionsMenu.tsx | 3 | 2 | b51f89b5 2026-04-06 feat: bulk migrate 555 files to canonical color tokens |
| src/components/vendor/ai/QBRExportButton.tsx | 2 | 92 | fb393635 2026-05-01 Enforce canonical type scale across the codebase |
| src/lib/email/sendEmail.ts | 2 | 2 | d14e0785 2026-06-15 Phase 3b: provider cost wrappers writing CostEvent |

Source totals: 42 files changed; 280 added lines; 3847 deleted lines; 3567 net lines removed.

PERSISTENCE INTEGRITY COMPLETE

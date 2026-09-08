# Editorial consolidation — 2026-09-08

P0 is parked. No renderer changes or infrastructure provisioning.

## Before (source audit before implementation)

```text
Admin editorial-review → editorial-submissions → module arrays + projects.json
                                               pending/approved/rejected booleans
Project → interview answers/provenance → generation → ProjectPost
                                                   DRAFT/REVIEW/PUBLISHED/ARCHIVED
PublishWorkflow / usePublishFlow → publishEditorial → ProjectPost + Project
Posting status API → separate transition implementation → ProjectPost + Project
Project dashboard → publishProjectAction → public Project (story optional)
ProjectPost → /p/[slug], feed, magazine
EditorialAssignment/Category → edition scheduler and public curation queries
```

| Surface/model | Classification | Evidence / decision |
|---|---|---|
| ProjectPost | CANONICAL | Unique projectId; generated blocks, persisted status, public slug |
| Project | CANONICAL | Ownership, media, optional story; visibility must agree with post transitions |
| EditorialInterview / Answer / realtime interview | SUPPORTING | Captured source material, distinct from publication status |
| EditorialDraft | LEGACY | No active create/generate/read path; room deletion still maintains historical rawState. Preserve records/model pending data retirement; do not treat as lifecycle authority |
| /api/editorial-submissions | LEGACY | In-memory queue and filesystem persistence; only admin review page calls it |
| /admin/editorial-review | DUPLICATE | Migrate list/review to ProjectPost; client reviewer identity must disappear |
| publishEditorial, posting status | DUPLICATE implementation | Both mutate same persisted models; consolidate transactional state writes and legal transitions |
| createEditorialDraft, posting init | DUPLICATE implementation | Use idempotent unique-project upsert; preserve existing feature gates |
| generation, editing, staging, /p, feed | CANONICAL | Operate on ProjectPost; audit ownership and status changes |
| EditorialCategory/Assignment/Edition | SUPPORTING | Curation concepts, not submission approval |
| editorial/curator.ts | DEAD | No imports/callers in src or scripts; contains unsafe process-local cross-hook state |
| ProjectModule | SUPPORTING | Independent attached media, not an approval queue |
| DesignerAngle/EditorialQueueItem | SUPPORTING | New proactive corpus recommendations; explicitly separate product, untouched |
| projects.json | LEGACY, shared | Other export/assignment/demo consumers exist; remove editorial writer only |

## Drift evidence

Read-only metadata on the configured database confirms snake_case columns for
editorial_assignment/category/edition. Migration
20251109120000_editorial_curator_integration is recorded finished, not rolled back.
Schema omits @map on these fields; generated client consequently queries camelCase.
This is a Prisma mapping error, not missing production DDL. Mapping-only repair
is awaiting the repository's schema-block approval gate. No database writes.

## Intended transitions

| Action | Actor/access | Persisted change | Duplicate behavior | Reversible/public effect |
|---|---|---|---|---|
| Initiate | authenticated project writer | unique ProjectPost DRAFT | same row | private, can generate |
| Submit | authenticated project writer | DRAFT → REVIEW; session submitter metadata in provenance | same review | private; admin may reject |
| Approve | canonical ADMIN | REVIEW → PUBLISHED plus Project visibility; session reviewer metadata | same approved result | public same /p post; may unpublish |
| Reject | canonical ADMIN | REVIEW → DRAFT; session reviewer/reason metadata | same rejected result | private; designer may revise/resubmit |
| Self-publish | project publish capability; existing entry-point gates | DRAFT → PUBLISHED plus Project visibility | same publication timestamp | public; review cannot be bypassed |
| Unpublish | project publish capability | PUBLISHED → DRAFT; clear Project visibility, retain post publication history | same draft | private, republish possible |
| Archive | project publish capability | DRAFT/PUBLISHED → ARCHIVED and clear visibility | same archive | private, terminal |

Review outcome metadata is an audit fact, not a second stored lifecycle state.
No new model or enum. Conditional transactional writes prevent stale reviews.

## Plan

- [x] Map source, migration history, callers and database metadata.
- [x] Consolidate draft initialization and persisted transitions.
- [x] Delete legacy submissions; migrate admin review and enforce session identity.
- [x] Audit generation/editing and close review/visibility bypasses in source.
- [ ] Apply approved mapping-only repair with schema backup and validation.
- [x] Add focused authorization, concurrency, persistence and public-path tests.
- [ ] Execute the real database journey on an existing isolated test database.
- [x] Run editorial checks, Prisma/guards, IDOR, lint, type comparison and build; limitations below.
- [x] Document deletion counts, remaining debt and review; commit and push this explicitly incomplete work.

Recovery: back up schema before approved edits; restore and stop schema work if
format/validate/generate/migrate-status fails. Never apply production migrations.

## Review / verification

- Authorization and transition tests: 3 passed, 0 failed. One integration group
  (8 sequential database journey cases) skipped because no disposable DB is
  configured. It covers real route handlers, project access, Prisma transactions,
  duplicate/concurrent requests and the public reader; it does not mock the DB.
- Existing single-generator, regenerate-surfaces and story-editing checks passed.
  The latter two require Bash; they passed using the installed Git Bash as ComSpec.
- Prisma validate passed. Schema remains unchanged pending approval.
- Migration discipline guard passed: 32/32 loose SQL, zero phantom delegates,
  zero missing SQL files, zero recent non-idempotent DDL.
- Client-import guard passed (2,203 source files / 915 client modules).
- IDOR: 558 routes, 0 Critical, 1 pre-existing High, 16 Medium, 19 Low.
  No new Critical/High editorial findings. The existing High is products POST
  IDOR004 on its additive vendor-claim update, outside this task.
- Changed-file lint passed: 0 errors, 117 warnings (largely existing any/unused
  declarations in generation and staging code). New lifecycle helper is clean.
- TypeScript comparison: 1,009 before, 1,006 after, zero added diagnostics after
  Next refreshed the generated types for the deleted route. Three existing errors
  were removed: unreachable status comparison and missing draft slug/status return.
- Production build exits 0, but magazine filters still produce P2022 for
  editorial_assignment.editorialId. This is an active error, not a benign warning.
  Its missing @map repair is authored but not applied pending schema approval.
- Read-only real DB evidence: metadata, finished migration record, matching
  snake_case index names, and generated-client DMMF prove the mapping defect.
  The exact new persisted review-list query executes successfully (zero matching
  reviews). No production data or schema was mutated.

### Complexity reduction

2 production files deleted: legacy submissions route (246 lines) and unused
curator helper (474 lines). One legacy route removed; one persisted admin list
route added. Net route count is unchanged. Across production src: 2,001 lines
removed, 441 added, **1,560 net lines removed**. Focused test harness: 188 lines.

The separate pending/approved/rejected queue lifecycle and its filesystem flags
are gone. There is no new model, enum or compatibility wrapper. The unused
status/to request formats and unused scoring constants are removed. Existing
draft/publish wrappers remain because PublishWorkflow and usePublishFlow call
them, and both delegate to the shared lifecycle.

### Remaining gates and debt

1. Apply the exact mapping-only schema blocks in editorial-schema-repair.md after
   the CLAUDE.md per-model-block approval, then regenerate/validate the client,
   read the affected tables and rebuild. No SQL migration is indicated.
2. Run the real database journey with an existing disposable, schema-compatible
   EDITORIAL_TEST_DATABASE_URL and EDITORIAL_TEST_DATABASE_DISPOSABLE=1. The local
   shadow target is unreachable. No infrastructure has been provisioned.
3. EditorialDraft retains historical records/model and room-cleanup support but
   has no lifecycle authority. Shared projects.json demo/export consumers remain
   outside editorial. Existing curation assignments/editions remain readable once
   mappings are repaired; the deleted assignment generator already had no callers.

Status: INCOMPLETE — mapping approval and real database transition verification
are pending. P0 remains parked with its original operational verification gate.

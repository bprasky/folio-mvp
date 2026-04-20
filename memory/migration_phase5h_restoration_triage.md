---
name: Phase 5H restoration triage — 41 dangling prisma.<model> references
description: Classification from Phase 5C follow-up B — 41 app refs to Prisma models absent from generated client, bucketed into A (folder-backed restore), B (hand-managed), C (phantom), D (stranded SQL). Full matrix inline so future sessions don't re-run the probe.
type: project
originSessionId: 6b49c2c7-494a-4b05-9ee5-adec29657508
---
# Phase 5H restoration triage

## Decision

Discovered during Phase 5C (2026-04-20): **41 distinct `prisma.<model>.X` call sites in `src/` reference models that do not exist on the generated Prisma Client** — 217 call sites across 70 files. Triaged into 4 buckets. Restoration split across two future sessions (Phase 5H1, Phase 5H2). Dead-code deletion folded into Phase 5D.

**Why:** Phase 5B closed the migration/DB gap but never reconciled with application code. App layer has been calling `undefined.findMany()` at runtime for long enough that these routes are either unreachable or quietly 500-ing in prod. `schema.prisma` is the source of truth for Prisma Client generation, and none of these 41 models have declarations there — even when the underlying prod table exists and is healthy.

**How to apply:**
- **Phase 5H1** (future session): Bucket A restoration via `prisma db pull` → paste model blocks → regenerate client. 22 models, ~143 calls, all clean (folder-backed migrations exist). Biggest win is the events cluster (12 models, 73 calls) — single bulk commit.
- **Phase 5H2** (future session): Bucket B hand-managed tables. **Must verify `_prisma_migrations` records a PENDING_REAL stub for each table before adding the model block**, otherwise `prisma migrate diff` will emit a real `CREATE TABLE` and break the clean migrate status.
- **Phase 5D** (next planned session): delete Bucket C app code (5 models, 19 calls, no table anywhere) and the stranded SQL from Bucket D.
- When restoring a Bucket A/B model in future, match the table shape empirically via `db pull` rather than authoring field types from memory — prod column types may drift from what app code expects.

## Bucket A — Folder-backed restoration candidates (22 models, ~143 calls)

Table in prod + `CREATE TABLE` in a timestamped migration folder + no schema.prisma declaration. Straight restore — `db pull` the block, paste into schema.prisma, regenerate.

| model | expected table | calls | cluster |
|---|---|-:|---|
| `interviewSession` | `interview_sessions` | 23 | interviews |
| `eventHostProfile` | `event_host_profiles` | 14 | events |
| `vendorBoostRequest` | `vendor_boost_requests` | 12 | vendor-intake |
| `eventRelationshipEdge` | `event_relationship_edges` | 11 | events |
| `eventVendorEdge` | `event_vendor_edges` | 10 | events |
| `eventDesignerEdge` | `event_designer_edges` | 10 | events |
| `noteAttachment` | `note_attachments` | 8 | project-collab |
| `eventProductEdge` | `event_product_edges` | 8 | events |
| `quoteHighlight` | `quote_highlights` | 6 | interviews |
| `eventContact` | `event_contacts` | 6 | events |
| `actionItem` | `action_items` | 6 | project-collab |
| `vendorInviteCandidate` | `vendor_invite_candidates` | 4 | vendor-intake |
| `mediaAsset` | `media_assets` | 4 | interviews |
| `eventRepEdge` | `event_rep_edges` | 4 | events |
| `eventInviteList` | `event_invite_lists` | 4 | events |
| `eventEngagementMetrics` | `event_engagement_metrics` | 3 | events |
| `post` | `posts` | 2 | posts |
| `transcriptSegment` | `transcript_segments` | 1 | interviews |
| `postItem` | `post_items` | 1 | posts |
| `eventTargetingProfile` | `event_targeting_profiles` | 1 | events |
| `eventMetrics` | `event_metrics` | 1 | events |
| `eventInvite` | `event_invites` | 1 | events |

Source migration folders (reference for db-pull cross-check):
- `20251202043216_add_events_engine_models/migration.sql` — all 12 events-cluster tables
- `20250127120000_add_recorded_reflection_system/migration.sql` — `interview_sessions`, `vendor_boost_requests`, `quote_highlights`, `media_assets`, `transcript_segments`
- `20250127000000_add_notes_attachments_action_items/migration.sql` — `note_attachments`, `action_items` (NOTE: references `meeting_notes` + `project_product_tags` as FK targets but does not CREATE them; see Bucket B)
- `posts` + `post_items` + `vendor_invite_candidates` — source folders exist, not cross-referenced here but can be found via `grep -rn 'CREATE TABLE.*"<table>"' prisma/migrations/`

## Bucket B — Hand-managed / PENDING_REAL tables (13 models, ~63 calls)

Table in prod + **no `CREATE TABLE` anywhere in `prisma/migrations/`** + no schema.prisma declaration. Tables created out-of-band (pre-Phase-1 hand-SQL era); Phase 1-4 recorded them as PENDING_REAL stubs in `_prisma_migrations` to satisfy `migrate status`. Restoration procedure is the same as Bucket A, but migration bookkeeping needs verification first.

| model | expected table | calls | cluster |
|---|---|-:|---|
| `projectProductTag` | `project_product_tags` | 10 | project-collab |
| `meetingNote` | `meeting_notes` | 9 | project-collab |
| `vendor` | `vendors` | 7 | vendor-intake |
| `vendorPreviewToken` | `vendor_preview_tokens` | 5 | vendor-intake |
| `pendingRepInvite` | `pending_rep_invites` | 5 | vendor-intake |
| `roomIntent` | `room_intents` | 4 | project-core |
| `designerActivityProfile` | `designer_activity_profiles` | 4 | analytics |
| `projectLifecycleScore` | `project_lifecycle_scores` | 3 | project-core |
| `follow` | `follows` | 3 | other |
| `vendorProductMatchScore` | `vendor_product_match_scores` | 2 | vendor-intake |
| `proximityToPurchaseIndicator` | `proximity_to_purchase_indicators` | 2 | analytics |
| `projectIntent` | `project_intents` | 2 | project-core |
| `editorialDraft` | `editorial_drafts` | 2 | other |

Phase 5H2 pre-flight check (must pass for each table before declaring the model):
```sql
select migration_name, applied_steps_count, rolled_back_at
from _prisma_migrations
where migration_name ilike '%<snake_table>%'
   or migration_name ilike '%pending_real%';
```
If PENDING_REAL stub is missing, author one before adding the schema.prisma block. `prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource $DATABASE_URL --script` against a local shadow post-restore should emit **empty DDL**, not a CREATE TABLE — that's the success signal.

## Bucket C — Pure phantoms (5 models, 19 calls) — delete in Phase 5D

No table in prod, no migration, no schema. App code calls into literal nothing. Delete the callsite files or gut the functions.

| model | calls | files |
|---|-:|---|
| `threeDAsset` | 9 | `src/app/api/3d-assets/route.ts`, `src/app/api/3d-assets/[id]/route.ts`, `src/app/api/projects/[id]/unreal-export/route.ts` |
| `vendorDiscoveryBudget` | 5 | `src/app/api/vendor/collaborations/route.ts`, `src/lib/spend/applySignalSpend.ts`, `src/lib/spend/priceSignal.ts` |
| `analyticsEvent` | 2 | `src/lib/analytics.ts` |
| `projectMember` | 1 | `src/lib/permissions.ts` |
| `affiliateLink` | 1 | `src/app/actions/projects.ts` |

## Bucket D — Stranded loose SQL (1 model, 1 call) — cleanup in Phase 5D

| model | calls | stranded artifact |
|---|-:|---|
| `vendorInviteContact` | 1 | `prisma/migrations/add_vendor_invite_contacts.sql` (loose, not tracked) + `src/lib/vendor/inviteCandidates.ts` |

No prod table. The loose SQL was never run, or the table was later dropped. Delete the app code reference and the stranded SQL file.

## Cluster totals (cross-cut view)

| cluster | models | calls | A | B | C | D |
|---|-:|-:|-:|-:|-:|-:|
| events | 12 | 73 | 12 | 0 | 0 | 0 |
| vendor-intake | 8 | 41 | 2 | 4 | 1 | 1 |
| interviews | 4 | 34 | 4 | 0 | 0 | 0 |
| project-collab | 4 | 33 | 2 | 2 | 0 | 0 |
| other | 4 | 15 | 0 | 2 | 2 | 0 |
| project-core | 4 | 10 | 0 | 3 | 1 | 0 |
| analytics | 3 | 8 | 0 | 2 | 1 | 0 |
| posts | 2 | 3 | 2 | 0 | 0 | 0 |

## Reproducing this triage

`scripts/phase5c-hypothesis-check.mjs` (in-repo as of 2026-04-20, uncommitted) — checks table existence via `information_schema`, greps migration folders for `CREATE TABLE "<table>"`, scans `schema.prisma` for `model` blocks and `@@map(...)`, and emits the matrix + buckets. Re-run if a future phase changes schema.prisma or applies new migrations.

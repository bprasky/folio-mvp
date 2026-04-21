---
name: 13 hand-managed tables retroactively recorded in Phase 5H2
description: Phase 5H2 authored 13 idempotent CREATE TABLE IF NOT EXISTS migrations for tables that existed in prod but had no migration-folder or _prisma_migrations bookkeeping. Each migration shadow-replays to create the table; prod is untouched.
type: project
---

# 13 hand-managed tables recorded in Phase 5H2

## Decision

During Phase 5H2's bookkeeping check, all 13 Bucket B tables had **zero `CREATE TABLE` references in any tracked migration folder AND zero rows in `_prisma_migrations`**. They existed in prod only — created by hand-run SQL before the migration system was reliable (pre-Phase-1).

Phase 5H2 authored 13 "record existing state" migrations, one per table, each with this structure:

```
prisma/migrations/20260421<HHMMSS>_record_bucket_b_<table>/migration.sql
```

Each migration.sql:
- Uses `CREATE TABLE IF NOT EXISTS` — idempotent, no-op against prod (table already exists), creates table on shadow DB during migrate-dev replay.
- Uses `CREATE INDEX IF NOT EXISTS` and `CREATE UNIQUE INDEX IF NOT EXISTS` for indexes.
- Uses `DO $$ BEGIN ... IF NOT EXISTS ... END $$` blocks for FK constraints (idempotent).
- Column types lifted from `information_schema.columns` query against prod — matches prod's actual shape, not Prisma's inferred types, to minimize future shadow-vs-prod drift.

After authoring, each migration was applied via `scripts/apply-migration-file.mjs` (which runs the SQL without recording in `_prisma_migrations`) and then bookkept via `prisma migrate resolve --applied 20260421<HHMMSS>_record_bucket_b_<table>` — marking each as applied without re-running the DDL against prod.

The 13 tables:

| Table | Migration timestamp | Notes |
|---|---|---|
| `project_product_tags` | 103000 | FK to Product, Project, ProjectImage |
| `meeting_notes` | 103001 | FK to Project |
| `vendors` | 103002 | No FKs; referenced by vendor_preview_tokens |
| `vendor_preview_tokens` | 103003 | FK to Product, Project, vendors |
| `pending_rep_invites` | 103004 | Creates PendingRepInviteStatus enum type |
| `vendor_product_match_scores` | 103005 | FK to User (designerId) |
| `room_intents` | 103006 | FK to Project |
| `project_lifecycle_scores` | 103007 | FK to User (designerId); uses ProjectStage enum (pre-existing) |
| `project_intents` | 103008 | FK to Project (projectId @unique) |
| `designer_activity_profiles` | 103009 | FK to User (designerId @unique) |
| `proximity_to_purchase_indicators` | 103010 | FK to User (designerId @unique) |
| `follows` | 103011 | FK to User (×2 named: followerId, followingId) |
| `editorial_drafts` | 103012 | FK to Project |

**Why:** `prisma migrate status` must remain clean. Without these bookkeeping migrations, adding model declarations in schema.prisma would cause `prisma migrate diff` to propose fresh CREATE TABLE statements for tables that already exist in prod — and running that would fail (tables exist) or succeed only with `IF NOT EXISTS`, but either way the bookkeeping gap persists.

**How to apply:**
- For future hand-managed tables: follow the same pattern — CREATE TABLE IF NOT EXISTS migration + apply-migration-file + migrate resolve --applied.
- Before adding any schema.prisma model declaration for a table that exists only in prod, check `_prisma_migrations` for bookkeeping. If missing, author a record-existing-state migration first.
- The `scripts/phase5h2-bookkeeping-check.mjs` script (kept in-repo) is reusable for future drift detection — it queries `_prisma_migrations` against a list of tables and categorizes each as bookkept or unbookkept.

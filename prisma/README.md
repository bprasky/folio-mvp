# Folio Migration System

Single entry point for anything touching `prisma/` or the database schema. If this is your first time running migrations on this project, read the whole file before you run a command.

---

## 1. What this directory is

- **`schema.prisma`** — the canonical model declaration. Prisma Client is generated from this file; it is the source of truth for how app code sees the database.
- **`migrations/`** — the migration history.
  - `YYYYMMDDHHMMSS_<name>/migration.sql` — tracked migrations. Prisma records these in the `_prisma_migrations` table after they're applied. This is what `prisma migrate status` cares about.
  - Loose `.sql` files at the root (33 of them, as of Phase 5E baseline) — grandfathered Phase 1-4 bookkeeping SQL. Prisma ignores these. Don't add new ones. CI blocks regressions.
- **`schema.prisma.bak.*`** — old snapshot file from a prior incident. Leave it alone; it's not load-bearing.
- **Shadow init:** `shadow-init.sql` — seeds the local pgvector shadow DB used by `prisma migrate dev` against shadow. Not relevant to prod.

**Hard rule: never run `prisma migrate dev` or `prisma db push` against prod.** This project uses a custom apply-then-resolve pattern — see Section 3.

---

## 2. Commands that matter

| Command | When to run | What it does |
|---|---|---|
| `pnpm prisma generate` | After any `schema.prisma` edit | Regenerates the Prisma Client in `node_modules/`. No DB contact. |
| `pnpm prisma format` | After any `schema.prisma` edit, before validate | Normalizes whitespace/alignment in-place. |
| `pnpm prisma validate` | After format | Checks schema structure. Catches missing inverse relations, duplicate fields, etc. No DB contact. |
| `pnpm prisma migrate status` | Before any session; after any change; at end of any session | Reports how `prisma/migrations/` compares to the `_prisma_migrations` table in prod. Must print **"Database schema is up to date!"** If not, STOP and consult Section 5b. |
| `node scripts/apply-migration-file.mjs <path>` | When applying a new migration SQL to prod | Executes each statement in the file against prod. Splitter respects SQL comments and `DO $$ ... END $$` blocks. Does NOT record in `_prisma_migrations`. Safe to re-run if the SQL is idempotent. |
| `pnpm prisma migrate resolve --applied <name>` | After `apply-migration-file` succeeds | Records a migration as applied in `_prisma_migrations` without re-executing DDL. |

### `prisma db pull` — use the swap-and-restore pattern

**Never run plain `pnpm prisma db pull`.** It overwrites `schema.prisma` in place, destroying hand-edits, comments, model ordering, and `@@map` annotations. Always use the swap-and-restore pattern (developed in Phase 5H1):

```bash
# Save current schema outside the pull target
cp prisma/schema.prisma /tmp/schema-backup.prisma

# Move real schema aside and put a scratch copy in its place
mv prisma/schema.prisma prisma/schema.prisma.real
cp /tmp/schema-backup.prisma prisma/schema.prisma

# Pull prod's current shape into the scratch copy
pnpm prisma db pull

# Save the pulled result for extraction
cp prisma/schema.prisma /tmp/pulled-schema.prisma

# Restore the real schema
mv prisma/schema.prisma.real prisma/schema.prisma
```

Now `/tmp/pulled-schema.prisma` holds prod's shape. Extract the specific model blocks you need with `awk` or manual copy, transform them (rename snake_case → PascalCase, add `@@map`, drop problematic inverses), and paste into the real `schema.prisma` surgically. See `memory/migration_phase5h_restoration_triage.md` and `migration_phase5h2_hand_managed_recorded.md` for the full playbook.

---

## 3. When you need a new migration

Use this whenever you're adding a new table, column, index, FK, or enum.

1. **Create the migration folder** with a current timestamp:
   ```bash
   mkdir prisma/migrations/$(date -u +%Y%m%d%H%M%S)_<descriptive_name>
   ```

2. **Author `migration.sql`** with idempotent patterns only:
   ```sql
   -- Enums via DO $$ to survive re-application
   DO $$ BEGIN
       CREATE TYPE "MyEnum" AS ENUM ('A', 'B', 'C');
   EXCEPTION
       WHEN duplicate_object THEN null;
   END $$;

   -- Tables with IF NOT EXISTS
   CREATE TABLE IF NOT EXISTS "my_table" (
       "id" TEXT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT "my_table_pkey" PRIMARY KEY ("id")
   );

   -- Indexes with IF NOT EXISTS
   CREATE INDEX IF NOT EXISTS "my_table_createdAt_idx"
       ON "my_table" ("createdAt");

   -- FKs wrapped in DO $$ / IF NOT EXISTS
   DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'my_table_fk') THEN
           ALTER TABLE "my_table" ADD CONSTRAINT "my_table_fk"
               FOREIGN KEY ("refId") REFERENCES "other_table"("id")
               ON DELETE CASCADE ON UPDATE CASCADE;
       END IF;
   END $$;
   ```

3. **Apply to prod**:
   ```bash
   node scripts/apply-migration-file.mjs prisma/migrations/<folder>/migration.sql
   pnpm prisma migrate resolve --applied <folder>
   pnpm prisma migrate status  # must remain clean
   ```

4. **Update `schema.prisma`** to declare the new model(s). Run format → validate → generate → migrate status.

5. **Never skip the idempotency**. The shadow-DB replay used by `prisma migrate dev` (when someone runs it against shadow for diff analysis) requires every migration to be re-runnable without error. Non-idempotent DDL fails CI (Phase 5E Check 4).

---

## 4. When you need a new model declaration (table already exists in prod)

This is the Phase 5H situation: a table exists in prod but `schema.prisma` is missing the model block.

**Case A — Table exists + a migration folder already creates it (Phase 5H1 pattern).** Just add the model declaration to `schema.prisma`:
1. Use the `db pull` swap-and-restore pattern (Section 2) to introspect the table's shape.
2. Extract the model block from `/tmp/pulled-schema.prisma`.
3. Rename `model <snake_case>` → `model <PascalCase>` and add `@@map("<snake_case>")`.
4. Rename any relation types pointing at other PascalCase models.
5. Paste into `schema.prisma`. Add inverse fields to related models (Prisma requires both sides declared).
6. Format → validate → generate → migrate status.

**Case B — Table exists but has no migration folder (Phase 5H2 pattern).** You need both a record-existing-state migration AND the schema declaration:
1. First author the migration (Section 3) with `CREATE TABLE IF NOT EXISTS` matching prod's actual shape. **Lift column types from `information_schema.columns` against prod, not from Prisma inference.** Example: `SELECT column_name, data_type, udt_name, character_maximum_length, datetime_precision, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=<name>`.
2. Apply + resolve (Section 3).
3. Then do the schema declaration steps from Case A.

**Always match column types empirically.** Timestamp precision (`TIMESTAMP(3)` vs `TIMESTAMPTZ`), numeric scale, enum casts — all these matter for shadow replay. Guessing causes drift.

---

## 5. When drift is detected

### 5a. CI flags drift (phase5e-check-plan.mjs fails)

The Phase 5E workflow (`.github/workflows/migration-discipline.yml`) runs `node scripts/phase5e-check-plan.mjs --ci` on every relevant PR. Four checks; each compares count against `.github/workflows/phase5e-baseline.json`.

| Check | What it catches | How to fix |
|---|---|---|
| `looseSql` | New `.sql` file at `prisma/migrations/` root (outside a timestamped folder) | Either move it into `YYYYMMDDHHMMSS_<name>/migration.sql` or delete it if orphan. |
| `phantomCalls` | `prisma.<model>.X` in `src/` where `<model>` is not in `schema.prisma` | Either declare the model (Section 4) or delete the caller. |
| `missingSql` | A `YYYYMMDDHHMMSS_*/` folder without `migration.sql` | Author the SQL file or delete the folder. |
| `nonIdempotent` | Raw `CREATE TABLE "X"` without `IF NOT EXISTS` in the last 20 migrations | Wrap in `IF NOT EXISTS` or `DO $$` blocks (see Section 3 patterns). |

If the regression is **intentional** (e.g., paying down debt by removing a grandfathered loose SQL file): update `.github/workflows/phase5e-baseline.json` in the same PR to the new count. Include why in the commit message.

Run the check locally before pushing: `node scripts/phase5e-check-plan.mjs` for human-readable output, `node scripts/phase5e-check-plan.mjs --ci` for pass/fail simulation.

### 5b. Prisma reports drift (`migrate status` non-clean)

This is the STOP signal. `prisma migrate status` should always report "Database schema is up to date!". If it prints anything else (missing migration, rolled-back migration, drift detected), **do not run `migrate resolve` blindly**. Procedure:

1. **Audit the specific delta.** Query `_prisma_migrations` directly:
   ```sql
   SELECT migration_name, finished_at, applied_steps_count, rolled_back_at, logs
   FROM _prisma_migrations
   WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
   ORDER BY started_at DESC;
   ```

2. **Compare to `prisma/migrations/` on disk.** Is the missing migration on disk but not in `_prisma_migrations`? Or the reverse?

3. **Consult `memory/MEMORY.md`** for prior similar situations. Most drift patterns have a memory file (look for `migration_phase*`).

4. **If still stuck, mirror the Phase 5C triage approach:** bucket the drift into A (table exists, folder-backed) / B (table exists, hand-managed) / C (phantom) / D (stranded artifact). Each bucket has its matching playbook in memory.

5. **Never** run `prisma migrate dev` to "just resolve the drift" — it will propose new DDL against prod, which is the opposite of what you want.

---

## 6. Pointers to deeper knowledge

Start here; follow the trail.

- **`memory/MEMORY.md`** — index of all hardening memory files. One line per file describing when to consult it.
- **`CLAUDE.md` "Migration Discipline" section** — session discipline for future Claude Code work on this project.
- **`.github/workflows/migration-discipline.yml`** — the CI workflow that enforces Section 5a patterns.
- **`scripts/apply-migration-file.mjs`** — the custom runner used for prod migrations.
- **`scripts/phase5e-check-plan.mjs`** — the CI check; run locally in report mode to sanity-check before pushing.

Key memory files indexed by situation:

| Situation | Memory file |
|---|---|
| Hand-managed tables (exist in prod, no migration folder) | `migration_phase5h2_hand_managed_recorded.md` |
| Phantom code paths (app calls undeclared model) | `migration_phase5d_phantom_deletions.md` |
| Schema restoration from prod at scale | `migration_phase5h_restoration_triage.md` (41-model triage matrix) |
| CI enforcement specifics | `migration_phase5e_ci_enforcement.md` |
| Timestamp convention drift (deferred debt) | `migration_timestamp_convention_drift.md` |
| DROP/SET DEFAULT pattern around enum casts | `migration_bucket2_drop_set_default_pattern.md` |
| Atelier enum taxonomy deferred | `migration_atelier_enum_taxonomy_deferred.md` |

Commit history: Phases 1-5 are ~8 atomic commits with quantified summaries — `git log --oneline` + grep for "Phase" finds them all.

---

## 7. What not to do

These are hard don'ts. CI catches most; the rest are landmines.

- **Don't `prisma migrate dev` against prod.** It bypasses the apply-then-resolve discipline and could propose destructive DDL. Use the `apply-migration-file.mjs` + `migrate resolve --applied` pattern.
- **Don't `prisma db push` ever.** Skips migration history entirely. No audit trail.
- **Don't write `CREATE TABLE "X"` without `IF NOT EXISTS`** in new migrations. Fails shadow replay. CI blocks via Check 4.
- **Don't declare a model in `schema.prisma` for a table that doesn't exist in prod.** Creates the exact pattern Phase 5C triaged out of existence. Either author the CREATE TABLE migration first (Section 3), or wait until the table exists.
- **Don't reference undeclared models via `prisma.X` in app code.** CI blocks via Check 2. If the Prisma Client doesn't know the model, the call throws at runtime.
- **Don't write raw `prisma.$queryRaw` for queries a declared model could handle.** Loses type safety, bypasses the ORM, makes audits harder.
- **Don't modify a tracked migration folder after it's been applied to prod.** The `_prisma_migrations` table records a checksum; changing the file after apply will make `migrate status` show drift forever. If you need to fix an old migration, author a new corrective migration.
- **Don't run plain `prisma db pull`.** Destroys schema.prisma. Use the swap-and-restore pattern (Section 2).

---

## 8. Session and commit discipline

Pattern from Phases 1-5E:

- **One architectural boundary, one commit.** Each commit should be independently reviewable. Some phases produce one commit (5H1, 5D, 5E); others split at natural architectural boundaries (5H2 split at Step 9 bookkeeping vs Step 10-13 schema surgery). Commit messages are quantified (how many migrations, how many models, how many call sites) with a pointer to memory files for context.
- **Push at end of session, never across sessions.** Review the full diff before committing. If a session is interrupted, finish the work before picking up a new phase.
- **Memory files live in `memory/`.** When a phase introduces a deferred decision, save it as `memory/<slug>.md` and index it in `memory/MEMORY.md` in the same commit.
- **CLAUDE.md for patterns; memory files for specifics.** If a behavior should be enforced across all future sessions, it goes in CLAUDE.md. If it's a one-time decision that future sessions might need to reference (or reverse), it goes in a memory file.
- **CI catches what discipline forgets.** Phase 5E encoded the four most common regression patterns. If you find yourself wanting to disable the CI check to ship something, stop — that's exactly the situation the check exists to block.

---
name: Bucket 2 DROP/SET DEFAULT pattern around column type casts
description: When converting a TEXT column with a default to a Postgres enum, the text default must be dropped before ALTER COLUMN TYPE and re-set as the enum literal after; partial apply in the middle leaves prod in an intermediate state requiring manual diagnosis
type: project
---

Phase 5B Bucket 2 established a 5-statement pattern for converting TEXT columns with an existing default (like `users.subscriptionTier` which had `DEFAULT 'FREE'::text`) to a proper Postgres enum type:

1. `DO $$ BEGIN CREATE TYPE ... AS ENUM (...); EXCEPTION WHEN duplicate_object THEN null; END $$;`
2. `ALTER TABLE ... ALTER COLUMN <col> DROP DEFAULT;`
3. `ALTER TABLE ... ALTER COLUMN <col> TYPE <EnumType> USING <col>::<EnumType>;`
4. `ALTER TABLE ... ALTER COLUMN <col> SET DEFAULT '<value>';`
5. `ALTER TABLE ... ALTER COLUMN <col> SET NOT NULL;` (if schema.prisma declares the field non-nullable and data confirms all rows are non-null)

Statement 2 (DROP DEFAULT) is mandatory when a text default exists: Postgres cannot auto-cast the default expression `'FREE'::text` into the new enum type context during ALTER COLUMN TYPE, so the default must be removed first and re-set after. Without step 2 the cast fails with "default for column cannot be cast automatically."

**Why:** ALTER COLUMN TYPE must re-validate and migrate every row plus every dependent expression (defaults, indexes, CHECK constraints, views). A default expression in the OLD type is not implicitly convertible.

**How to apply:**
- `project_participants.role` (5B.4) did NOT need this pattern — the TEXT column had no default, just a CHECK constraint. 3 statements sufficed.
- `users.subscriptionTier` (5B.5) needed the full 5-statement pattern — 1 CREATE TYPE + DROP DEFAULT + cast + SET DEFAULT + SET NOT NULL.
- `Organization.vendorTier` (5B.6 upcoming): recon will reveal whether it has a default. If yes → 5-statement pattern. If no → 3-statement.
- `Conversation.category` and `PendingAction.actionType/status` (5B.7): same per-column inspection needed.

**Recovery risk:** these migrations are NOT fully idempotent. If apply fails between statement 2 and 4, prod is left with the column in a broken state (default dropped but type not yet changed, OR type changed but default not yet re-set). Re-running the whole migration.sql would fail on re-CREATE TYPE (protected by duplicate_object guard, so OK) but subsequent statements may fail differently than the first run. For any future similar migration, manually inspect partial state before re-running: `SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='X' AND column_name='Y';` — if null, statement 2 ran; if populated with the old text form, statement 2 hasn't run. Proceed statement-by-statement from the last successful step.

**Rule of thumb:** always check the target column's default expression during pre-migration recon. If present, include DROP/SET DEFAULT. If absent, 3-statement pattern is sufficient.

---
name: TEXT+CHECK columns masquerading as Prisma enums
description: Pre-existing pattern in initial_schema — several columns are TEXT with CHECK constraints while schema.prisma declares them as enums; converting a column to enum requires dropping the CHECK first
type: project
originSessionId: f64d0e6e-708a-4b36-9718-25c639f06dcb
---
`20250719230944_initial_schema_with_organizations` created several columns using the TEXT+CHECK pattern (e.g. `CHECK (side = ANY (ARRAY['DESIGNER'::text, 'VENDOR'::text]))`) instead of Postgres enum types. `schema.prisma` declares those same fields as `enum` types, but prod has TEXT. At runtime this is silent because Prisma Client sends/receives strings either way. A `migrate dev` against shadow will flag it, and any `ALTER COLUMN TYPE` to convert to the enum will fail with `operator does not exist: EnumName = text` because the CHECK constraint is re-validated during the cast.

**Known instances as of 2026-04-17:**
- `project_participants.side` — had `project_participants_side_check` restricting to DESIGNER/VENDOR. **Fixed by `20260115999999_fix_participant_side_enum`** (created ParticipantSide enum, dropped CHECK, cast column). Rows preserved: 5.
- `project_participants.role` — still has `project_participants_role_check` restricting to OWNER/EDITOR/VIEWER. `schema.prisma` declares `enum ParticipantRole { OWNER, EDITOR, VIEWER }`. NOT YET FIXED.

**Why:** Initial schema authors used the TEXT+CHECK pattern as an alternative to enums (valid Postgres, but incompatible with Prisma's enum-generation path). Leftover TEXT+CHECK columns will silently pass today's Prisma runtime but block any future enum conversion.

**How to apply:** Before attempting to convert a TEXT column to an enum, grep `pg_constraint` for CHECK constraints on the target column and plan to DROP them as part of the conversion migration — creating the enum alone is not sufficient. During Phase 5 hardening, do a proactive audit: list every column whose `schema.prisma` declaration is an enum and whose prod type is TEXT, and schedule conversion migrations (`CREATE TYPE` + `DROP CONSTRAINT` + `ALTER COLUMN TYPE ... USING ...`). Suggested query:

```sql
SELECT cl.relname AS table, a.attname AS column, pg_get_constraintdef(c.oid) AS check_def
FROM pg_constraint c
JOIN pg_class cl ON cl.oid = c.conrelid
JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(c.conkey)
JOIN pg_namespace n ON n.oid = cl.relnamespace
WHERE n.nspname = 'public' AND c.contype = 'c';
```

Cross-reference results against schema.prisma enum field declarations.

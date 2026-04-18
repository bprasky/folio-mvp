---
name: Three timestamp conventions sprinkled across migrations
description: Codebase has a mix of TIMESTAMP, TIMESTAMP(3), and TIMESTAMPTZ for DateTime columns — candidate for a Phase 5 standardization sweep on TIMESTAMPTZ
type: project
originSessionId: f64d0e6e-708a-4b36-9718-25c639f06dcb
---
As of 2026-04-17 after Phase 4 work, the repo's migrations use three different timestamp conventions for what schema.prisma declares as `DateTime`:

1. **`TIMESTAMP`** (no precision, no tz) — used by the three Phase 2 stubs authored from prod introspection: `20251125194840_add_designer_brand_profile`, `20251202042801_add_atelier_models`, `20251202043216_add_events_engine_models`. Prod has these as `timestamp without time zone`.

2. **`TIMESTAMP(3)`** — the Prisma default for `DateTime` without a `@db` annotation. Used by most real Prisma-generated migrations in the repo (e.g. `20251104143437_add_project_post`, `20260226000000_add_supplemental_quotes_table`).

3. **`TIMESTAMPTZ`** — used by the two IG feature migrations (`20260303000000_add_instagram_exports`, `20260303100000_add_instagram_campaigns`) where `expiresAt`-style real-world cutoffs need unambiguous UTC.

**Why the Phase 2 stubs ended up as bare TIMESTAMP:** they were authored from `information_schema.columns` introspection of prod, which returned `timestamp without time zone` as the data type. My stubs replayed that verbatim. That means the data the stubs describe matches prod, but it's not what Prisma would have generated from schema.prisma (which would have been `TIMESTAMP(3)`).

**Not a blocker today.** All three conventions coexist in prod without functional breakage — Prisma Client serializes/deserializes DateTime the same way across them. But:
- `migrate dev` against a shadow DB will flag the Phase 2 stubs' `TIMESTAMP` columns as drift against schema.prisma.
- Any fields storing real-world cutoffs (expirations, scheduled events, external deadlines) should ideally be TIMESTAMPTZ for timezone safety.

**How to apply:** During Phase 5 hardening, consider a standardization sweep — pick one convention (TIMESTAMPTZ recommended) and author a migration that `ALTER COLUMN ... TYPE TIMESTAMPTZ USING ... AT TIME ZONE 'UTC'` for every DateTime column that isn't already TIMESTAMPTZ. This is a data migration, so batch carefully, test on staging first. Also annotate all relevant schema.prisma `DateTime` fields with `@db.Timestamptz` so Prisma's future `migrate dev` diffs stay aligned.

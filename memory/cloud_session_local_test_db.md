---
name: Cloud sessions local disposable test database
description: Cloud sessions cannot reach prod Postgres; the Folio environment setup script provides a local Postgres 16 + pgvector at localhost:5432/folio_test. How to run DB tests, seed, dev server against it.
type: project
---

# Cloud sessions: local disposable test database

**Problem:** Claude Code cloud sessions can only egress over an HTTPS proxy. Raw TCP to the Supabase pooler (ports 5432/6543) is refused, so Prisma cannot reach prod from the cloud. `prisma migrate status`, prod recon, and DB-backed tests all fail there.

**Solution:** The "Folio" cloud environment's setup script starts a local Postgres 16 with pgvector and builds the schema via `prisma db push` into `postgresql://postgres@localhost:5432/folio_test`. `migrate deploy` is not used because the migration history does not bootstrap from an empty database (the earliest timestamped migration assumes a pre-existing `users` table).

**Running DB-backed work against it:**

```bash
# DB-backed core suite (runner requires a disposable target whose name contains "test")
CORE_TEST_DATABASE_URL=postgresql://postgres@localhost:5432/folio_test CORE_TEST_DATABASE_DISPOSABLE=1 npm run test:core:db

# Seed or run the dev server against the local DB
DATABASE_URL=postgresql://postgres@localhost:5432/folio_test DIRECT_URL=postgresql://postgres@localhost:5432/folio_test npm run seed
DATABASE_URL=postgresql://postgres@localhost:5432/folio_test DIRECT_URL=postgresql://postgres@localhost:5432/folio_test npm run dev
```

Do not export the local URL as `DATABASE_URL` when running `test:core:db`; the runner refuses a test target that matches the configured app database.

**Still unavailable from the cloud:** anything that needs prod data or `_prisma_migrations` bookkeeping. Do that from a Remote Control session on the founder's machine.

**Other cloud gotchas:** `npm run typecheck` needs `NODE_OPTIONS=--max-old-space-size=6144` or Node runs out of heap after printing PASS. AI keys must be plain environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) on the cloud environment, not network secrets: the app reads them from `process.env` and the proxy exempts api.anthropic.com.

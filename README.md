# Folio

Interior designer project archives, AI-interviewed into structured data.

## Database migrations

Prisma is pinned to `6.18.0` (see `package.json`). Always invoke via `pnpm prisma ...` — `npx prisma` resolves to the latest major (currently 7.x) and will fail with `P1012` on our datasource block.

Supabase does not let Prisma auto-create a shadow database, so a local pgvector-enabled Postgres runs on port 5433 for `prisma migrate dev`:

```sh
pnpm run prisma:shadow:up     # start the shadow container
pnpm run prisma:status        # safe, read-only
pnpm run prisma:shadow:down   # stop (data volume retained)
pnpm run prisma:shadow:reset  # stop + wipe volume, fresh start
```

Set `SHADOW_DATABASE_URL=postgresql://shadow:shadow@localhost:5433/shadow` in your `.env.local`. The shadow DB is ephemeral — `prisma migrate dev` will reset it each run.

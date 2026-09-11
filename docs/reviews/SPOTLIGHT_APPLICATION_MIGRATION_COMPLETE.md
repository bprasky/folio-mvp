# Spotlight application migration — completed 10 September 2026

PR [#766](https://github.com/bprasky/folio-mvp/pull/766) merged using the normal merge-commit method as `d5f3dcf10d4acf737ffd5f9dfc86e5e4e2bf55ff`. Exact reviewed head `ce61d06b2c4807b9d67cb450a1a645016bca4820` had passing current-head checks, including both isolated PostgreSQL suites and the strict unchanged 904-error TypeScript ratchet. The checkout was fast-forwarded to merged main without overwriting unrelated work. This follow-up records results only.

## Verified target and recovery

- Supabase organization **Folio**, project **MVP**, production branch **main**, project reference `gwdkhgejsyvynqzolyau`.
- Authenticated dashboard identified the production branch and its production environment connection to Vercel project `folio-mvp`. Configured API, pooled application and session migration URLs all identify that project. Live app/direct queries confirmed the same PostgreSQL system fingerprint and database. No conflicting ambient target variables were present.
- Dashboard lists a **PHYSICAL scheduled backup, 2026-09-10 10:00:42 UTC**, with Restore available. Its reference is that timestamp within this project's Scheduled backups page. Recovery availability was verified; restoration was not executed. Storage objects are excluded from database backups; this migration does not change them.
- Exactly one pending migration; 107 previously applied; no unresolved failure, missing local history or unexpected spotlight tables. The historical rolled-back `20260709163000_add_pdf_extractions_skeleton_items` attempt was preserved.

## Application and postflight

Migration: `prisma/migrations/20260910180000_add_product_spotlight_draft_selection/migration.sql`.

Normalized-LF SHA-256, also the actual recorded migration checksum:

```text
77fa2afe19f2f1e61d344f54d78381ca18d862b795e48edca9b3101c939291ab
```

Status, guard and apply used the same inherited environment through `node --env-file=.env --env-file=.env.local <installed npm CLI> run ...`. The approved `npm run migrate:deploy` chain applied only this migration, exit 0. It started **19:48:43.529 UTC**, finished **19:48:43.800 UTC**, and is not rolled back.

Postflight passed:

- Migration status up to date: 108 applied, zero unresolved failed/unfinished attempts.
- Exact catalog comparison against reviewed disposable evidence: two tables, all 18 columns/defaults, eight FKs and delete/update actions, four CHECKs, two partial unique indexes, seven ordinary indexes, two primary-key indexes.
- RLS enabled on both tables, zero policies, both owned by `postgres`.
- Actual `anon` and `authenticated` roles have no SELECT/INSERT/UPDATE/DELETE/TRUNCATE grants, no superuser/BYPASSRLS privileges and no usable ownership role. No synthetic browser-role assumption was used.
- Actual Prisma application connection is `postgres`, the owner with BYPASSRLS and table privileges. Supabase `service_role` has BYPASSRLS but **no table grants**, so it is not an alternative writer without a separately reviewed privilege change. None was made.
- `product_spotlights`: **0 rows**; `product_spotlight_tags`: **0 rows**.

Full sanitized catalog/history/role evidence: `SPOTLIGHT_APPLICATION_MIGRATION_RESULTS.json`. No credentials, connection strings, personal data or individual record IDs are included.

## Deployment remains held

The authenticated dashboard revealed Supabase **Deploy to production** enabled for `main`, independently of Vercel. The user explicitly authorized disabling that one setting; it was saved and verified off after reload before merge. Automatic branching, branch limit and Supabase-files-only settings were unchanged. `vercel.json` still contains `git.deploymentEnabled: false`. Repository webhooks were empty and inspected merge workflows contain no application migration/deployment path. A missing status was not used as proof of prevention.

Both controls remain off. Normal Vercel Git deployments require the previously documented, separately authorized removal of its hold; Supabase automatic production deployment requires a separate decision to re-enable its setting for `main`. This run does not authorize either restoration. Existing Vercel credential synchronization was not changed.

No deployment, public activation, UI/service change, backfill, Shop repair, external message, or later schema milestone occurred. The database milestone is verified; durable scheduled questions and immutable answer revisions await the next request.

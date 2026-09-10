# Canonical spotlight draft selection — levels A/B handoff

10 September 2026. **Level A is installed; level B SQL execution is blocked. Keep this PR in draft until the disposable PostgreSQL suite passes. The application database has not been migrated.**

## Baseline and exact scope

- Repository: `bprasky/folio-mvp`; branch: `codex/spotlight-spec-foundation`.
- Reviewed baseline: `a483ec202b66f588ec85cddcc34a745e92af269f`.
- Fetched `origin/main`: `8af4ce97dd6d85345c8e0a926a3c55ac82d4b306`; no incoming main changes at installation.
- Approval source: `docs/reviews/CANONICAL_SPOTLIGHT_DRAFT_SELECTION_REVIEW_PACKET.md`, unchanged. All five approved artifact hashes match; `scripts/check-spotlight-install.cjs` contains and checks them.
- Migration directory: **`prisma/migrations/20260910180000_add_product_spotlight_draft_selection`**.
- SQL SHA-256, normalized LF: **`77fa2afe19f2f1e61d344f54d78381ca18d862b795e48edca9b3101c939291ab`**. SQL is an exact copy, including its historical proposal-only comment. The user's subsequent A/B authorization permits this installation and disposable execution.
- Added only `ProductSpotlight`, `ProductSpotlightTag`, and seven inverse fields across six existing models. Prisma formatting changed only spacing in these additions. Static token comparison against the reviewed baseline proves no other schema changes.
- Canonical schema backed up before editing to local `tasks/schema-prisma-backup-spotlight-level-ab.prisma`; backup is not committed. Restore this backup and stop if format/validate/generate fails before committing; do not overwrite later unrelated changes.
- No backfill, Shop repair, public activation, route/UI/service changes, questions/answer tables, external messages, application database writes, merge or deployment. Prior specification/audit/proposal commits remain on this branch.

## Merge, deployment and migration are separate

The reviewed commit had a successful **Vercel** Git status linking to a deployment. Automatic Git deployment was therefore active before this change. `vercel.json` previously had no deployment suppression. Its build command is `prisma generate && next build`, which does not apply migrations. Inspected all checked-in GitHub workflows and package lifecycle scripts: none automatically run `migrate deploy`, `db push`, SQL application, or deployment on merge.

This PR adds exactly `"git": { "deploymentEnabled": false }` to `vercel.json`. **With that file intact, pushing this branch and merging this PR disables Vercel Git-triggered deployment, and no checked-in automation applies the database migration.** This project-wide hold also affects subsequent Git pushes until deliberately changed. It leaves the currently served deployment running. Manual CLI/dashboard deployment remains a separate action; do not run it as part of migration. Vercel documents this control in [Git configuration](https://vercel.com/docs/project-configuration/git-configuration).

The live dashboard's override settings, separate external hooks and deployed database environment binding were not verified from authenticated dashboard access. The evidence above is repository automation plus the recorded Vercel integration status; recheck for independently configured automation before merge. The repository suppression is intentional so the known Git integration cannot combine the user's separate steps. Do not enable auto-merge or remove the hold while this work is waiting on database approval.

## Validation actually performed

| Check | Result and limit |
|---|---|
| Fetch, reviewed artifact hashes and patch applicability | Passed; no semantic drift requiring proposal changes |
| Canonical Prisma format, validate, generate | Passed, Prisma 6.18.0; database URLs overridden to an unreachable loopback placeholder |
| Installed schema token comparison and exact SQL hash | Passed; two models/seven inverses only, SQL unchanged |
| Migration-discipline guard | Passed: loose SQL 32/32; phantom callers 0/0; missing SQL 0/0; non-idempotent DDL 0/0 |
| Existing migration-connection tests | All 15 assertions passed using installed Git Bash for the script's POSIX grep step; initial Windows default-shell attempt failed in that step. These are subprocess/configuration tests, not SQL execution |
| Client-import boundary and Product Record invariant guards | Passed; zero violations |
| Next.js compile-mode build | Completed with existing `FaNotes` and `getServerSession` import warnings; no deployment or prerendering. The first npm shell attempt failed; installed CLI execution completed |
| TypeScript diagnostic ratchet | **FAILED**: 904 errors before and after; 47 newly rendered diagnostic fingerprints with the approved generated client. Baseline-schema generation exactly matches the committed budget; file/error-code counts are identical. No budget change or waiver was made |
| New harness/checker JavaScript syntax | Passed |
| Disposable PostgreSQL suite | **BLOCKED before container creation: local Docker Linux engine pipe unavailable** |
| Migration execute/replay, catalog inspection, constraints, races, deletion, RLS, transaction rollback | **NOT RUN**; no SQL acceptance results |
| `db:guard` and Prisma migration status against the disposable target | **NOT RUN**; no accessible isolated server. Not redirected to the application database |
| Application database status/postflight | Not refreshed or applied in this task; prior 10 September recon is historical evidence only |
| Cross-project authorization, shared-toggle UI, interview/resume | Not implemented or tested in this migration |

The attempt is captured in `docs/reviews/SPOTLIGHT_LEVEL_AB_RESULTS.json` with an empty test-results array and `status: blocked`. Docker Desktop startup diagnostics report a crash while initializing its local inference socket (`dockerInference`: file cannot be accessed / invalid filename syntax). Starting the installed runtime did not produce an available daemon. No PostgreSQL binaries are installed on PATH. Repairing the workstation's Docker installation is an outstanding operational prerequisite; no paid infrastructure was provisioned.

The TypeScript comparison generated a client from the backed-up schema without editing the active schema, measured diagnostics, and restored the approved client in a `finally` block. Both schemas produce 904 diagnostics and identical counts for every file/error-code pair; the baseline schema has zero new fingerprints against the committed budget. The approved client produces 47 changed fingerprints. One example is TS2339 for the already-missing `ActionItem.room`: the printed object type moves `projectId`/`roomId` before `status`/`description`. This is evidence of type-display ordering changes, not a passing strict guard. `docs/reviews/SPOTLIGHT_TYPESCRIPT_COMPARISON.json` records counts and the changed fingerprint pairs for review. Resolve the ratchet failure before ready-to-merge; do not silently expand or replace the diagnostic budget.

## Disposable harness and remaining acceptance

Run from the repository root on a machine with a working local Docker engine:

```powershell
node scripts/check-spotlight-install.cjs
node scripts/test-spotlight-postgres.cjs
```

The harness accepts **no target/URL arguments**, omits application/PG/Docker-remote environment variables, verifies the chosen Docker context uses a local Unix/named-pipe endpoint, and creates a uniquely named/labeled `postgres:17` container. It sets `--network none`, no TCP listener, no published ports, no host mounts and tmpfs data storage. SQL is sent with `docker exec` to that container's Unix socket. Every SQL call revalidates its exact container ID, nonce label, image, isolation and mount/port configuration. It never loads application env files. It pulls only the public PostgreSQL image if absent, records its resolved image ID and removes only its verified disposable container afterward.

`scripts/spotlight-postgres/fixtures.sql` defines synthetic TEXT identity tables and relevant existing FK/delete paths, including Project → Room/ProjectImage → ProductTag cascades and ProductTag → Product cascade. This is a minimal prerequisite skeleton, not the full application schema or a production-data copy. Other application-table restrictions may still affect real deletion workflows. `catalog.sql` reads the actual catalog without individual records. The suite records its result at local `tasks/spotlight-postgres-results.json`.

All the following cases are authored but **unexecuted**:

- Exact SQL application, initially empty tables, two tables/18 columns/eight FKs/four CHECKs/nine secondary indexes plus two PK indexes, two RLS enables and no policies.
- XOR publisher identity; positive version; trimmed/bounded values; referenced row existence; personal/studio confirmed-room uniqueness (also for deselected rows); distinct variants/finishes.
- Two photo tags sharing a row and tag-primary-key uniqueness; unresolved rows coexisting; conflicting resolution rolling back; explicit transactional source transfer to one canonical draft.
- Overlapping personal and studio duplicate inserts, with the winner holding an uncommitted key before the competitor starts; one winner and one unique violation.
- Tag deletion preserving a still-selected draft and remaining source; last source deletion preserving the draft; room SET NULL without automatic version bump; project cascade chain; product, personal/studio publisher and selector restrictions; spotlight-to-source cascade.
- Synthetic `anon` and `authenticated` roles with table grants still unable to read/insert/update/delete through RLS; a synthetic privileged `service_role` with BYPASSRLS successfully reading/writing. This does not prove the actual application's role configuration.
- Deliberate cross-project insertion succeeding as a demonstration of missing service validation, not an authorization pass.
- Exact SQL replay with and without data; injected division-by-zero before COMMIT in a disposable copy proving DDL rollback; exact-file retry and replay. This does not simulate Prisma migration bookkeeping recovery.

After Docker is available, execute and review the suite, then run the existing `db:guard`/Prisma status in a separately verified disposable setup if testing that pre-apply chain. The network-disabled harness intentionally offers no host database URL. Do not weaken its isolation or substitute the application database to make a guard pass. Publish real catalog/test evidence and resolve any failures before marking this draft ready.

## Invariants and known deletion restrictions

| Database-enforced by the reviewed SQL | Requires future server code |
|---|---|
| Exactly one non-null publishing identity, with referenced identity existence | Identity actually represents the project's personal/studio publisher; selector is authorized |
| FK existence for project/product/room/tag | Room and tag image belong to this project; tag product matches spotlight product; source validity and user/org membership |
| Confirmed-room unique key per publisher/project/product/room/variant/finish | Normalization beyond edge-space trimming; retry/upsert/merge policy and conflict response |
| NULL room excluded from partial unique indexes; each tag links once | Transactional reconciliation when a room is confirmed; merge private state deliberately |
| Positive `selection_version` | Compare-and-swap, version increments, stale-write rejection; SQL does not auto-increment or auto-update timestamps |
| Cascade/SET NULL/RESTRICT; RLS without browser policies | Shared-toggle UI, last-source eligibility, interview invalidation/resume and answer retention |

Deleting one photo tag removes only its source link; it does not change `is_selected`. Deleting the last source also leaves the draft. Room deletion sets room to NULL, preserves selection and does not bump `selection_version`. Project deletion cascades its spotlight drafts and links. Product, personal publisher, studio publisher and selector deletion are **restricted while any referencing draft exists**, even when deselected or unresolved. Existing application account/product deletion paths must handle this restriction deliberately; this PR does not modify them. A user who owns other records may also face pre-existing restrictions.

The future shared toggle acts on one spotlight row: turning it off from one associated photo deselects that shared spotlight everywhere. Planned UI copy must explain the shared effect and photo count, and source removal must be a separate action. None of that UI is exposed or tested here.

## Manual application handoff — only after the execution blocker is resolved

1. Review the draft PR, actual disposable results and exact SQL/hash. Merge yourself when satisfied. Keep `git.deploymentEnabled: false`; merging must not deploy or apply SQL. Fetch the resulting main commit locally and confirm the migration file/hash again. Obtain a verified backup/recovery point for the **intended application database** before application. No backup was made of that database in this task.
2. Verify the intended Supabase project/environment in its dashboard and compare both configured application and direct connection targets to that project. The database name alone (commonly `postgres`) is not sufficient identity proof. Verify the deployed environment binding independently if that is the target you intend. Use a direct/session PostgreSQL connection on the appropriate non-transaction-pooler port; no `pgbouncer=true`. Do not print credentials, full URLs or env files. Check for stale ambient connection variables, since they override env files.
3. Make status, guard and apply inherit the **same** env values. The package guard loads `.env.local` before `.env`, while Prisma independently loads `.env`; merely running separate bare commands can use differing targets. One Windows approach is Node's env-file loader around the installed npm CLI (omit a file flag only if that file does not exist):

```powershell
$npmCli = Join-Path (Split-Path (Get-Command npm.cmd).Source) 'node_modules/npm/bin/npm-cli.js'
if (-not (Test-Path -LiteralPath $npmCli)) { throw 'Resolve the installed npm CLI before continuing' }
# These flags put .env.local over .env; existing process values still take precedence.
node --env-file=.env --env-file=.env.local $npmCli run prisma:status
```

The repository-approved apply command is **`npm run migrate:deploy`**, which runs `npm run db:guard && prisma migrate deploy`. With the same inherited environment, its Windows invocation is:

```powershell
# STOP unless the status report's entire pending list has been reviewed.
node --env-file=.env --env-file=.env.local $npmCli run migrate:deploy
```

Do not run that second command as part of preparing this PR. It is the user's later application step. Prisma deploy applies **all pending migrations**, not just the named directory. Expected pending scope is solely `20260910180000_add_product_spotlight_draft_selection`; if anything else is pending, missing locally, divergent or failed, stop and review it before application. The historical recon recorded 107 applied migrations and one rolled-back old attempt; it is not a fresh pending-list check. A nonzero status caused solely by the expected pending migration is normal before apply; inspect the text instead of assuming every nonzero result is safe.

4. **Postflight, before any deployment:** rerun `prisma:status` using the same wrapper and require “up to date,” with no failed/unfinished migration. In the verified database's SQL editor/privileged client run `scripts/spotlight-postgres/catalog.sql`. Require two tables, eight FKs with the reviewed delete/update actions, four checks, both partial unique indexes with their complete keys/predicates, seven ordinary indexes (11 total including PKs), RLS enabled on both and zero policies. Verify the application role is privileged as intended and browser roles have no superuser/BYPASSRLS membership. Require **both new table counts to be zero** before feature services exist. Inspect `_prisma_migrations` for the exact new migration's finished/non-rolled-back row and checksum. Status checks bookkeeping; they do not prove actual catalog parity. Return this sanitized evidence to Codex; no credentials or individual records.
5. Deployment and subsequent service implementation remain separate. Restore automatic Git deployment only in a deliberate later change, or explicitly deploy through your chosen process after database postflight. Do not expose the incomplete feature.

## Failure and rollback guidance

If the apply command fails, **stop**. Preserve redacted logs, exact commit/SQL hash, migration status and catalog evidence. Inspect whether the transaction rolled back and whether a failed bookkeeping row exists. Do not run `db push`, `migrate reset`, `migrate dev`, or `migrate resolve --applied` as a shortcut. Never mark unapplied SQL applied. Do not drop potentially populated tables.

The reviewed SQL wraps DDL in BEGIN/COMMIT. Successful rollback should leave no partial new objects, but that is a hypothesis until verified against the actual target (and the disposable fault test has not run yet). If a failed Prisma attempt is confirmed fully rolled back, review recovery before marking that failed attempt `--rolled-back` and retrying the exact migration. If objects exist, definitions differ, data exists, or SQL success/bookkeeping disagree, stop for a specific recovery plan; `IF NOT EXISTS` does not validate pre-existing object definitions. Prefer a reviewed forward repair that preserves stored data. Reverting schema/client code can stop use of additive tables; it is not a database rollback. A populated-database rollback requires a separately reviewed data-preservation/recovery plan.

## Outstanding artifacts and next milestone

Required before ready-to-merge: working disposable PostgreSQL execution, actual catalog/RLS/concurrency/delete/rollback evidence, review of any SQL failures, successful applicable pre-apply guard testing on a verified disposable target, and resolution of the strict TypeScript fingerprint failure. The draft PR does not imply level B passed. User-only later steps: merge, intended-target verification, backup, pending-list review, application and postflight. Deployment remains withheld.

After the user returns successful application verification, separately design/review durable scheduled questions (stable IDs/order/versioned text), immutable answer revisions (append-only with concurrency control), saved-answer resume and deselection behavior. Implement tagging → canonical selection → stable question schedule → immutable save/readback → refresh/resume, then test interruption/retry, multiple tabs, deselection/reselection, source deletion and stale room changes privately before exposure. No later schema is authorized by this migration.

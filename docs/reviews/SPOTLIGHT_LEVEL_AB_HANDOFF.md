# Canonical spotlight A/B handoff — application migration still unapplied

[Draft PR #766](https://github.com/bprasky/folio-mvp/pull/766). The local Docker blocker is superseded by successful isolated CI execution. No application database was contacted or migrated, no merge/deployment occurred, and the feature remains unexposed.

## Exact approved scope

- Reviewed baseline: `a483ec202b66f588ec85cddcc34a745e92af269f`; installation: `17286e2ec42e01e97537f4f3d8a7ea72789beb54`.
- Migration: **`prisma/migrations/20260910180000_add_product_spotlight_draft_selection/migration.sql`**.
- SHA-256 (LF): **`77fa2afe19f2f1e61d344f54d78381ca18d862b795e48edca9b3101c939291ab`**.
- Two models and seven inverse fields; approved schema/SQL/packet unchanged. `scripts/check-spotlight-install.cjs` checks every approved artifact hash and installed schema tokens. Canonical schema was backed up before installation.
- No backfill, Shop repair, public publication model, feature/UI/service change, interview schema, external message, or application database write.

## Actual acceptance and separate reviews

**Direct SQL: 23 groups passed.** PostgreSQL 17.11 in a network-disabled container on the existing Ubuntu Actions runner: exact application/replay, actual columns/eight FKs/four CHECKs/partial indexes/RLS, personal/studio uniqueness and overlapping duplicate transactions, shared sources, unresolved reconciliation/rollback, all requested deletions, browser-role denial and privileged access, populated replay and DDL fault rollback. Two tables/18 columns/11 total indexes (nine secondary plus two PK), no policies, initially zero rows. Exact evidence: `SPOTLIGHT_SQL_CI_RESULTS.json`.

**Migration command: 10 groups passed in a separate container/database.** Executed the unchanged repository `npm run migrate:deploy` chain (`npm run db:guard && prisma migrate deploy`). Verified the actual Prisma engine's socket/database/server identity/nonce; inherited target overriding both conflicting synthetic env files; pending and extra migrations; mismatched database names; transaction-pooled fallback rejection; exact applied checksum; clean postflight status; command replay; and failed synthetic migration rollback followed by refusal without rewriting failed bookkeeping. Exact evidence: `SPOTLIGHT_COMMAND_CI_RESULTS.json`.

Both suites passed in [Actions run 34517538985](https://github.com/bprasky/folio-mvp/actions/runs/34517538985), commit `e00861b14148a2d94578aa7111318c3d79fd8887`. Downloaded artifact SHA-256 verified: `b6487486e94054e550ff4ad2a7c687ef19a6df1ec9776ebd63fb7067209db23e`. Repository copies survive artifact expiry. `SPOTLIGHT_LEVEL_AB_RESULTS.json` preserves the superseded blocked local attempt as historical evidence.

**TypeScript: passes locally and in CI with the unchanged 904-error budget.** Seven regression groups and the complete ratchet passed. Full source-span/type/assignability proof verifies 45 type-property ordering changes and two different witnesses of the same incompatible assignments. Only 47 exact file/code/message alternatives are recognized; multiplicity and genuine-new-error rejection remain enforced. Separate review: `SPOTLIGHT_TYPESCRIPT_RATCHET_REVIEW.md`, full proof JSON, and commit `8b93e8c393b7901cc4089dfd9dee147f09e0bbc7`. CI results are recorded in the readiness report. No budget update or application-source change was made.

**Deployment hold retained.** See the separate `SPOTLIGHT_DEPLOYMENT_HOLD_REVIEW.md`. The documented Vercel Git path is disabled for branches carrying `git.deploymentEnabled: false`, including main after merge and derived preview/custom branches. Existing deployments remain served. The setting does not disable other projects or prove independent manual/API/hooks cannot deploy. **Absence of a status is not proof of prevention.** Checked-in merge workflows do not apply the application migration; the new disposable workflow is pull-request-only and receives no application secrets.

## Reproduction and isolation

On an authorized Linux development machine with working local Docker, or through `.github/workflows/spotlight-disposable.yml`:

```bash
npm ci --ignore-scripts
node scripts/test-spotlight-postgres.cjs
node scripts/test-spotlight-migrate.cjs
```

The existing Ubuntu runner uses read-only repository permission and checkout without persisted credentials. No application environment secrets are supplied. Actual image: PostgreSQL `17.11 (Debian 17.11-1.pgdg13+2)`, image ID `sha256:7296f210ae81031ec955dbad9a67a84fe958572a2153b8d0826a647522904dc1`; harness tag `postgres:17`.

Direct SQL uses Docker exec/Unix sockets, `--network none`, no TCP listener, ports or host mounts, and tmpfs data. Command tests retain network isolation and add only a socket bind in a newly created private temporary directory, never app files/data. Both verify exact container identity/labels/mounts and accept no target arguments. Command tests validate every URL against that socket and prove PostgreSQL system identity/database/nonce through Prisma before apply. Prerequisite and failure migrations exist only in the scratch workspace, with a distinct disposable shadow database. Verified containers and scratch resources are removed afterward. No paid service was provisioned.

## Manual application — user's later action

1. Review the migration and the **separate ratchet and operational changes**, plus completed CI. Merge yourself when satisfied, preserving the hold. Fetch merged main, recheck the SQL hash, and establish a verified backup/recovery point for the intended database.
2. Verify the intended Supabase project/environment in its dashboard. Confirm the application and direct connection bindings, and independently verify the deployed environment if that is the intended target. A shared database name such as `postgres` is insufficient. Verify the actual direct/session endpoint, non-transaction-pooler port and options. The existing guard compares database names and checks transaction pooling on fallback; it is not a universal target/project verifier. No application target was freshly verified here.
3. Use **one inherited environment** for status, guard and apply. Check stale ambient variables first. The guard loads `.env.local` then `.env`, while Prisma separately loads `.env`. Explicit inherited values win in both; that behavior was tested. Windows invocation for the currently installed npm layout:

```powershell
$npmCli = Join-Path (Split-Path (Get-Command npm.cmd).Source) 'node_modules/npm/bin/npm-cli.js'
if (-not (Test-Path -LiteralPath $npmCli)) { throw 'Resolve installed npm CLI first' }
# Omit a file flag only if absent; ambient variables override both files.
node --env-file=.env --env-file=.env.local $npmCli run prisma:status
```

Review the **entire pending list**. Expected scope is only `20260910180000_add_product_spotlight_draft_selection`. Stop for other pending migrations, failed attempts, divergent/missing history. The tested guard reports extra pending migrations but does not reject them. Deploy applies **all pending migrations**, not one named folder. Historical recon is not a current pending-list check.

4. Only after verification, execute the repository-approved **`npm run migrate:deploy`** with the same inherited target:

```powershell
node --env-file=.env --env-file=.env.local $npmCli run migrate:deploy
```

No credentials, complete URLs or env-file contents need to be printed/shared. Do not substitute `migrate dev`, `db push`, reset, or SQL bookkeeping shortcuts.

5. **Postflight before deployment:** rerun status with that wrapper and require up to date. Verify the exact new `_prisma_migrations` row is finished/not rolled back and has the SQL checksum; require no failed/unfinished migration. In the verified privileged SQL client run `scripts/spotlight-postgres/catalog.sql`: require exact eight FKs/delete/update actions, four CHECKs, both partial unique keys/predicates, seven ordinary indexes plus PKs, RLS enabled and no browser policies. Verify browser roles lack superuser/BYPASSRLS privileges and the actual server role is appropriately privileged. Require **both new table counts zero**. Status checks history, not actual catalog parity. Return sanitized results without credentials or individual records.
6. Deployment remains separate. Keep the hold through postflight and until you explicitly decide to deploy. Later, remove only the `git.deploymentEnabled: false` entry in a separate operational change. Its **first push can trigger preview deployment**, and merge can trigger production; authorize deployment before that push. Build remains `prisma generate && next build`, which does not migrate the database.

## Restrictions and failure handling

Tests confirm project cascade; tag deletion removes only its source; last-source deletion preserves the draft; room deletion sets NULL without bumping version; product, either publisher and selector deletion are RESTRICTED while referenced, even by deselected/unresolved drafts. Fixtures reproduce relevant parent cascades, not every application dependency. Deletion services must account for these restrictions.

Identity XOR and referenced-row existence are enforced. Authorization, same-project room/tag/product consistency, normalization beyond trimming, version/CAS handling, source eligibility and merge policy require services. The suite deliberately proves cross-project associations are accepted by the database. Shared-toggle UI and interview/resume are not implemented or tested. No next milestone is started.

On application failure: stop and preserve redacted logs/hash/history/catalog evidence. Verify actual rollback; successful disposable fault tests are not permission to assume the real target rolled back. Never mark unapplied SQL `--applied`, erase failed bookkeeping to bypass the guard, or drop potentially populated tables. Only after confirming a failed attempt fully rolled back, review recovery before `migrate resolve --rolled-back` and retry. Existing objects, differing definitions, data, or SQL/history disagreement require a specific data-preserving recovery/forward-repair plan. `IF NOT EXISTS` does not validate definitions. Reverting schema/client code is not database rollback.

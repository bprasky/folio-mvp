# Publishing Studio editorial readiness persistence review

Status: proposed only; no canonical schema edits, migration application, or live data writes.

## Change summary and classification

Add three narrowly scoped tables for actor-owned candidates, immutable evaluated versions, and events tied to the exact evaluated source. Classification: **additive**. No backfill is required; existing exports, campaigns and queue items remain intact.

Exact review artifacts:

- `docs/reviews/studio-readiness-proposed.prisma`: three model blocks, no User/Organization/Project edits.
- `docs/reviews/studio-readiness-proposed.sql`: idempotent table/index creation, internal foreign keys, positive-version checks, RLS enabled.

## Reconnaissance

Read-only transaction executed on the configured production database on 2026-09-21. `users.id`, `organizations.id`, and `projects.id` are all PostgreSQL text. None of the three proposed tables exists. Migration bookkeeping contains 111 records, zero unfinished, and no migration matching studio candidates/editorial readiness. No StudioCandidate models or delegate callers existed at reconnaissance time. No connection strings or row content were logged.

Reproduce: `node tasks/readiness-candidates-recon.cjs`; metadata output is `tasks/readiness-candidates-recon.json`.

## Contract

`StudioCandidate.id` is a deterministic hash of the authenticated actor, exact workspace (including a distinct personal-workspace sentinel), and stable source identity. Store `designerId` as the authenticated actor, never from request input; `organizationId` is the freshly resolved workspace. Project IDs are an authorized source set, not authority to read those projects.

`StudioCandidateVersion` has a composite primary key `(candidateId, version)`. `sourceVersion` fingerprints all evaluated source facts. `snapshot` stores original evidence, score components, blockers, selection and validated decision context; it must not be overwritten after creation.

`StudioCandidateEvent` has its own unique ID for idempotency and a composite foreign key `(candidateId, version, sourceVersion)` to the version record. Events cannot claim a source version different from the immutable version they reference. Candidate deletion cascades to versions and their events.

`saveCandidate` writes the new snapshot, primary action event and associated scored/ready/suppressed events in one transaction. A failure recording any associated event rolls back the candidate pointer, immutable snapshot and all events. Independent shown/opened/exported events use `appendEvent` and must match the current saved source/version.

No cross-domain foreign keys are proposed, to avoid unreviewed User/Organization inverse changes. Account/workspace removal therefore requires explicit service cleanup or retention policy. A future FK change must be separately reviewed.

## Ownership and caller audit

Existing workspace resolution: `resolvePublishingStudioContext` in `src/lib/publishing-studio/data.ts:16`; it checks active organization membership. The implemented store uses `canAccessDesignerTools` from `src/lib/permissions.ts:91` for actor role policy.

Every new mutation must recheck authenticated actor, current workspace membership/role, candidate actor/workspace ownership, and authorized source-project set within the transaction. A candidate ID or previously loaded Studio payload alone is insufficient. Compare expected current version/source fingerprint before applying a transition; reject stale requests. Serialize first writes and version increments with conflict handling/row locking. Versions and events are append-only in the service; candidate currentVersion/state/updatedAt change atomically with their corresponding snapshot and event.

| Proposed caller | Audience | Filter verdict |
| --- | --- | --- |
| Candidate list / resume | Authenticated author workspace | Actor + exact current workspace + authorized source projects; retain incomplete draft evidence |
| Evaluate / prepare / mark ready | Authenticated author mutation | Same ownership + role checks inside transaction; published/included/confirmed requirements belong to readiness evaluation, not blanket author-source filters |
| Event history / observability | Authenticated author workspace | Same ownership boundary; no public endpoint |

`authorize()` / `authorizeSource()` in `src/lib/publishing-studio/readiness/store.ts` lock and recheck user role/current workspace, writable active membership, public project ownership, and PUBLISHED post state within every write transaction. Image/room rows and direction queue/angle rows are locked; the canonical source is rebuilt with the same transaction and its fingerprint checked before persistence. Store operations reject calls unless `STUDIO_EDITORIAL_READINESS=true`. The service must supply actor identity from the authenticated session. Schema application remains pending.

## Validation

- Temporary full schema (`tasks/readiness-candidates-validation.prisma`) validates using the repository's installed Prisma CLI.
- `node scripts/check-readiness-schema-postgres.cjs` passes against disposable in-memory PostgreSQL: DDL rerun, duplicate-version rejection, orphan rejection, exact source/version event FK, positive currentVersion, RLS flags, cascading cleanup.
- No production migration or table write occurred. Disposable PostgreSQL checks establish DDL behavior, not application authorization.
- `node scripts/check-readiness-store-postgres.cjs` executes the actual TypeScript store against disposable PostgreSQL with an adapter for parameterized queries. It passes disabled-flag denial, immutable version history, stale/duplicate-save conflicts, actor/source ownership denial, workspace-change denial, event idempotency and source/version binding, persisted score integrity, and latest-version reads.
- `node scripts/check-readiness-service.cjs` executes real service orchestration with inert adapters: browsing has no writes/AI/impressions, source/version changes reject writes, designer edits retain attributed evidence, scoped images are enforced, publication requires explicit action on a ready candidate, and a provider result cannot persist after source changes. Store tests also reject unpublished/private sources and changed transactional source fingerprints.
- Atomic lifecycle regression: the disposable PostgreSQL test deliberately rejects a secondary scored event and verifies that no candidate, version, or primary event survives rollback. Service tests verify scored/ready events are passed into the same save operation.

### Reproduce disposable PostgreSQL checks

Run from the repository root with existing repository dependencies installed. PGlite is a test-only external runtime, not a new application dependency. Both scripts use `READINESS_PGLITE_PATH` (an absolute package entry-file path) when set, otherwise `require.resolve('@electric-sql/pglite')`. To install the verified version into a disposable directory in PowerShell:

```powershell
$readinessPgDir = Join-Path ([IO.Path]::GetTempPath()) ('folio-readiness-pg-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $readinessPgDir | Out-Null
npm install --prefix $readinessPgDir --no-save --package-lock=false @electric-sql/pglite@0.5.8
$env:READINESS_PGLITE_PATH = Join-Path $readinessPgDir 'node_modules/@electric-sql/pglite/dist/index.js'
node scripts/check-readiness-schema-postgres.cjs
node scripts/check-readiness-store-postgres.cjs
Remove-Item Env:READINESS_PGLITE_PATH
```

These scripts create only in-memory PostgreSQL databases; they do not read database connection credentials or write to a configured database. The isolated package installation leaves repository package manifests and lockfiles unchanged.

## Approval and commands

AGENTS.md requires the exact SQL/model blocks to be reviewed before application. Print the three model blocks and SQL to the user, then obtain scoped approval before touching canonical schema/migrations. Back up canonical schema first; if format/validate/generate/migrate-status fails, restore backup and stop. Rerun production metadata/status before application to detect intervening changes.

After approval, create a timestamped migration containing this reviewed SQL and append these exact model blocks. Safe local migration sequence with verified dev-only database configuration:

```text
npm run migrate:create-only -- --name studio_readiness_candidates
npm run migrate:safe
npm run verify:prisma
npm run db:check
npm run prisma:status
```

Review generated SQL before applying. Use migration commands rather than schema push for this scoped three-table migration. For approved production deployment, after local checks and backup:

```text
npm run db:backup
npm run migrate:deploy
npm run prisma:status
npm run verify:prisma
npm run db:check
```

**Existing command blocker:** `npm run db:check` points to missing `scripts/db-check.ts` at reconnaissance time. Do not expand this change into reconstructing that general-purpose script or report it as passing. For this scoped migration, document substitute verification explicitly: query `information_schema.columns` for the exact proposed columns/types/nullability; inspect `pg_constraint` for primary/foreign-key/check constraints; inspect `pg_indexes` for the proposed indexes and `pg_class.relrowsecurity` for all three tables; verify `_prisma_migrations` has the expected finished record and zero unfinished records; and run `npm run prisma:status` plus `npm run verify:prisma`. Combine this live metadata/status evidence with the two disposable PostgreSQL constraint/transaction suites above. This substitute validates this migration's scope, not the missing general command. Inspect database guard/backup command availability before invoking the sequence; this document records prescribed commands, not successful application.

Rollback: disable the readiness persistence feature and retain new tables/data. Dropping tables destroys candidate history and requires separate review; no automatic down migration is proposed. No existing application table needs reverting.

## Adapter guidance and risks

- Prefer generated Prisma delegates after schema approval. A server-only parameterized `$queryRaw`/`$executeRaw` adapter is acceptable to prepare integration before approval, but must remain behind an off-by-default feature flag until the migration exists. Never interpolate identifiers or use client-side direct Supabase writes.
- RLS has no client policies; privileged server connections still require application ownership checks. RLS does not replace them.
- `currentVersion` is positive but is not a database FK to its child, avoiding a circular insert dependency. The transaction must maintain this pointer and state consistently.
- Version immutability and legal state/event vocabulary are service contracts, not database triggers/enums. Regression tests should cover stale version races, cross-actor/workspace denial, idempotent events, source changes, and preservation of saved work.
- There are no User/Organization FKs, so deletion cleanup must be explicit.

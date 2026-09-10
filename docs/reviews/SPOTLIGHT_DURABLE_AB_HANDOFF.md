# Durable spotlight interview — A/B handoff

The approved files are installed and the isolated SQL/command gates passed. [PR #767](https://github.com/bprasky/folio-mvp/pull/767) remains draft and unmerged. Scope is the 10 September packet's two-model/two-inverse-field schema and exact SQL. No services/UI, grants, backfill, application migration, merge, deployment or exposure is authorized here.

| Required gate | Result | Actual evidence |
|---|---|---|
| Baseline and exact artifacts | PASSED | No incoming main drift; all four normalized-LF hashes below verified; installed SQL and Prisma tokens match the reviewed artifacts |
| Prisma/schema checks | PASSED | Prisma 6.18 format, validate, generate; backup created before edit; migration guard passes (32/32 loose SQL, zero other debt counters) |
| TypeScript diagnostic gate | PASSED locally and in CI | 904 baseline / 904 current; no new diagnostics; seven ratchet regressions pass, including genuine new-error rejection. CI Prisma/Next compilation and strict diagnostic gate passed. Budget, display equivalences and checker unchanged |
| Existing repository CI | PASSED | ESLint, core regression journeys, product-record invariants, migration discipline, Prisma/Next compilation and TypeScript diagnostic ratchet on implementation commit 471337e5 |
| Disposable PostgreSQL/direct SQL | PASSED | 26 groups on PostgreSQL 17.11, exact catalog plus CHECK/trigger/DML/deletion/concurrency/rollback assertions; all passed on first CI execution |
| Migration command and target binding | PASSED | 10 separate groups: actual guarded npm chain, engine/socket/server/nonce binding, env precedence, sole pending migration, extra pending surfaced, mismatch/pooler rejection, checksum/history, command replay and failed-history refusal |
| Working local Windows Docker | BLOCKED; alternative execution completed | Docker Desktop Linux pipe unavailable; actual execution used the existing Ubuntu CI runner's local Docker, without weakening isolation |
| Provenance correction and deletion/private-reader review | PASSED as documentation | Actual field corrected; endpoint and reader requirements listed below. Runtime integrations are not implemented/tested |
| Deployment controls | PASSED for preservation | Vercel Git hold unchanged; no Supabase management-setting request, retaining the previously verified production hold. No fresh Supabase dashboard inspection is claimed |

Evidence: [run 34533487564](https://github.com/bprasky/folio-mvp/actions/runs/34533487564), tested implementation commit `471337e506272af1132ff25a95cc3cc2c20c9b7e`. Artifact `10174541417` ZIP digest verified as `8100d3197e078586c8708769a041706d2b3a9929332baf00d7c90efa34d5f7bb`; durable SQL/command results and full catalogs are preserved in `docs/reviews/SPOTLIGHT_DURABLE_AB_RESULTS.json`. SQL ran 21:42:44.781–21:43:16.154 UTC; command suite ran 21:43:16.204–21:43:46.633 UTC on 10 September. Both containers were removed. The earlier draft-selection SQL/command suites also passed in the same job.

Catalog evidence confirms two tables/31 columns, six RESTRICT/RESTRICT FKs, eleven CHECKs, five ordinary unique secondary indexes, one partial unique, three nonunique and two PK indexes, two exact trigger-function bodies and five enabled triggers, RLS enabled and zero policies. Full CHECK definitions were inspected against the reviewed SQL; every named predicate is exercised by the SQL matrix. Both new tables began empty. Populated replay retained four synthetic questions/four revisions byte-for-byte through JSON comparisons, including IDs, text and current heads. The command suite independently verified initially empty tables and one successful checksum-matching migration-history row; its final intentional failed synthetic migration was preserved until disposable cleanup.

Schema installation is implemented; disposable execution is complete; **the new application migration remains unapplied**. No application database was contacted. The application-role behavior recorded in the previous migration is not presented as a fresh role test for these new tables.

Baseline: `e55e8b0434a82174ceaebc2652f7e8dd4c8091b1`; fetched main `d5f3dcf10d4acf737ffd5f9dfc86e5e4e2bf55ff`, no incoming drift. All four reviewed artifact hashes pass `node scripts/check-spotlight-durable-install.cjs`; model/inverse/patch/SQL artifacts remain unchanged. Migration directory: `prisma/migrations/20260910210000_add_spotlight_durable_interview`. Normalized-LF migration SHA-256: `50adeaf12a7b402181769746caed685ba3c0a5b58821528f83cffa397e5e2c10`.

Canonical schema backed up locally to `tasks/schema-prisma-backup-durable-ab.prisma` before installation. Prisma 6.18 format, validate, generate, exact token scope and migration discipline pass. Restore the backup and stop if those installation checks fail. Existing user changes to `SPOTLIGHT_APPLICATION_MIGRATION_COMPLETE.md` are excluded.

| Reviewed artifact | Verified normalized-LF SHA-256 |
|---|---|
| models.prisma | `2559d6f6f77ccf819912ee9c372fbde79a508fe2bd5e8702f778fa20066b1cad` |
| inverse-fields.txt | `8c38f1cf724c6644d2c26f3c2aba23a18884eef74a2ba906f7d6da4f4d91d84d` |
| schema.patch | `b4adb1c49440f67777d9298975be3310805189608d2f300760adb130beb6f8b9` |
| migration.sql | `50adeaf12a7b402181769746caed685ba3c0a5b58821528f83cffa397e5e2c10` |

Changed files beyond the installation are the exact-scope checker, durable SQL/catalog/contract and command harnesses, extension of the existing disposable workflow, documentation/evidence and task/lesson records. Existing scripts/guards, package scripts, diagnostic budgets, source services/UI and deployment settings remain unchanged. The PR also carries the already committed preceding application-results/review documents. No semantic change to the approved four artifacts was needed.

## Review corrections and boundaries

The actual Prisma field is `ProjectPost.provenance` (schema and `loadInterviewAnswers` confirm it). Both narrative copies now use that exact field; no adapter explains the former `provenanceJson` name and no schema field was renamed. The four approved artifacts and migration hash are unchanged.

Retaining the reviewed restrictions for A/B does **not** approve a permanent product retention policy. An unanswered scheduled question already references its spotlight with RESTRICT; project cascade therefore also fails. Question DELETE/TRUNCATE triggers and answer UPDATE/DELETE/TRUNCATE triggers preserve history. Retirement does not release these restrictions. A never-scheduled draft retains existing cascade behavior. The SQL suite distinguishes each case.

### Deletion integration required before exposure (not implemented)

Concrete existing hard-delete paths include:

- `src/app/project/[id]/actions.ts::deleteProjectAction`, invoked by `DeleteProjectButton.tsx`.
- `DELETE /api/projects/[id]` and `DELETE /api/projects` (`src/app/api/projects/[id]/route.ts` and `src/app/api/projects/route.ts`).
- `DELETE /api/projects/[id]/force-delete`, which currently hard-deletes archived projects.
- `src/app/api/deletion-requests/[id]/route.ts`, approval branch that deletes the project.
- `src/app/api/user/delete/route.ts`, which deletes unpublished projects inside account deletion; a restricted project can roll back that larger transaction.

Before any scheduling exposure, each must detect durable scheduled history under the appropriate transaction/lock and return a stable 409 `DURABLE_INTERVIEW_HISTORY_RETAINED` (or equivalent typed action result), with archive/retire as the available non-destructive action. Do not convert it to a generic 500, claim successful deletion, approve a deletion request whose delete failed, or silently bypass the FK/trigger. The comment in `/api/projects/[id]` suggesting every future FK blocker should be repaired is inapplicable to this deliberate restriction. Account erasure needs a separately reviewed retention/purge decision; do not silently fail after partial external cleanup or invent permanent retention. Test failure/rollback of the whole account operation. A new spotlight deletion service must apply the same rule. No endpoint change is part of this A/B installation.

### Private reader tests required before projection integration/exposure (not implemented)

Seed a distinctive private accepted answer both in durable revisions and a derived EditorialInterviewAnswer row, plus the private `provenance.interview.spotlightDrafts` mirror. Include a normal legacy answer as a positive control. Assert filtering by authoritative durable question identity even if questionSource is absent/spoofed. Required concrete checks:

- `src/lib/posting/loadInterviewAnswers.ts`: editorial/public mode excludes durable drafts from both provenance and projection; private interview mode returns exact authorized current revisions and preserves normal answers.
- `src/lib/posting/headlineSlots.ts` and `src/app/api/posting/project/[projectId]/sections/pull-quotes/backfill/route.ts`: no private draft reaches headline/quote candidates, generated content or model input.
- `src/app/api/posting/project/[projectId]/interview/generate/route.ts`: both provenance path and projection fallback exclude drafts from editorial generation; spy on actual model input and persisted generation output.
- `src/app/api/posting/project/[projectId]/sections/[chapterIndex]/regenerate/route.ts`: no private draft in section context, quote extraction or generated/persisted text.
- `src/lib/atelier/extractDesignerReasoning.ts`: no private draft enters downstream reasoning extraction without a separate explicit private-purpose authorization.
- `GET /api/posting/[slug]` (`src/app/api/posting/[slug]/route.ts`) currently returns `post.provenance` directly in its published response. It must redact the private subtree **before any future private mirror write, including an allowlisted project that already has a published post**. Seed that exact case and assert no spotlightDrafts subtree, draft wording or accepted-text sentinel in the anonymous response while normal published fields remain. This is a concrete exposure blocker, not implemented privacy protection.
- `GET /api/magazine/posts` and its `src/lib/magazine/getFilteredPosts` serializer: assert the same exclusion in listing output. Enumerate remaining public project/post response callers during integration; do not infer privacy from one loader test.
- Private interview resume and `src/app/api/interview/respond/route.ts`: authorized private access works; cross-project/actor and inactive publisher roles fail; normal room/project responses survive.

Test the real reader/API paths with disposable persistence; mock external model calls only to inspect prompts deterministically. Projection rebuild and reverse sync must not remint durable IDs, accept new revisions, or leak them into legacy public arrays. No privacy integration or API authorization has been implemented or tested by this migration suite.

## Execution and deployment controls

Local Windows Docker is unavailable: the Docker Desktop Linux pipe does not exist, including outside the sandbox. Use the repository's existing Ubuntu Actions runner with PostgreSQL 17. Each database is network-disabled with no TCP listener/host ports, temporary storage, scrubbed environment and a nonce-bound container verified before SQL. The command suite additionally binds Prisma to a private temporary Unix socket and verifies database nonce/physical server identity; it copies no application environment files. Synthetic prerequisite migration bookkeeping belongs only to the temporary harness. No application migration command is executed here.

Reproduce on a Linux development/CI checkout with existing dependencies and a local Docker Unix socket: `node scripts/test-spotlight-durable-postgres.cjs`, then `node scripts/test-spotlight-durable-migrate.cjs`. Neither accepts target arguments. The second script creates a fresh temporary checkout/schema/history and executes the unchanged `npm run migrate:deploy` there. It does not run that command against this workspace's configured application environment. The reviewed catalog is `scripts/spotlight-durable-postgres/catalog.sql`. CI uses PostgreSQL 17.11 image ID `sha256:7296f210ae81031ec955dbad9a67a84fe958572a2153b8d0826a647522904dc1`.

RLS tests used synthetic anon/authenticated roles with no grants, then temporary grants inside rolled-back adversarial tests to demonstrate row-policy denial. Synthetic service_role remained ungranted; privileged postgres access worked. No grant was added to the migration or application. SQL deliberately permits unheaded revisions and semantically dishonest object snapshots: payload-hash equality/conflict receipt handling, cross-project authorization, eligibility, pointer/projection atomicity and browser resume require the future service transaction and reader integrations.

Vercel `git.deploymentEnabled: false` is retained. Supabase production deployment remains disabled as recorded/reload-verified in the application handoff; this run makes no management-setting request. CI workflow changes only extend the existing disposable test job, not deployment. No status absence is used as proof of deployment prevention. Keep the PR draft; merge/application migration and restoring either hold remain separate explicit decisions.

Rollback guidance: before applying to an application database, schema files can be reverted through review. In a failed application attempt preserve redacted logs, catalog and migration bookkeeping; do not mark unapplied SQL applied, erase failed history, disable the retention triggers or drop potentially populated tables. Once accepted history exists, disable the future flow and retain data pending a separately reviewed forward repair/retention decision. A/B success is not authority to run application migration commands.

## Next bounded milestone

After A/B review: implement server-only default-off cohort gating, canonical selection/eligibility and stable scheduling; atomic exact-text acceptance with CAS/idempotency and explicit reuse; private provenance/current-head/projection integration; then connect real tagging, shared controls, save and restart/reload resume. Complete deletion/archive handling and the reader tests above before any cohort exposure. SQL tests cannot prove payload-hash conflict behavior, API authority, semantic eligibility, projection atomicity or browser recovery. No further schema expansion is implied.

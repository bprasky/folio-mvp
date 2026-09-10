# PR #766 — A/B readiness

The exact approved migration remains installed and **unapplied to the application database**. PR #766 is kept in draft for the user's review; no merge, deployment, external message or feature milestone was started.

| Gate | Result | Actual evidence |
|---|---|---|
| Disposable PostgreSQL/direct SQL | **PASSED** | 23 test groups on PostgreSQL 17.11: exact SQL application/replay, actual catalog, constraints, personal/studio concurrency, sources/reconciliation, deletion, RLS and transaction rollback |
| Migration command and target binding | **PASSED** | 10 separate groups using the unchanged `npm run migrate:deploy` chain: verified socket/server/nonce, env precedence, pending list, mismatches, pooler fallback, checksum/history, replay and failed-history refusal |
| TypeScript ratchet | **PASSED locally and in CI** | Seven regression groups including checked-JavaScript validation; full repository budget 904 → 904; all 47 rendering changes independently verified, no baseline increase |
| Deployment hold review | **PASSED; hold retained** | Distinct operational review explains branch/environment scope, merge behavior, evidence limits and the deployment-authorized restoration step |

The database evidence is from [run 34517538985](https://github.com/bprasky/folio-mvp/actions/runs/34517538985) at `e00861b14148a2d94578aa7111318c3d79fd8887`. Both containers were removed successfully. Local Docker remains broken; the authorized existing Ubuntu CI runner provided the working local Docker environment. No application secrets/data or paid service were used.

Exact migration: `prisma/migrations/20260910180000_add_product_spotlight_draft_selection/migration.sql`.

**SHA-256 (LF): `77fa2afe19f2f1e61d344f54d78381ca18d862b795e48edca9b3101c939291ab`.** The schema, SQL and all five reviewed artifact hashes are unchanged. Final baseline fetch found no incoming main commits; `origin/main` remains `8af4ce97dd6d85345c8e0a926a3c55ac82d4b306`. Application source has no diff from the reviewed baseline.

## Evidence and separately reviewable changes

- `SPOTLIGHT_SQL_CI_RESULTS.json`: actual catalog, 23 passed groups, isolation and cleanup.
- `SPOTLIGHT_COMMAND_CI_RESULTS.json`: 10 passed groups, real command logs, applied checksum and catalog, isolation and cleanup.
- `SPOTLIGHT_TYPESCRIPT_FULL_PROOF.json`: all 904 source-span matches, 84 full property-order differences plus two identical complete assignment witnesses; 47 affected short fingerprints.
- `SPOTLIGHT_TYPESCRIPT_RATCHET_REVIEW.md`: narrow exact-equivalence comparison and adversarial evidence. Dedicated change `8b93e8c393b7901cc4089dfd9dee147f09e0bbc7`; checked-JavaScript fixture correction `5aedab7814bbf0d5c2830ffe8250fdb2ff32ef5e`.
- `SPOTLIGHT_DEPLOYMENT_HOLD_REVIEW.md`: distinct operational review in `a5389bcd8c285feff3c93f1eebbc890e40073791`. No removal/change of the hold in this follow-up.
- `SPOTLIGHT_LEVEL_AB_HANDOFF.md`: current manual target/pending-list/application/postflight/failure steps. The earlier blocked local JSON and original TypeScript comparison remain as historical evidence, not the final gate result.

Changed execution files: `.github/workflows/spotlight-disposable.yml`, `scripts/test-spotlight-postgres.cjs` (wait for final server), and `scripts/test-spotlight-migrate.cjs` (separate guarded-command suite). Ratchet files: `scripts/check-typescript-budget.mjs`, its test, `scripts/review-typescript-display.mjs`, `tools/typescript-display-equivalences.json` and lint workflow path triggers plus a 4 GiB heap ceiling on full TypeScript analysis only. Supporting review/evidence files and task notes changed. **No application source, active schema, migration SQL, TypeScript baseline budget or Vercel setting changed in this follow-up.**

The finite equivalences preserve all file/code/message distinctions except the 47 proven exact alternatives. Changed messages/types, codes, files, multiplicity, same-total substitutions, compiler-version changes and new real compiler errors remain strict. The normalized-LF hash of the unchanged 904-error budget is `29d6552945a5335d20b77165679e8b1472349085f07646dce7b46167e55012ea`.

## Merge and remaining user actions

With the hold intact, Vercel's documented Git deployment path is disabled for main after merge and branches carrying that file. No checked-in merge workflow applies application migrations. Other branches with old configuration, independent hooks or manual/API deployments are not covered by a claim of verified prevention. A missing status is not prevention evidence; see the separate hold review.

Review the exact migration, ratchet change and operational hold before merging. Then verify the intended application/deployed target independently, establish recovery capability, inspect **all** pending migrations, and run the repository-approved `npm run migrate:deploy` using one consistent inherited environment. Require clean migration history, actual FKs/checks/partial indexes/RLS and initially empty new tables afterward; return sanitized results. Do not drop populated tables or mark unapplied SQL applied on failure. Restore Git deployment only in a later explicit change; its first push may deploy.

Service authorization/cross-project checks, shared-toggle UI, durable questions/answers and interview/resume are not tested or implemented by these database gates. The synthetic tests are not proof of the application database's actual role bindings or every pre-existing deletion dependency.

## Final CI

All code gates passed at `2e1fd318dda9408c76c0f32b1084ec32b291b7d8`: [TypeScript, ESLint and core regression journeys](https://github.com/bprasky/folio-mvp/actions/runs/34519540724), [disposable PostgreSQL](https://github.com/bprasky/folio-mvp/actions/runs/34519540726), [migration discipline](https://github.com/bprasky/folio-mvp/actions/runs/34519540691), and [product record invariants](https://github.com/bprasky/folio-mvp/actions/runs/34519540746). The final evidence commit changes only review documents, retained result JSON and task notes; it does not change the tested code. PR remains draft for user review.

The prior TypeScript CI attempt exhausted the default 2 GiB Node heap after preparation and baseline-integrity checks. The separate two-line workflow correction in `2e1fd318` raises only the analysis step to 4 GiB. The subsequent full analysis passed without changing the 904-error baseline or suppressing diagnostics.

Final compiler output (job `103013314381`; seven guard tests also passed, zero failures):

```text
2026-09-10T19:24:19.1196549Z Baseline: 904
2026-09-10T19:24:19.1197468Z Current: 904
2026-09-10T19:24:19.1198467Z Delta: +0
2026-09-10T19:24:19.1199602Z PASS — No new TypeScript diagnostics.
```

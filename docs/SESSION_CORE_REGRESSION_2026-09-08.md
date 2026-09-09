# Folio session summary — Core regression journeys

Date: September 8, 2026  
Branch: `codex/folio-hardening`  
Implementation commit: `3714d284025fc3fb792031d5b5b178fd1dea7608` — committed and pushed to origin.

## Outcome

Implemented executable regression coverage for all five core product journeys using the existing Node test runner and installed tsx. Added no dependencies, schema changes or infrastructure. The same journey implementation supports deterministic local orchestration tests and an explicitly disposable PostgreSQL database.

**CORE REGRESSION JOURNEYS COMPLETE**  
**IMPLEMENTATION COMPLETE — LIVE DATABASE EXECUTION PARKED**

## Changes

| File | Change |
| --- | --- |
| `scripts/core/journeys.test.cjs` | Five real-handler journeys, reused for local and optional database execution. |
| `scripts/core/harness.cjs` | Deterministic external services, framework request context, real Credentials/JWT/session callbacks and middleware. |
| `scripts/core/memory-db.cjs` | Schema-informed stateful database double for local orchestration, with unsupported operations rejected. |
| `scripts/core/fixtures.cjs` | Reusable fixtures and disposable database safety gate. |
| `scripts/core/safety.test.cjs` | Tests for acknowledgement, application database identity rejection and isolated test targets. |
| `scripts/core/run-db.cjs` | Strict live-database command that fails when no disposable target is configured. |
| `src/app/api/projects/route.ts` | Project PUT now uses canonical write authorization; forbidden and missing targets return 403/404. |
| `src/app/api/projects/[id]/route.ts` | Private project read denial returns 403 instead of generic 500. |
| `package.json` | Added `test:core` and `test:core:db`. |
| `.github/workflows/lint.yml` | Added Node 20 core regression job using existing workflow triggers. |
| `docs/CORE_REGRESSION_JOURNEYS.md` | Full architecture, assertion matrix, commands, findings and limitations. |
| `tasks/todo.md` | Completed checklist and verification review. |

## Journey coverage

1. **Signup and onboarding:** duplicate signup rejection, password hashing and credential verification, legal consent, signed session cookie, DESIGNER onboarding, active organization ownership, bio/preview completion, middleware landing and workspace persistence readback.
2. **Project and product tagging:** project owner/designer/org links, room creation, image upload, canonical room assignment, product tag coordinates/finish, Selection links and separate canonical project readback.
3. **Ownership isolation:** anonymous and outsider requests denied; unauthorized edit/tag attempts leave data unchanged; viewer can read but cannot edit; organization member and owner can edit.
4. **Interview and editorial:** three saved answers and interview projection, actual generation with deterministic LLM output, same ProjectPost identity through DRAFT/REVIEW/PUBLISHED, stable repeated approval, public slug identity, preserved provenance and unpublish visibility.
5. **Vendor/designer collaboration:** mounted story invitation workflow, duplicate rejection, designer acceptance, vendor title edit and list readback, unrelated vendor denial. Selected because CreateButton and MobileMenu mount the collaboration creation surface.

## Verification results

| Check | Result |
| --- | --- |
| Core suite | 8 passing tests: five journeys, parent group and two safety tests; zero failures; one live-database group explicitly skipped |
| Strict database mode without configuration | Exits 1 as intended |
| Production build | PASS |
| TypeScript ratchet | PASS: 1,006 diagnostics before and after; zero new fingerprints |
| Ratchet guard tests | 5 passing |
| Client import guard | PASS |
| Changed-file lint | Zero errors; 14 existing route warnings |
| Prisma validation | PASS |
| Migration discipline | PASS |
| IDOR scan | Unchanged: 558 files; 0 critical, 1 existing high, 16 medium, 19 low |

The TypeScript baseline remains unchanged at 1,006 diagnostics, 638 fingerprints and 260 files. No baseline increase or redesign occurred.

## Run commands

From the repository root:

```powershell
npm run test:core
```

For an already provisioned disposable PostgreSQL database containing the current schema:

```powershell
$env:CORE_TEST_DATABASE_URL = '<disposable PostgreSQL URL>'
$env:CORE_TEST_DATABASE_DISPOSABLE = '1'
npm run test:core:db
```

CI runs the local suite on the existing lint workflow's matching PRs, main pushes and manual dispatch. It does not provision a database or inject database secrets.

## Limits and parked work

- No disposable database was available. Live execution was explicitly skipped; no production mutation tests were run.
- Local database doubles prove application orchestration, not PostgreSQL constraints, isolation or durability. Optional real Prisma tests use an outer rollback transaction with separate reads; they do not prove committed or concurrent behavior.
- External LLM, storage, embeddings and email boundaries are deterministic fixtures. Application authorization, generation, projection and lifecycle remain real.
- Browser UI, OAuth, the complete HTTP NextAuth CSRF/callback flow and concurrent publication are outside this suite. Signed cookie parsing and middleware are covered.
- P0 runtime verification remains parked pending Linux/Upstash infrastructure.
- Earlier editorial consolidation remains implemented; its live disposable-database verification remains parked.

Full technical report: [Core regression journeys](CORE_REGRESSION_JOURNEYS.md).

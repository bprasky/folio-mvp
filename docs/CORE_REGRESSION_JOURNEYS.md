# Core regression journeys

Implemented on `codex/folio-hardening`, starting at `f85d4b24674b1304524336ec3c1f54937f858d0e` (2026-09-08).

**IMPLEMENTATION COMPLETE — LIVE DATABASE EXECUTION PARKED.** All five journeys have executable coverage. No disposable database was supplied; no database was provisioned or production mutation test run. P0 Linux/Upstash verification and the earlier editorial live-database verification remain parked.

## Architecture and audit

The repository already uses Node's test runner and installed `tsx` for security/editorial scripts. The Atelier differentiation test contains Jest-style globals, but there is no configured general Jest/Vitest runner to reuse. This suite adds no dependencies or browser framework. It runs actual Next route handlers, the image assignment server action, auth callbacks, middleware, canonical reads, authorization, editorial generation/projection and publication lifecycle.

`scripts/core/journeys.test.cjs` defines five sequential journeys, reused for two execution modes. `fixtures.cjs` creates minimal users, organizations, memberships and catalogue products. `harness.cjs` replaces external SDK/storage boundaries and framework request context. `memory-db.cjs` is a strict, schema-informed, stateful orchestration double; it rejects unknown fields/operators. It does **not** implement PostgreSQL constraints, transaction rollback/isolation, ordering or durability. Local readbacks prove application orchestration only.

The optional database group runs the same handlers/assertions against an actual Prisma interactive transaction and performs separate canonical reads. Nested application transaction callbacks share that outer transaction. A sentinel rolls back every fixture at completion; this does not prove commit durability, independent-connection visibility or concurrent transaction behavior. No schema/migration changes or infrastructure provisioning are included.

Mocked boundaries: Anthropic message responses (deterministic question/article JSON), OpenAI embeddings, Resend delivery, storage upload/download and analytics storage HTTP; Next server-session acquisition, React server cache and Next revalidation context. Credentials authorization, bcrypt verification, JWT encode/decode, application JWT/session callbacks and middleware are real. Unknown fetch destinations fail the suite even if application code catches the exception. Tests replace inherited application database URLs and service credentials before loading application modules.

## Journey matrix

| Journey | Test layer | Database mode | Externals mocked | Result | Failure catches |
| --- | --- | --- | --- | --- | --- |
| Signup/onboarding | Routes, Credentials callback, signed cookie, middleware | Local double / optional Prisma | Email, session acquisition | Local PASS; live SKIPPED | Broken signup, role/timestamp transitions, password verification or session landing |
| Project/tagging | Routes, room assignment action, canonical GET | Local double / optional Prisma | Storage, embeddings/analytics | Local PASS; live SKIPPED | Lost owner/org/room/image/tag/selection links or incorrect read projection |
| Ownership isolation | Direct route calls and canonical write authorization | Local double / optional Prisma | Session acquisition | Local PASS; live SKIPPED | Outsider writes/reads, viewer edits, denied legitimate member/owner edits |
| Interview/publication | Routes, real generator and lifecycle, public slug reader | Local double / optional Prisma | LLM, storage/embeddings/email | Local PASS; live SKIPPED | Lost saved answers/provenance, duplicate post identity, invalid publication visibility |
| Vendor/designer | Mounted collaboration story route flow | Local double / optional Prisma | Session/email | Local PASS; live SKIPPED | Unauthorized story reads/edits, broken acceptance or canonical list readback |

## Exact assertions

1. **Signup/onboarding:** anonymous onboarding state returns 401; signup creates APPROVED INDIVIDUAL with diagnostic redirect, stored password hash and legal timestamps; case-insensitive duplicate returns 400. Wrong credentials fail and correct credentials identify the saved user. A real encrypted session cookie resolves through JWT/session callbacks; middleware redirects incomplete users. Diagnostic changes role to DESIGNER; project creation before organization enrollment returns 403. Solo enrollment creates active OWNER membership; bio and preview completion produce completed state, all four canonical timestamps and `/` resume path. A refreshed session passes middleware and workspace-context selection reads back the organization on User.
2. **Project/tagging:** real project POST returns 201 with owner/designer/organization identity and private visibility. Room POST and image upload link the project; the actual room assignment action sets canonical `roomId`. Tag POST associates the existing catalogue product, image, x=0.25/y=0.75 and Oak finish; its Selection links the same project/room. Separate `/api/projects?mine=true` and project detail reads preserve the image, tag/product identity, coordinates, `noProducts=false` and room. Catalogue product creation itself is a fixture, not a tested scrape journey.
3. **Isolation:** anonymous project detail returns 401. User B receives 403 for User A's private detail, project edit, tag creation, editorial initialization and publication. Project title and tag count remain unchanged. An org VIEWER/direct participant can read but receives 403 on the real PUT route and canonical write check. Promoting the membership to MEMBER permits editing; owner editing and subsequent detail read succeed.
4. **Editorial:** duplicate initialization retains one ProjectPost ID. Interview POST saves three representative answers against the room; separate ProjectPost provenance and EditorialInterview projection reads retain them. The real generation route increases external model call count, creates nonempty gallery chapters on that same DRAFT row and preserves answers/generatedAt. Public slug lookup hides DRAFT. Repeated submit remains REVIEW; owner self-publication is rejected. Admin approval produces PUBLISHED; repeated approval retains publishedAt. Public slug resolves that original row and public project. Review provenance identifies admin and preserves answers. Owner unpublish removes public access, clears project publishedAt and makes the project private.
5. **Vendor:** a PRO vendor organization/member invites the designer using the project/product references. Duplicate invitation returns 409. An unrelated vendor receives 403 for direct GET/PATCH; its attempted title is not saved. Designer acceptance produces ACCEPTED with acceptedAt; original vendor reads the same project reference, edits the title and sees it through canonical story-list GET.

The vendor workflow is canonical because `CreateButton` and `MobileMenu` mount `CreateCollaborationModal`, which calls `/api/collaboration/stories`; the collaboration invite/interview/review surfaces call the story routes. This protects the active invitation/acceptance collaboration workflow.

## Commands and CI

From the repository root:

```powershell
npm ci
npx prisma generate
npm run test:core
```

To execute live coverage, supply an already provisioned disposable PostgreSQL database with the current schema (never the application database):

```powershell
$env:CORE_TEST_DATABASE_URL = '<disposable PostgreSQL URL>'
$env:CORE_TEST_DATABASE_DISPOSABLE = '1'
npm run test:core:db
```

The gate rejects configured application hosts/identities, shared pooler identities, schema-name bypasses and database names lacking `test` or `disposable`. It checks environment and root `.env`/`.env.local` application URLs. Explicit acknowledgement is still required: a name is not proof that an arbitrary database is disposable. The strict database command exits 1 without a target; the ordinary command reports `LIVE DATABASE TEST NOT EXECUTED` and skips the group. Safety tests cover default refusal, acknowledgement, application identities and a valid isolated local target.

The existing `.github/workflows/lint.yml` now has a Node 20 core job: npm ci, Prisma generation, full local suite. It runs on the workflow's existing source/script/schema/package/config PR filters, pushes to main and manual dispatch. Any assertion, test crash, unexpected fetch or invalid configured test target fails the job. CI does not provision a database or automatically inject database secrets. Live execution remains an explicit gate.

## Testability findings and narrow fixes

- **Fixed directly, no extraction:** project PUT used view authorization, permitting direct VIEWER participants to edit and denying some legitimate organization members. It now uses existing canonical `assertProjectWrite`.
- **Fixed directly:** private detail/edit denial reached generic 500 handlers. Explicit Forbidden errors now return 403; missing edit targets return 404.
- **Handled at framework boundary:** standalone Node lacks Next's server request/cache context. The harness supplies session acquisition and cache/revalidation context while keeping application logic real. No application architecture rewrite was needed.
- **Fixture correction:** image room labels do not satisfy publication's canonical room relationship. The journey now calls the existing assignment action.
- **Still parked:** live PostgreSQL execution lacks an available disposable database. There is no missing journey implementation or demonstrated need for later architectural work.

## Verification

Production build exits 0. TypeScript baseline before/after: **1,006 diagnostics / 638 fingerprints / 260 files**, delta 0, new diagnostic fingerprints **0**; no baseline update needed. Local suite: 8 passing tests (five journeys, parent group and two safety tests), zero failures, one explicitly skipped database group. Required database mode without a target exits 1 as intended. Ratchet guard tests: 5 passing. Client import guard, Prisma validate and migration discipline pass. Changed-file lint has zero errors; existing route warnings remain. IDOR scan: 558 files, 0 critical / 1 existing high / 16 medium / 19 low, unchanged.

Validation commands: `npm run build`, `npm run typecheck` (with `TYPESCRIPT_BUDGET_BASE_REF=origin/main`), `npm run typecheck:test`, `node scripts/guard-client-imports.js`, `npx prisma validate`, `node scripts/phase5e-check-plan.mjs --ci`, `npx eslint --no-ignore scripts/core/*.cjs src/app/api/projects/route.ts src/app/api/projects/[id]/route.ts`, and `npx tsx scripts/security/idor-scan.ts --out tasks/core-idor.md`. Local evidence logs are under `tasks/core-*`; this report preserves their results without committing build output.

Material limits: live database constraints/relationships await execution; tests do not drive browser UI, OAuth, the HTTP NextAuth CSRF/callback endpoint, external service delivery or concurrent publication. Signed cookie parsing, middleware landing and server orchestration are exercised. Local doubles cannot substitute for the parked database run.

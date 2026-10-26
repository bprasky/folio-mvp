# Designer rollout authorization and integrity audit — 2026-10-26

Repository baseline: `f787200d`. Work branch: `codex/designer-authorization-audit`.
No production credentials, user content, production database, deployment or migration were used. Changes are local and unmerged.

## Evidence and role model

Read `CLAUDE.md`, current/relevant `tasks/lessons.md` and `tasks/todo.md`, `tasks/phase0-findings-20-publish-flow.md`, `docs/CORE_REGRESSION_JOURNEYS.md`, prior IDOR findings, and the current schema and permission/lifecycle implementations. Older findings are not assumed to describe the current implementation.

Global roles are ADMIN, VENDOR, DESIGNER, INDIVIDUAL, GUEST, legacy HOMEOWNER, ARCHITECT, BUILDER, DEVELOPER and PHOTOGRAPHER. They are distinct from active OrganizationUser memberships (OWNER/ADMIN/MANAGER/MEMBER/VIEWER) and ProjectParticipant grants (OWNER/EDITOR/VIEWER, including organization grants). Tests use two independent designers with separate projects, an anonymous session, shared viewer/editor participants and a global administrator. Existing suites additionally exercise firm roles, browsing accounts and vendors.

`assertProjectWrite` permits the direct owner/designer, global administrator, active write-capable firm members and granted project editors/owners. `assertProjectDelete` is stricter. Publishing requires the backing firm's active membership and posting policy; organization MEMBER publication depends on `membersCanPublish`. Global ADMIN editorial approval is a distinct lifecycle operation, not ordinary project editing. Canonical read and write helpers have different membership behavior; this audit does not rewrite them globally.

## Confirmed findings and fixes

| Severity | Reproduction / boundary | Fix |
| --- | --- | --- |
| High | Designer A sends DELETE with A's project ID and B's room ID. The old handler deletes B's selections before the scoped room deletion fails. | Delete only the scoped parent room. Existing PostgreSQL cascade/SET NULL constraints atomically handle its children. Foreign IDs and retries leave unrelated rows intact. |
| High | A shared VIEWER can POST a room or PATCH photo order because both mutations used view permission. | Use canonical write permission; retain shared reads and editor/admin writes. |
| High | Collection project DELETE accepts an EDITOR through `assertProjectWrite`, bypassing the stricter detail-route delete capability. | Both delete surfaces use `assertProjectDelete`; permission failures return 403. |
| High | Anonymous or unrelated users can enumerate tags and private photo URLs, including with no filter. | Public tag queries require current public visibility and non-pending products. Scoped authorized readers/writers retain private reads. Foreign nested project/image combinations return no data. Responses use private/no-store. |
| High | Room listing includes `vendorRep: true`, serializing the entire User row including passwordHash and other private fields. | Select only id, name and companyName. |
| High | Public article client props contain raw interview provenance, editorial history, internal project fields and excluded photos. | Remove author-only provenance/history/generation notes; explicitly select public project/photo fields and included photos. Preserve published article text, public credit identity (excluding invitation/contact fields), public product tags and authorized author projections. |
| High | A photo reference can contain another project's stored URL; deleting that reference attempts privileged object deletion based on URL path text. | Reference deletion no longer deletes storage objects. Cleanup after failed upload uses only the storage result created by that request, never a submitted URL. |
| High | Project URL import and the public publishing image proxy fetch arbitrary URLs, following redirects with no private-address protection. The proxy also publicly caches arbitrary URL capabilities. | Reuse existing pinned-DNS, size/time-bounded transport and validate each redirect. Reject unsafe protocols/addresses and non-image responses. Proxy responses use private/no-store and nosniff. |
| Medium | Tag creation, photo review state and optional Selection writes are separate; selection failures are swallowed and retries create duplicates. | One transaction, project-row lock, identical-tag reuse, atomic photo/selection updates. Four simultaneous identical requests create one tag and one selection in PostgreSQL. Moving tags clears the target photo's no-products flag atomically. |
| Medium | Project edits commit before separately writing credits; credit failure is swallowed. | Validate the edit payload using existing canonical schemas, then update project and upsert credits in one transaction. Forced credit failure rolls back the project edit. Restricted identity/publication fields remain excluded. |
| Medium | Malformed room/photo/tag/project payloads reach database/string operations; write errors can expose internal exception text. | Validate names, enum fields, coordinates, arrays, upload shape/size/MIME and JSON before side effects; return bounded generic errors. Preserve legacy project field aliases and completion-date behavior. |
| Medium | Public project filter treats historical `publishedAt` or status as sufficient even when `isPublic` is false. | Current `isPublic` is authoritative; retain the OR query shape used by existing callers. Public slug lookup still requires PUBLISHED plus isPublic, and remains dynamic. |

The new regressions were also run against original source files restored from HEAD (then the fixed sources were restored). The original-code run failed on nested room deletion, viewer writes, invalid payload acceptance, private tag visibility, complete User serialization and public interview evidence. Tests assert preserved rows and response contents, not hidden controls.

## Verification method

`scripts/core/designer-authorization.test.cjs` invokes actual Next route handlers with direct Request/NextRequest payloads. Existing auth callbacks and signed JWT encode/decode are real; framework session acquisition is controlled per isolated identity. Prisma, authorization, lifecycle and serialization code run normally. No browser login, deployed HTTP transport or production storage policy is claimed.

The suite runs both against the established schema-informed memory double and an explicitly disposable local PostgreSQL 16 container with pgvector. Prisma db push initialized only that fresh local test database; no schema or migration files were changed. Real PostgreSQL checks cover scoped deletion/cascades, independent concurrent mutation transactions, forced rollback after tag/photo writes, and project/credits rollback. The memory double is not evidence of rollback or SQL isolation. The harness now forwards transactions to an actual database when available, retaining its existing outer-transaction fallback.

The suite is included in `npm run test:core`. Real database mode requires the existing CORE_TEST_DATABASE_URL and CORE_TEST_DATABASE_DISPOSABLE safety gate. Ordinary core execution intentionally skips database groups when no disposable target is supplied. Test fixtures and failure markers contain no actual user data or secrets.

| Verification | Result |
| --- | --- |
| Focused authorization suite with disposable PostgreSQL enabled | 20 passing; no skips. Foreign IDs, actual cascades, concurrent retries and forced rollback tested. |
| Final focused local rerun after public-credit redaction | 11 passing; 1 explicitly skipped database group (database checks already executed above). |
| `npm run test:core` | 21 passing; 2 explicit optional database skips. |
| `npm run test:persistence` | 34 passing. |
| Firm posting policy + recorded-media integrity | 38 passing. |
| Project completion-date regression | 14 passing. Updated its transaction double; preserved completion precision and 422 business validation. |
| Publishing Studio story HTTP, PGlite story persistence, readiness service | All three scripts pass. |
| `npm run typecheck:prepare` | Prisma generation and Next compile build pass. |
| Final `npm run typecheck` | 904 baseline / 904 current; no new fingerprints. Baseline not changed. |
| Changed-file ESLint | Zero errors; 20 warnings. Final public projection lint also passes. |
| Client-import guard, migration-discipline guard, `git diff --check` | Pass; no schema/migration edits. |
| IDOR heuristic scan | 586 files: 11 Critical / 1 High / 18 Medium / 15 Low, versus baseline 11 / 1 / 18 / 16. No new Critical/High. |
| Original-source countercheck | 10 failing tests, 1 pass, 1 optional DB skip. Includes assertions proving foreign selections were deleted, the editor could delete via the alias, and private photo/tag data was public. Fixed sources restored afterward. |

The disposable PostgreSQL container and its test data were removed after verification. Working-tree changes remain available locally; no merge, deployment, production migration or remote push was performed.

## Remaining limits and rollout gates

- **Private photo bytes remain a storage-policy gate.** `src/lib/storage.ts` creates public URLs in the configured image bucket, and legacy/client upload paths also exist. Application authorization cannot revoke an already-public object URL. No live bucket policy or anonymous object fetch was inspected. Do not treat this audit as proof that private draft photo bytes are private. Enforcing that requires a coordinated private-bucket/signed-access design and compatibility review for existing public articles and legitimate shared/imported images.
- Photo reference deletion intentionally leaves stored bytes in place. Safe garbage collection needs ownership and reference accounting. Failed new uploads attempt compensation; a storage cleanup failure can still leave an orphan. It is logged, not reported as a successful upload.
- Exact tag retries are serialized and deduplicated; this is not a universal idempotency-key system. Repeated photo uploads or room creates can still create separate resources. No schema-level uniqueness rule for those operations was invented.
- Synthetic storage/network/AI/email boundaries do not prove hosted RLS, delivery, CDN invalidation or external provider behavior. Existing recorded-media tests verify signed-access policy with adapters, not live stored recordings.
- This is a scoped audit of the designer workflow and adjacent publishing boundaries, not a certification of all 586 API files. Legacy upload/reupload/generation/export surfaces, all firm-read inconsistencies and every concurrent permission-revocation race remain outside exhaustive dynamic coverage.
- The heuristic IDOR scanner reports pre-existing delegated-helper and retired-route findings; its raw severity labels are not confirmed vulnerabilities. Baseline scan: 11 Critical / 1 High / 18 Medium / 16 Low across 586 files. Do not use the old checked-in report's smaller route count as the current baseline.

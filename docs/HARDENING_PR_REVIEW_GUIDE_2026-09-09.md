## Deployment hold

**DO NOT DEPLOY TO PRODUCTION UNTIL SHARED UPSTASH CONFIGURATION IS PRESENT AND VERIFIED.**

**PRODUCTION DEPLOYMENT HOLD: ACTIVE — UPSTASH VERIFICATION REQUIRED**

Missing production Upstash configuration intentionally fails closed and blocks credentials login/signup. Shared configuration and live distributed verification have not been established. Do not merge if merging would automatically release this code before that gate is satisfied.

**AUTOMATIC PRODUCTION DEPLOYMENT BEHAVIOR: UNVERIFIED.** Repository workflows and `vercel.json` show CI/build configuration, not the hosting project's production-branch/automatic-deployment settings.

## Why

Harden Folio's core loop before further product iteration:

Designer project → products/tags → interview/editorial → publish → vendor relationship.

This is an integrity and simplification change, not feature expansion. Land as one PR: safe answer writers, schema constraints, canonical readers and identity changes form a verified stack.

## What changed

### Security
- Verify inbound webhook raw-body signatures before dispatch or persistence.
- Enforce shared production rate limits, with fail-closed configuration/outage behavior.
- Pin product fetches to validated public addresses and validate redirects.
- Implement an isolated protected renderer boundary; leave enablement gated on Linux verification.
- Fix critical IDOR/access gaps around prompts, projects, inquiries and product operations.

### Editorial
- Use one persisted ProjectPost lifecycle for submission, review and publication.
- Remove the legacy in-memory/filesystem submission system and repair existing Prisma column mappings.
- Preserve stable answer keys and quote provenance, including safe re-answering and verbatim checks.

### Quality rails
- Enforce a TypeScript diagnostic ratchet without expanding historical debt.
- Exercise five core journeys: signup/onboarding, project/tag persistence, authorization, interview-to-publication, and vendor collaboration.

### Simplification
- Remove three batches of obsolete UI, editorial and interview architecture.
- Retire fake-persistence APIs with explicit 410 responses, or move surviving operations to durable storage and truthful success/failure.

### Product/vendor integrity
- Keep designer-created products unclaimed without synthetic vendor Users.
- Require canonical vendor claim authorization and atomic state transitions.
- Use User identity consistently for recorded vendor sessions and boosts.
- Retire preview-token ownership claims without authorizing through legacy tokens.

### Recorded media
- Store audio privately, provide authorized short-lived signed access, and enforce upload/process lifecycle transitions.
- Validate approved quotes against saved transcripts and publish only eligible content.

## Migrations and rollback

Both branch migrations exist and are already applied to the currently configured application database; 107 migrations are up to date:

1. `20260904193000_add_row_key_unique_to_editorial_interview_answers`: guarded unique answer row-key index; no DML.
2. `20260909180000_recorded_vendor_user_identity`: guarded zero-reference FK retargeting from historical Vendor to User; no data conversion. Actual database FKs and generated schema agree.

**Any OTHER deployment target must check/run migrations in order under their existing guards.** Do not reapply the FK migration after references become populated or invent an identity conversion. Keep corrected answer writers with the unique index. Old recorded-vendor code is not semantically compatible with User-targeted FKs; code/schema rollback must be coordinated. Keep recorded objects private during any rollback.

## Final verification

Fresh local execution immediately before this PR; no application changes since the audited integrity stack:

| Check | Result |
|---|---|
| Core journeys | All five exercised; 8 tests passed, 1 disposable-DB group skipped |
| Product attribution | 8 passed, 0 skipped |
| Vendor claims | 17 passed, 0 skipped |
| Persistence integrity | 34 passed, 0 skipped |
| Recorded media, including canonical boost identity | 33 passed, 0 skipped |
| Security + editorial lifecycle | 26 passed, 2 skipped (editorial DB and Linux parity) |
| Renderer controller/worker/harness | 13 local tests passed; not Linux acceptance |
| TypeScript preparation + ratchet | Passed; 904 diagnostics / 574 fingerprints / 233 files; 0 new fingerprints; baseline unchanged |
| Ratchet guard tests | 5 passed |
| Quote/verbatim/provenance and editorial generation checks | Passed |
| Product Record invariants / client-import guard | Passed |
| Prisma validate / generated-client sync / migration discipline | Passed |
| Migration status and read-only applied/FK checks | Passed; both migrations applied |
| IDOR scan | 559 files; 0 critical, 1 high, 15 medium, 11 low |
| Production build | Passed |
| CI ESLint command | Passed; 0 errors, 3,333 existing warnings |

The IDOR high is the previously reviewed conditional add-only enrichment of an unclaimed product: the write retains `vendorId: null` and unchanged-empty-field predicates, covered by the P0 tests. This is not a zero-findings security claim. Build retains pre-existing import/browser-data warnings; it skips type/lint by existing configuration, so those checks were run separately.

Unix-shell checks were run unchanged using the existing Git Bash preload on Windows. Actual-handler tests use isolated database/external-service fixtures; they are not live end-to-end service proof.

### Explicitly parked / skipped
- Disposable DB core and editorial lifecycle journeys.
- Linux renderer adversarial network/kernel acceptance.
- Live retailer renderer parity (Linux-output parity test skipped).
- Live recorded browser/audio upload → process → approve → publish → playback.
- Live Resend delivery.
- Live Upstash independent-process/host allow/allow/reject and reset smoke.

No skipped group is counted as passing.

## Optional feature gates

- **Renderer:** remain unconfigured/disabled until Linux adversarial acceptance and live extraction parity pass. Static fetch/catalog/manual tagging remain available when core infrastructure is configured.
- **Recorded media:** do not release until deployment env contains `INTERVIEW_MEDIA_BUCKET=interview-media`, private storage access is configured and the live supported-browser journey is verified. Text interviews/core publishing do not depend on this bucket.
- **Inbound replies:** require `RESEND_WEBHOOK_SECRET` and verified signed delivery; missing configuration rejects the webhook without affecting unrelated app use.

## Review order

1. Migrations/schema and rollback coupling.
2. Auth/security boundaries.
3. Product/vendor identity and claims.
4. Editorial lifecycle and provenance.
5. Recorded-media lifecycle.
6. Deleted legacy architecture and retained 410 contracts.
7. Regression/ratchet infrastructure.

Preserve the existing commit history. Detailed inventory, rollback and failure-mode evidence: [final readiness audit](docs/FINAL_MERGE_DEPLOYMENT_READINESS_2026-09-09.md).

## Next operational gate

Upstash production readiness, not more code: configure the same backend on all production instances; run the existing distributed smoke; prove allow/allow/reject across independent processes or hosts and window reset; verify outage/missing-config fail-closed behavior; then test real credentials login and signup. No production smoke was executed without configured access, and this PR does not authorize automatic merge or deployment.

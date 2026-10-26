# Founding-designer hardening — implementation from 1020fef5

- [x] Reconcile main1020fef5, prior audit/PR826 evidence and responsivef000a0da. Preserve other checkouts.
- [x] Public filtering and protected photo storage/read compatibility; isolated byte-access and identical-upload tests.
- [x] Atomic project/credits; stable manual/project/room retries with changed-payload conflicts.
- [x] Transactional tag/Selection movement and required prior-state conflict checks; update callers.
- [x] Canonical collaborator page/API admission and distinct write/delete/publish permissions.
- [x] Reconcile responsive work with #826; verify shared dialogs, image geometry and mobile states.
- [x] Canonical publication readiness and essential profile/editor feedback.
- [x] Bounded large-photo client preparation preserving quality and retry identity.
- [x] Exact disposable PostgreSQL groups, independent concurrency/rollback/lease tests, connected authenticated Next journey.
- [x] Focused + combined tests, prepared typecheck/lint/guards, screenshots, final disposition, commit/push/reviewable PR. No merge/deploy.

Initial dispositions: R1/R5/R6/R7/R8/F1/F2 still present; R2/R3/F3 partial after826; R4 resolved in controlled tests but real lease races open; V1/V2/V3/F4 unverified. M1 hosted gate passed880/880; responsive work not merged. No new main commits beyond826. AGENTS.md is absent from tracked checkout; CLAUDE.md and current lessons read. Docker daemon unavailable; investigate native disposable PostgreSQL while proceeding.

Implementation decisions: use existing stable UUID request identities and unique row keys for project/room creation. Replaying an identifier with changed canonical data (including a record edited since creation) returns409 and never creates another object. Atomic project/post writes require no schema change. If a schema change becomes necessary, back up first and restore/stop if validation/generation fails; no production application. Protected storage activation/backfill must be explicit; no bucket visibility changes in production.


Final local implementation and verification complete. Hosted storage activation/legacy retirement, hosted smoke and physical devices remain open rollout gates; see README. PR publication is the final delivery step; no merge/deploy.


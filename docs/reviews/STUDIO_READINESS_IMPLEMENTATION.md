# Editorial readiness implementation review — 2026-09-21

Status: implemented for controlled evaluation; rollout disabled. The additive database proposal is not applied. No production content writes or paid AI calls were made.

## Delivered

- Canonical candidate snapshots with readable source evidence, attributed designer edits, assessed photographs, weighted score components, blockers and readiness.
- Quality-first selection with duplicate checks, visual repetition checks, a six-card ceiling and two-per-project cap. Weak candidates do not fill empty slots.
- Explicit bounded evaluation, workspace authorization, source fingerprint checks, immutable versions and atomic lifecycle events. Browsing does not generate content.
- Guided source/copy/credit review, versioned edits, image ordering, dismissal/restoration, exact photograph and caption downloads, and explicit social-publication attestation.
- Campaign preview and generation use the same approved candidates. The legacy saved-work view remains available.
- Source inclusion/product validity/material matching fixes and strict editorial question contracts.
- Blinded human benchmark preparation and scoring; six deterministic regression suites added to CI.

## Verification

The compile build passes with existing unrelated import warnings. TypeScript diagnostic ratchet passes without new diagnostics (904 baseline). Core tests pass: eight passed, one database integration case skipped. Publishing Studio, carousel, social-generation, room-teaser, story-activity and readiness regression checks pass. Focused lint, client-boundary and migration-discipline guards pass. Disposable PostgreSQL verifies additive DDL, ownership/source checks, immutable versions, concurrency conflicts, event idempotency and transaction rollback after an injected secondary-event failure.

The actual React components were checked in a local browser with synthetic transport: primary cards, guided completion, source evidence, photography-credit save, export gating and explicit publication attestation. This does not substitute for an authenticated database-backed journey after migration. Reproduce with `node scripts/preview-readiness.cjs`.

## Deliberate evaluation limits

- `STUDIO_EDITORIAL_READINESS` defaults off. Do not enable broadly until persistence application, authenticated journey checks and the documented human benchmark pass.
- Quick Finish conservatively requires existing quality >=80 with one to three bounded blockers. Scores65–79 stay Developing because answers do not rescore subjective quality. The spec's65-point floor is not used to promise an unreachable Ready transition.
- Claims use exact excerpts. This avoids unsupported paraphrase but still requires human review of context, editorial merit and visual judgment. No live precision, cost or reviewer-agreement result is claimed.
- Source enumeration is bounded to the100 most recently updated published projects and50 active directions; sources outside that window need a later pagination extension. Each explicit evaluation handles a bounded batch and is rate limited.
- Source metadata changes invalidate snapshots, including image record revisions. Replacing storage bytes in place without updating the image record is outside that fingerprint; source assets should use versioned URLs or update their record.
- Candidate history has no cross-domain user/organization foreign keys; account deletion/retention cleanup must be addressed before rollout beyond controlled evaluation.

## Database review

Exact additive model and SQL proposals are in `studio-readiness-proposed.prisma` and `studio-readiness-proposed.sql`; authorization, recon, test evidence and application/rollback steps are in `STUDIO_READINESS_PERSISTENCE.md`. Canonical schema and migrations are unchanged pending the project-required exact-change approval.

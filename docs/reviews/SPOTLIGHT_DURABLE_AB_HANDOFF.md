# Durable spotlight interview — A/B handoff

Work in progress; execution gates below will be replaced with actual results. Scope is the 10 September packet's two-model/two-inverse-field schema and exact SQL. No services/UI, grants, backfill, application migration, merge, deployment or exposure is authorized here.

Baseline: `e55e8b0434a82174ceaebc2652f7e8dd4c8091b1`; fetched main `d5f3dcf10d4acf737ffd5f9dfc86e5e4e2bf55ff`, no incoming drift. All four reviewed artifact hashes pass `node scripts/check-spotlight-durable-install.cjs`; model/inverse/patch/SQL artifacts remain unchanged. Migration directory: `prisma/migrations/20260910210000_add_spotlight_durable_interview`. Normalized-LF migration SHA-256: `50adeaf12a7b402181769746caed685ba3c0a5b58821528f83cffa397e5e2c10`.

Canonical schema backed up locally to `tasks/schema-prisma-backup-durable-ab.prisma` before installation. Prisma 6.18 format, validate, generate, exact token scope and migration discipline pass. Restore the backup and stop if those installation checks fail. Existing user changes to `SPOTLIGHT_APPLICATION_MIGRATION_COMPLETE.md` are excluded.

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
- Public project/post serializers and their actual published response routes: no spotlightDrafts subtree, draft question wording or accepted-text sentinel in unauthenticated/wrong-actor responses. Enumerate those response callers when implementing; do not infer privacy from one loader test.
- Private interview resume and `src/app/api/interview/respond/route.ts`: authorized private access works; cross-project/actor and inactive publisher roles fail; normal room/project responses survive.

Test the real reader/API paths with disposable persistence; mock external model calls only to inspect prompts deterministically. Projection rebuild and reverse sync must not remint durable IDs, accept new revisions, or leak them into legacy public arrays. No privacy integration or API authorization has been implemented or tested by this migration suite.

## Execution and deployment controls

Local Windows Docker is unavailable: the Docker Desktop Linux pipe does not exist, including outside the sandbox. Use the repository's existing Ubuntu Actions runner with PostgreSQL 17. Each database is network-disabled with no TCP listener/host ports, temporary storage, scrubbed environment and a nonce-bound container verified before SQL. The command suite additionally binds Prisma to a private temporary Unix socket and verifies database nonce/physical server identity; it copies no application environment files. Synthetic prerequisite migration bookkeeping belongs only to the temporary harness. No application migration command is executed here.

Vercel `git.deploymentEnabled: false` is retained. Supabase production deployment remains disabled as recorded/reload-verified in the application handoff; this run makes no management-setting request. CI workflow changes only extend the existing disposable test job, not deployment. No status absence is used as proof of deployment prevention. Keep the PR draft; merge/application migration and restoring either hold remain separate explicit decisions.

## Next bounded milestone

After A/B review: implement server-only default-off cohort gating, canonical selection/eligibility and stable scheduling; atomic exact-text acceptance with CAS/idempotency and explicit reuse; private provenance/current-head/projection integration; then connect real tagging, shared controls, save and restart/reload resume. Complete deletion/archive handling and the reader tests above before any cohort exposure. SQL tests cannot prove payload-hash conflict behavior, API authority, semantic eligibility, projection atomicity or browser recovery. No further schema expansion is implied.

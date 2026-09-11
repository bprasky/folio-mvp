# Private spotlight milestone — implementation review

PR: https://github.com/bprasky/folio-mvp/pull/768 (draft). Base: `6df286fe1b967122140d9bb0774e29527afc35bc`. This PR implements the private journey on the two previously reviewed migrations. It does not merge, deploy, enable a cohort, add grants, or change schema/migration files.

## Implemented journey

Active photo tagging (`TaggingSection` and `AdvancedTagProducts`) and tag review (`TagReviewPanel`) use the canonical selection service. A new tag never creates a selected spotlight. Duplicate confirmed scopes share one switch; deselection affects that canonical spotlight, and removing a tag only removes its source. Source-less and reassigned histories remain visible with resolution/deselection controls. Ordinary tagging no longer creates Shop entries, testimonials, vendor messages or automatic boost opportunities; the existing design-board Selection contract and separate boost endpoints remain.

The existing InterviewModal resolves the server gate before mounting a legacy interview. Enrolled projects use the private interview; disabled actors/kill switch receive a paused state. An authorized private workspace is also available at `/project/[id]/spotlight`. The UI schedules one required base per eligible selected canonical scope without optional budgets or vendor gates. It offers safe project/room questions, exact-text save, explicit durable/ordinary answer reuse, revision history, stale-draft recovery and resume. Follow-ups require an explicitly accepted base answer for that selected scope. Re-answering retires the old parent-dependent follow-up. Deselection and restoration preserve unchanged question IDs and heads.

Question wording uses a bounded vetted template and the existing canonical question validator, with a neutral selected-piece fallback. No free-form model target selection runs in this lane. Prompt/persona/rule references remain in the canonical interview prompt module. Live-model evaluation and voice capture/transcription were not run; the implemented browser journey is text acceptance. Enrolled realtime conversion is rejected rather than treating extracted or covered text as acceptance.

## Persistence and authority

`src/lib/spotlight/service.ts` owns project-locked transactions. It rechecks approved actor status, current personal/studio publisher and active studio editing permission. Lock order is project, actor/organization/membership, sources/images/rooms, spotlights, questions, then post/projection. Deadlock/serialization retries are bounded; acceptance keeps the original idempotency command.

Definitions and accepted revisions are durable. Immutable snapshots capture scope and sources; acceptance records exact text and its digest, actor/capability and studio membership when applicable. Prompt policy and semantic identity versions are separate. The database protects immutable definitions, append-only revisions, monotonic heads and structural constraints. The service supplies eligibility, cross-project consistency, authorization, stale-version checks, replay-payload comparison and atomic head/provenance updates.

Reuse is limited to the same current project/publisher. The UI shows source wording and exact text and requires a confirmation checkbox. A durable source uses its immutable revision ID; an ordinary source uses its stable provenance question key and exact-text digest. Both requests bind destination versions and source identity/text. The service rereads source and authority under the mutex. Changed ordinary text or stale destination conflicts. A reminted projection row ID is never used as a reuse identity.

The private provenance subtree has `schemaVersion: 1`, `answersByQuestion` and `eligibilityByQuestion`; current mirrors contain exact accepted text and stable question/revision references. Rebuild preserves ordinary provenance and preexisting projection-only ordinary answers while durable history stays authoritative. Selection alone does not create a missing post. Existing post status, slug and publication metadata are preserved.

Implementation choice for review: durable answers are deliberately **not copied into EditorialInterviewAnswer**. The private UI joins durable records directly; only ordinary answers enter that projection. Authoritative-ID reader filtering still rejects missing/spoofed private labels. This reduces the number of places containing private text while preserving the packet's private mirror and resume contract.

## Reader and writer boundary

Public post responses, shared project-post responses and draft recovery strip `spotlightDrafts` and authoritative durable identities. Filtering runs before text mapping/deduplication. It does not trust `questionSource`, and database lookup failure does not return unfiltered content.

Protected readers include `loadInterviewAnswers` (headline/pull-quote consumers), editorial generation fallback/override sources, section regeneration, Atelier extraction, completed-answer processing, prompted project questions, and aesthetic/profile readers in the designer page, aesthetic endpoint and project action. The normal project listing/detail serializers do not select post provenance or durable answer relations.

Full-root ProjectPost interview writers were checked: interview POST, transcription, questionSet/factDigest helpers, follow-up generation, editorial generation, reverse sync and realtime conversion are blocked for enrolled projects before their legacy work. The room-rename cascade now acquires the project mutex before reading/replacing provenance. Spotlight/ordinary saves read fresh state within that same mutex. PromptedQuestion.provenance belongs to another model; it is not a ProjectPost writer. Section overrides and unrelated editorial blocks do not replace the private provenance root.

Enrollment uses server environment only: `SPOTLIGHT_INTERVIEW_V1=true` **and** membership in both comma-separated `SPOTLIGHT_PROJECT_IDS` and `SPOTLIGHT_ACTOR_IDS`. All are absent/default-off in the shipped configuration. Keep project enrollment IDs when pausing; use the kill switch or actor list to pause access. Removing project enrollment is not the supported kill-switch procedure. No client parameter can enable the lane.

## Deletion and rollout

`SPOTLIGHT_HISTORY_RESTRICTS_DELETION` is returned before cleanup from project collection/detail deletion, force deletion, deletion-request approval, the project server action and account deletion. Scheduling an unanswered question already restricts hard deletion. Client delete controls show the service message. The guard and delete share a transaction; account checks run before anonymization. Existing archive behavior is not replaced with a new retention policy. The baseline force-delete code still references an unavailable `archivedAt` field for non-spotlight projects; this PR does not repair that unrelated path or promise an archive capability it has not proved.

Before exposure: review this PR and its evidence; resolve the preexisting design-system CI failure or explicitly review it separately; authorize a deployment/cohort independently; reverify database roles and both deployment controls for that future action. Retention/erasure beyond the existing restrictions requires separate product and migration review. Shop/publication, collaboration, social/export surfaces and unrestricted realtime integration remain out of scope.

Operational rollback: disable `SPOTLIGHT_INTERVIEW_V1` while retaining enrolled project IDs. Do not delete histories or revert the privacy filters while private records exist. Do not drop tables, change bookkeeping, or route enrolled projects into the unrestricted legacy lane.

## Application and deployment evidence

Read-only application postflight at `2026-09-11T16:30:55.789Z` verified Folio / MVP / main production (`gwdkhgejsyvynqzolyau`), matching application/direct physical targets, the user's completed durable migration, exact reviewed catalog, no unfinished migration, and empty durable tables. Actual `anon`/`authenticated` roles lack table privileges/ownership/bypass; Prisma `postgres` has privileged access. `service_role` has no table grants. Full sanitized catalog/role evidence: `SPOTLIGHT_DURABLE_APPLICATION_POSTFLIGHT.json`. This task did not run an application migration or write application test data.

The durable SQL normalized-LF SHA-256 remains `50adeaf12a7b402181769746caed685ba3c0a5b58821528f83cffa397e5e2c10`; selection SQL remains `77fa2afe19f2f1e61d344f54d78381ca18d862b795e48edca9b3101c939291ab`. Prisma schema, migrations, TypeScript budgets and deployment configuration are unchanged.

Vercel `git.deploymentEnabled: false` remains checked in. Supabase's live Folio/MVP/main Integrations page was read again during this task: Deploy to production off, Supabase-changes-only on. No settings were changed. The expanded Actions job uses secret-free synthetic fixtures and isolated Docker, not an application migration/deployment job.

## Execution evidence

Run https://github.com/bprasky/folio-mvp/actions/runs/34629564023 at `4d240cdb44b44f98e6e7ff5afcec2c5f0322c905` passed 23 real service groups and 15 browser/API groups, with two local model calls inspected. It also passed the separate 23 selection SQL / 10 selection command / 26 durable SQL / 10 durable command groups on PostgreSQL 17.11. Every disposable container was removed. The screenshot was visually inspected; controls use the existing Folio dialog/buttons. Earlier cold Next development-server runs stopped on a loading skeleton; precompiling the authenticated page after startup/restart made the final reload test pass, without mocking session or persistence.

The final run includes the early cross-project-room rejection and its adversarial test, proving corrupt room association cannot create a canonical selection.

Sanitized complete test-name/result inventory: `SPOTLIGHT_PRIVATE_MILESTONE_TEST_RESULTS.json`. Browser walkthrough image: `spotlight-private-browser.png`. Full original artifacts remain attached to the linked Actions run (seven-day retention).

The Design System Discipline failure is preexisting: gold literals in `api/projects/[id]/export-spec`, `ProjectsPageClient`, `projects/new`, `marketing/WelcomeModal` and `RoomProgressBar` match main. This PR changes the project-list deletion error message, not its old gradients. The guard was not suppressed or changed. ESLint, core journeys, pull-quote invariants, product invariants, client boundaries and migration discipline passed. The full Actions TypeScript diagnostic ratchet passed at the preceding implementation commit `3462035c`; the final guard adds no diagnostic-budget changes. Latest-head Actions may still be completing; local ratchet evidence remains 904 → 904.

Local checks: TypeScript diagnostic ratchet 904 → 904; core regression journeys 8 passed / 0 failed / 1 explicitly skipped live-database test; client-import and migration-discipline guards passed. Focused ESLint has no errors. No error budget or broad diagnostic suppression changed.

Isolation runner: `node scripts/test-spotlight-private.cjs` on authorized Linux Docker/CI; rejects external targets, uses network-disabled PostgreSQL 17, no published ports, fresh tmpfs data and a private Unix socket, verifies nonce/system identity before fixtures, scrubs application environment, and copies no `.env` files. The app uses actual Prisma services, Next routes, NextAuth and Chromium. Unused vector fixture columns use TEXT in plain PostgreSQL; all spotlight definitions come from exact reviewed SQL. External model requests are replaced with a local stub and their inputs inspected; browser external requests are blocked. The separate existing SQL and migration-command suites remain distinct checks.

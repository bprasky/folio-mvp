# Studio activity storage application — 21 September 2026

The user approved the exact four-table proposal in `story-activities/schema.prisma.txt` and `story-activities/migration.sql`. Migration `20260921220000_editorial_story_activities` applies those files unchanged: four models and inverse-only fields on User, Organization, EditorialQueueItem and ProjectPost. No existing scalar changes or backfill.

Existing Story records are ephemeral videos; EditorialDraft and EditorialInterview require a project; ProfileQA stores individually public About-page answers. None is repurposed to hold a private grouped personal interview or versioned article.

## Verification

- Fresh read-only metadata before application: all four tables absent, all referenced IDs text;112 migration records, zero unfinished.
- Schema backup: `tasks/schema-prisma-backup-studio-stories-approved.prisma`. Exact proposal copied, Prisma validate and generate passed.
- Disposable PostgreSQL applied the proposed DDL twice; approval/publication constraints, unique answer keys, positive versions and RLS passed.
- `npm run prisma:status` confirmed this was the only pending migration. `npm run migrate:deploy` passed its database guard and applied only this migration.
- `npm run verify:prisma` passes233 model and103 enum alignment. Final `npm run prisma:status` is clean.
- Live read-only postflight confirms exact SQL/model fidelity,4 RLS tables,10 foreign keys,2 state checks,10 indexes;113 migration records and zero unfinished.
- `npm run db:check` cannot execute because its pre-existing target `scripts/db-check.ts` is absent. Equivalent read-only connectivity, bookkeeping, schema and constraint checks above passed. No `schema:push` ran against the production database.

## Ownership and caller boundaries

Storage has no direct browser policies. App routes must verify current session identity, current designer-tool role and active workspace before each mutation, inside its transaction. Story activity owner reads may return unfinished drafts; public readers must follow only the approved published revision and enforce current public source eligibility. The relational foreign key does not replace these app checks.

Public profile bio synchronization is query-only. `POST /api/designer/bio/publish` verifies the session owner's current role via `canAccessDesignerTools` inside a serializable transaction and copies the approved `DesignerBio.folioBio` into `User.bio`. `PATCH /api/designer/bio/save` preserves the previous public copy and marks the edited text generated until explicit publication. Public `/api/profiles/[userId]/about` falls back to the existing public User.bio while a new bio is in draft. Private bio reads retain access to that draft.

Regression: `node scripts/check-studio-bio-publication.cjs` passes owner/role authorization, explicit synchronization, profile invalidation and draft/public isolation. Focused API lint has zero errors.

## Risks

- Restrictive foreign keys intentionally require a deliberate cleanup plan before deleting owners/source posts with authored activity records.
- Publication pointers and approval checks provide structure; ownership, immutable revisions and source withdrawal require the service-level verification described above.
- Existing database health npm script is missing; do not report it as a passing check.

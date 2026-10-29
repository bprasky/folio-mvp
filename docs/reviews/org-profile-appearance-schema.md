# Organization profile appearance — schema review

Status: approved by the founder in this chat on 29 October 2026 and applied. The nullable column is present; existing organization values were not changed. Application changes remain on the implementation branch.

## Change

One optional `Organization.profileAppearance` JSON field stores the chosen page color, banner selection/crop, identity display treatment and ordered featured facts. Existing `description`, `tagline`, `logo` and structured studio facts remain their own source fields. No new table, backfill, index or constraint is required. A missing value uses Folio defaults and existing public organization content.

Add this field immediately after `followerCount` in the existing `model Organization` block of `prisma/schema.prisma`:

```prisma
  followerCount     Int   @default(0)
  profileAppearance Json?
```

Migration `prisma/migrations/20261029120000_org_profile_appearance/migration.sql`:

```sql
-- Optional organization cover and page presentation. NULL uses Folio defaults.
-- Existing profile text, identity and organization membership remain unchanged.
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "profileAppearance" JSONB;
```

This is additive and idempotent. Deploy the column before application code that selects it. Rolling application code back leaves the nullable column safely in place; removing it would discard saved appearance choices and requires separate approval.

## Read-only audit, 29 October 2026

- Baseline: `4cde03dd` from `origin/main`, inspected in the isolated organization-magazine worktree.
- Queried `information_schema.columns` using the original workspace's configured environment through the existing `migrationConnectionUrl({ readOnly: true })` helper. The mapped `public.organizations` table exists with 39 columns. There is no appearance/settings field. Its only JSON column is `bankAccountInfo` (`jsonb`, nullable), which is unrelated and must not be reused.
- `prisma/schema.prisma` declares `Organization`, mapped with `@@map("organizations")`; all appearance-field caller searches were empty before implementation.
- Queried `_prisma_migrations`: no unfinished, non-rolled-back entries. Latest completed migration is `20261001120000_live_interview_private_media`.
- `prisma migrate status` against the latest-main schema reported 114 local migrations and “Database schema is up to date!” before adding this proposed migration.
- `node scripts/phase5e-check-plan.mjs --ci` passed at baseline: loose SQL 32/32; phantom calls 0/0; missing migration SQL 0/0; non-idempotent DDL 0/0.
- Live public-project scope recon found four `isPublic=true` projects, all with a non-null `designerOrgId`. `project_images.inclusion` is a non-null enum. Public cover selection can therefore require the exact organization, a currently public project and an `INCLUDED` photo.

No credentials, connection URLs, personal records or image contents are recorded here.

## Ownership and public visibility

Appearance writes must authenticate the caller and require an active membership in the target organization with `can(role, 'edit_org_profile')`, presently Owner or Admin. Recheck that capability in the write transaction. Existing helpers are `getUserOrgMemberships` / `isOrgAdmin` in `src/lib/permissions.ts`; the role matrix is in `src/lib/orgPermissions.ts`.

Store a selected project image by its ID, then resolve it against `project.designerOrgId`, `project.isPublic=true` and `inclusion='INCLUDED'` on every public read. Do not persist a detached copy of its URL; withdrawal, exclusion or moving it to another firm must remove it from the public cover. Public image DTOs expose only needed identity, URL and caption fields.

| Caller | Audience | Required filter |
| --- | --- | --- |
| Public organization cover and published counts | Public/shared | Exact `designerOrgId`, current `isPublic=true`; cover photo `INCLUDED` |
| Cover picker inside admin settings | Admin choosing a public cover | Same public eligibility; this picker does not publish drafts |
| Public pinned projects and Shop provenance | Public/shared | Exact organization; public projects; included photos; exclude pending products |
| Existing draft/editor project queries | Author/private | Leave their broader draft access unchanged |

## Validation and recovery

After the user approves the concrete schema block and SQL, first copy `prisma/schema.prisma` to a task-specific backup outside the tracked tree. Then add the field and run Prisma format, validate and generate; `npm run verify:prisma`; migration discipline; focused appearance/permission/public-visibility regressions; and `npm run prisma:status`.

If format, validate, generate or migration-status fails, restore the schema backup and stop. A normal status result listing only this reviewed pending migration is expected before deployment; unrelated drift is not. Never use `db push` against production. Verify the migration on an isolated development database before approved `npm run migrate:deploy`, then require clean `npm run prisma:status` and catalog verification.

The existing `npm run db:check` entry points to missing `scripts/db-check.ts` at this baseline. It cannot currently pass; do not report it as completed or substitute a production schema push. Use the explicit catalog recon and focused isolated-database evidence, and report this pre-existing check limitation.

## Application evidence

The founder approved the exact optional Prisma field and SQL with “Approve the field and migration.” The isolated worktree was synchronized to `origin/main`, with no intervening main commits before application. Prisma Client generation and the production compile completed successfully.

Before application, catalog and migration checks confirmed that this was the sole pending migration and that the column did not yet exist. The SQL was executed twice against a transaction-local temporary `organizations` table with an existing row; both applications succeeded and retained that row with a null appearance value. That test transaction was rolled back.

`prisma migrate deploy` applied only `20261029120000_org_profile_appearance`. Catalog verification confirmed nullable `jsonb`; the migration record has a completion timestamp. `prisma migrate status` then reported 115 migrations and “Database schema is up to date!” No profile choices, accounts, published records or photos were changed for the migration or browser tests.

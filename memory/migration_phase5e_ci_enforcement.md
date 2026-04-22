---
name: Phase 5E CI enforcement for migration discipline
description: `.github/workflows/migration-discipline.yml` blocks PRs that regress against 4 drift patterns Phase 1-5D removed. Baseline-based — fails on increase, tolerates documented historical debt.
type: project
---

# Phase 5E CI enforcement

## Decision

Added `.github/workflows/migration-discipline.yml` that runs `node scripts/phase5e-check-plan.mjs --ci` on every PR touching `prisma/**`, `src/**`, `memory/**`, `CLAUDE.md`, or the Phase 5E tooling itself. The script computes 4 counts and compares against `.github/workflows/phase5e-baseline.json`. Any count exceeding baseline fails CI.

**Why:** seven commits of Phase 5 convergence work (1-4 migration drift, 5A-5B schema parity, 5C triage, 5H1+5H2 model restoration, 5D phantom deletion) established a clean state — 73 migrations, schema ↔ prod ↔ Prisma Client ↔ app code aligned. Without enforcement, that state erodes in one Friday-afternoon PR. The Phase 5C root-cause pattern — app code calling `prisma.somethingNew.X` against a model that doesn't exist — recreates exactly the bugs that took weeks to unwind. CI catches that in seconds at PR time.

**How to apply:**
- When a CI check fails with "migration discipline regression detected," read the error output. It will name the specific count that exceeded baseline (e.g., `looseSql: current=34 > baseline=33`).
- If the increase is a mistake: fix the underlying code (delete the loose SQL, declare the missing model, add `IF NOT EXISTS`).
- If the increase is legitimate (e.g., intentional new technical-debt entry): update `.github/workflows/phase5e-baseline.json` in the same PR to the new count. Include a commit message explaining why the baseline moved.
- When a PR legitimately reduces a count (e.g., deletes a grandfathered loose SQL file): also update the baseline to the lower number in the same PR. This prevents future PRs from re-introducing the old count.

## The four checks

| # | Check | Baseline (2026-04-22) | Rationale |
|---|---|-:|---|
| 1 | Loose `.sql` files at `prisma/migrations/` root (outside timestamped folders) | 33 | Historical Phase 1-4 bookkeeping SQL (`mark_*_migration_complete.sql`, `MANUAL_MIGRATION_*`, etc.); not tracked by Prisma; existing files grandfathered as debt |
| 2 | App code calls to `prisma.<delegate>` where `<delegate>` is not declared in `schema.prisma` | 0 | Phase 5C-5D fully resolved; zero-tolerance going forward. Prevents runtime `Cannot read properties of undefined` failures |
| 3 | Timestamped migration folders (`YYYYMMDDHHMMSS_*`) missing their `migration.sql` file | 0 | Empty folders confuse `migrate status`; should never exist |
| 4 | Non-idempotent DDL (`CREATE TABLE` / `CREATE INDEX` / `CREATE TYPE` without `IF NOT EXISTS` or `DO $$` guards) in the last 20 migrations | 0 | Shadow-DB replay pattern (established in 5H2 Step 9) requires every migration to be replayable. Non-idempotent DDL breaks that |

## Comment-stripping in Check 2

The script strips `//` line comments and `/* ... */` block comments from each `.ts`/`.tsx` file before regexing for `prisma.<delegate>`. Without this, a Phase 5D cleanup comment like `// Phase 5D: prisma.analyticsEvent removed — analytics_events table never existed.` would trigger a false-positive phantom-call count.

The stripping is simple (no AST-level awareness of template strings or string literals that contain `//`), which means:
- **False positive risk:** a string literal like `"// prisma.somethingElse.X"` would still be stripped. Unlikely to matter — nobody embeds prisma call syntax in strings.
- **False negative risk:** a `prisma.phantom.X` inside a string that looks like a real call would still be detected. Good — that's usually a bug anyway (dynamic calls via `eval` or `Function` on such a string).

If future false positives surface, upgrade to TypeScript AST parsing.

## Scope-expanding checks later

Easy to add:
- **Check 5 — Any use of `prisma.migrate.dev`** — currently spec-forbidden; CI can enforce by grep-checking `package.json` scripts and any shell scripts under `scripts/`.
- **Check 6 — Schema.prisma format drift** — run `pnpm prisma format` and fail if diff is non-empty.
- **Check 7 — Schema.prisma validate drift** — run `pnpm prisma validate` and fail on any error.

Deferred because:
- Check 5 would require agreeing on what tooling IS allowed (currently it's the custom `scripts/apply-migration-file.mjs` + `prisma migrate resolve --applied` pattern established in Phase 1-4).
- Check 6 + 7 require a live Prisma install in CI — the current workflow already has it via `pnpm prisma generate`, so extending is cheap but wasn't in the Phase 5E scope.

Add these in Phase 5E.1 or Phase 5F if the regression patterns they guard against become a recurring issue.

## Failure scenarios and recovery

**Scenario: "CI failed: looseSql: current=34 > baseline=33"**
- Open the PR diff. Find the new `.sql` file added to `prisma/migrations/` root.
- Either (a) move it into a timestamped folder (`20260422XXXXXX_<name>/migration.sql`), or (b) delete it if it was orphan.

**Scenario: "CI failed: phantomCalls: current=1 > baseline=0"**
- Open the PR diff. Find the new `prisma.X` call where `X` is not a declared model.
- Either (a) declare `X` in `schema.prisma` (follow Phase 5H1/5H2 pattern — requires the backing table to exist in prod), or (b) remove the call from app code.

**Scenario: "CI failed: missingSql: current=1 > baseline=0"**
- A new `YYYYMMDDHHMMSS_*/` folder was created without `migration.sql`. Either author the SQL file or delete the folder.

**Scenario: "CI failed: nonIdempotent: current=1 > baseline=0"**
- A new migration in the last-20 window has raw `CREATE TABLE "X" (...)` without `IF NOT EXISTS`. Wrap in `CREATE TABLE IF NOT EXISTS "X" (...)`. Same for INDEX and TYPE.

**Scenario: CI passes locally, fails on GitHub (or vice versa)**
- Working tree may have uncommitted or untracked files affecting the count. CI runs against the PR's HEAD + merge state; make sure the counts match what a fresh clone would see.
- If `scripts/phase5e-check-plan.mjs` itself was modified in the PR and changes counting logic, the baseline may need a simultaneous update.

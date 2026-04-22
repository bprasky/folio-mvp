# Folio Development Instructions

## Core Philosophy

Folio transforms interior designers' project archives into structured, searchable data through AI interviews. Every implementation decision should serve this core value prop or be deprioritized.

**You are supporting a solo founder with limited time. Speed and correctness both matter. Ship working solutions, then iterate.**

---

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 3. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 4. Demand Elegance (Time-Boxed)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- Spend no more than 10 minutes exploring elegant alternatives before shipping the working solution
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 5. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### 6. Ship It Principle
- Done > perfect for non-core features
- The demo is what matters - prioritize user-facing functionality
- If a feature isn't critical to designer onboarding or data structure, timebox aggressively
- Ask "does this move Folio closer to product-market fit?" before rabbit-holing

---

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

---

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **Business Context**: Before implementing, ask whether this feature serves the core value prop or is scope creep. Flag scope creep explicitly.
- **Solo Founder Aware**: No bureaucracy. No unnecessary process. Move fast, document enough to maintain velocity tomorrow.

---

## Migration Discipline (CI-enforced since Phase 5E)

`.github/workflows/migration-discipline.yml` runs on every PR touching `prisma/**`, `src/**`, `memory/**`, or `CLAUDE.md`. It runs `node scripts/phase5e-check-plan.mjs --ci`, which compares four counts against `.github/workflows/phase5e-baseline.json`:

1. **Loose SQL at `prisma/migrations/` root** (baseline 33 — grandfathered historical bookkeeping). New loose `.sql` files outside timestamped folders fail CI.
2. **Phantom `prisma.<model>` calls** (baseline 0). Any call to a Prisma delegate not declared in `schema.prisma` fails CI.
3. **Migration folders without `migration.sql`** (baseline 0). Empty timestamped folders fail CI.
4. **Non-idempotent DDL in recent migrations** (baseline 0). `CREATE TABLE` / `CREATE INDEX` / `CREATE TYPE` without `IF NOT EXISTS` / `DO $$` in the last 20 migrations fails CI.

**Paying down debt:** if a PR legitimately reduces a count (e.g., deletes a grandfathered loose SQL file), update `phase5e-baseline.json` in the same PR so future PRs can't re-introduce the old count.

**Rationale:** see `memory/migration_phase5e_ci_enforcement.md`. The checks exist because Phase 1-5D spent weeks unwinding exactly these patterns.

### Migration session discipline (for Claude Code)

These are the behaviors that made Phases 1-5E succeed. Apply them to any future migration work on this project.

- **Audit before implement.** Before authoring any migration or schema edit, run recon against prod: `information_schema.columns` for column types, `_prisma_migrations` for bookkeeping state, `grep` for `model X` declarations in `schema.prisma`, and `grep` for `prisma.X` callers in `src/`. Don't guess column types, FK directions, or whether a model is already declared.

- **Per-migration and per-model-block approval gates.** Author the SQL or schema block → print to chat → wait for user approval → apply → resolve → `migrate status` → next item. Two exceptions: (1) when the user has pre-reviewed generator output (e.g., Phase 5H2 Step 9 batch-applied 13 idempotent bookkeeping migrations after the generator output was reviewed), per-migration apply can be sequenced without per-migration approval dialogs; (2) when the user explicitly authorizes batch-review for a specific scope.

- **Backup before `schema.prisma` edits.** Always `cp prisma/schema.prisma /tmp/schema-prisma-backup-<phase>.prisma` before any edit. Make the restore-on-failure path explicit in the session plan: "if format/validate/generate/migrate-status fails, restore from backup and stop."

- **Bulk edits allowed only with scoped pre-review.** If the user pre-approves a plan covering many similar edits (e.g., inline inverse-field additions across 6 models), one approval can cover the batch — but the user must have seen the highest-blast-radius edit in full before batch-approving. The User model block was explicitly reviewed in both Phase 5H1 and 5H2 for exactly this reason.

- **Per-session commit discipline.** Commit + push at the end of each session. Never accumulate work across sessions — reviewers lose the atomic context and the commit history becomes un-bisectable. Rebase-with-force-push is OK on Claude branches; never on main.

- **Sync before starting.** Always `git fetch origin && git log HEAD..origin/main --oneline` at baseline. If main moved since the last session, rebase before any new work begins. See Subsection B's final bullet for the full sync protocol.

- **Multi-session phases have natural split points.** If a phase's work is large (many migrations + schema surgery + validation), split at architectural boundaries rather than pushing through tired. Phase 5H2 split at Step 9 (bookkeeping migrations) vs Step 10-13 (schema surgery) — each committable as an independent unit, each reviewable on its own. Recognize the split point when approval-gate discipline starts slipping or attention drops — that's the signal to commit what exists and resume in a fresh session.

### When drift is reintroduced (runbook)

If CI fails or `migrate status` goes non-clean, don't freelance. Follow the runbook.

- **Run `scripts/phase5e-check-plan.mjs` first** (human-readable mode, no flags). It categorizes the drift into 1 of 4 CI checks and lists specific files/call sites. The output is your starting point — don't begin fixing before you've read it.

- **Cross-reference `_prisma_migrations` and `information_schema.tables`.** For each suspect table/model, verify the three-way state: declared in `schema.prisma`? exists in prod? recorded in `_prisma_migrations`? That triplet determines which bucket the drift falls into.

- **Apply the matching playbook:**
  - **Bucket A-style** (table exists + migration folder exists + schema declaration missing) → Phase 5H1 pattern. `db pull` swap-and-restore → extract → rename snake_case → PascalCase → add `@@map` → paste → validate. See `memory/migration_phase5h_restoration_triage.md`.
  - **Bucket B-style** (table exists, no migration, schema missing) → Phase 5H2 pattern. Author record-existing-state migration first (column types from `information_schema.columns`, not inference), apply + resolve, then add the schema declaration. See `memory/migration_phase5h2_hand_managed_recorded.md`.
  - **Bucket C-style** (app code calls undeclared model, no backing table anywhere) → Phase 5D pattern. Delete the caller. Check caller count first: zero callers is "orphan code, delete the file"; non-zero callers is "silent lie — decide whether to throw, stub, or restore the model." See `memory/migration_phase5d_phantom_deletions.md`.
  - **Bucket D-style** (orphan artifact — stranded SQL file, leftover migration folder without `migration.sql`) → delete the artifact.

- **For cluster-size drift (5+ items), draft a phase prompt.** Don't freelance a cluster deletion or restoration. Follow the 5H1/5H2/5D structure: scope acknowledgment → baseline → extraction/enumeration → review gate → execution → per-step validation → commit plan. The review gates existed for a reason — they caught complications (missing enums, cross-bucket relation drops, required inverse fields on existing models) that would have broken cluster work done in one pass.

- **If main advances during a phase, stop, rebase, re-baseline before continuing.** At session start: `git fetch origin && git log HEAD..origin/main --oneline`. If commits exist on main: `git pull --ff-only origin main` when the merge represents your own prior work landing (PR auto-merge), or rebase-with-conflict-resolution if unrelated work landed. Re-run `prisma migrate status` after sync to confirm the merge didn't introduce drift. Don't start new migrations or schema edits until the tree is fully sync'd.

---

## Tech Stack Context

- Next.js with App Router
- Prisma ORM
- Supabase (auth + database)
- OpenAI integration for AI interviews
- Individual-first user architecture (designers own their data)

---

## Before Starting Any Session

1. Review `tasks/lessons.md` for past mistakes
2. Check `tasks/todo.md` for current priorities
3. Confirm the task serves Folio's core value prop

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

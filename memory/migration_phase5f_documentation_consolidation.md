---
name: Phase 5F documentation consolidation
description: Consolidated Phase 1-5E institutional knowledge into forward-facing docs — prisma/README.md (new), CLAUDE.md expanded with session discipline + drift runbook, 2 stale memory files archived with RESOLVED prefix + resolution sections.
type: project
---

# Phase 5F documentation consolidation

## Decision

Phase 5F turned accumulated migration-system knowledge (8 commits, 16 hardening memory files, one brief CLAUDE.md section) into three pieces of onboarding material so a new engineer or future Claude Code session can work on migrations without Brad in the loop:

1. **`prisma/README.md`** — 218 lines, 8 sections. Single entry point for migration work. Covers: what the directory is, which commands to run when (with table + the `db pull` swap-and-restore pattern), how to author a new migration, how to declare a new model, what to do when CI flags drift vs when `migrate status` reports drift, pointers to key memory files by situation, commandment-style don'ts, session discipline summary.

2. **CLAUDE.md expansion** — added two H3 subsections under the existing "Migration Discipline (CI-enforced since Phase 5E)" H2:
   - **Migration session discipline (for Claude Code)** — 7 bullets on audit-before-implement, per-migration approval gates (with batch-review exception clause per Phase 5H2 Step 9 pattern), backup protocol, bulk-edit pre-review pattern, per-session commit discipline, sync-before-starting, multi-session split points.
   - **When drift is reintroduced (runbook)** — 5 bullets on `phase5e-check-plan.mjs` first, three-way state cross-reference, per-bucket playbook (A → 5H1, B → 5H2, C → 5D, D → artifact delete), cluster-size phase-prompt discipline, main-advancing-during-phase protocol.
   - Net: CLAUDE.md 102 → 138 lines.

3. **Stale memory files archived with RESOLVED prefix** — two files had outstanding-debt claims that Phase 5B/pre-5 work resolved:
   - `migration_instagram_campaigns_missing.md` — resolved by `20260303100000_add_instagram_campaigns` (landed pre-Phase-5).
   - `migration_text_check_vs_prisma_enum.md` — resolved by Phase 5B commit `810f911e` for all 4 outstanding TEXT+CHECK→enum conversions.
   - Both kept (not deleted) with `RESOLVED —` name prefix, updated description, and `## Resolution` section. Decision rationale: memory files gain value from searchability, not preservation — a future engineer hitting a similar situation should find the archived diagnosis + fix approach via search.

**Why:** without consolidation, the discipline that made Phase 5 succeed lives only in Brad's head + 16 memory files + 8 commit messages. Onboarding cost is high; regression risk grows with time. After 5F, the `prisma/README.md` is the single first-read doc; CLAUDE.md teaches Claude Code how to conduct sessions; MEMORY.md index is accurate with RESOLVED files clearly marked.

**How to apply:**
- New engineers or new Claude Code sessions working on migrations should start at `prisma/README.md`.
- When adding new deferred-decision memory files, follow the existing pattern (`memory/migration_<slug>.md` with frontmatter, indexed in `memory/MEMORY.md`).
- When a memory file's concern is later resolved, update it in place with `RESOLVED —` name prefix + `## Resolution` section — don't delete. Update the MEMORY.md index entry to reflect resolution too.
- When expanding `prisma/README.md` or CLAUDE.md's migration sections, keep the structure — new engineers should continue to find sections at the same relative positions.

## State after Phase 5F

- `prisma/README.md` exists (218 lines, 8 sections).
- `CLAUDE.md` has the expanded "Migration Discipline" section (~60 lines covering CI enforcement + session discipline + drift runbook).
- 2 stale memory files archived with `RESOLVED —` prefix; MEMORY.md index reflects their resolved status.
- No schema, migration, or app-code changes this phase.
- `prisma migrate status` unchanged: 73 migrations, clean.

Phases 5G (deferred tech debt paydown — timestamp standardization, Atelier enum taxonomy, priceUsd DECIMAL fix, missing FK constraints sweep) remain as low-priority follow-ups.

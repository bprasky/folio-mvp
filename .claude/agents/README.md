# Folio Claude Code Sub-Agents

Seven project-level sub-agents tailored to Folio's stack (Next.js 14 App Router, Prisma, Supabase, Anthropic + OpenAI) and to the discipline captured in [`CLAUDE.md`](../../CLAUDE.md) and [`tasks/lessons.md`](../../tasks/lessons.md).

Each agent has a narrow job, a hand-written system prompt that cites real Folio files, and a required output format so reports stay scannable.

## The set

| Agent | When to use | Model |
|-------|-------------|-------|
| [`folio-prisma-guardian`](./folio-prisma-guardian.md) | Any Prisma schema change, migration, or query edit | sonnet |
| [`folio-prompt-smith`](./folio-prompt-smith.md) | Designing or iterating on prompts for Sofia, editorial generation, image classification, bios | opus |
| [`folio-flag-auditor`](./folio-flag-auditor.md) | Adding, removing, or modifying any feature flag gate | sonnet |
| [`folio-code-reviewer`](./folio-code-reviewer.md) | Reviewing diffs before commit / PR | sonnet |
| [`folio-debugger`](./folio-debugger.md) | Any bug report, failing script, or error to diagnose | sonnet |
| [`folio-test-scaffolder`](./folio-test-scaffolder.md) | Bootstrapping the test suite or adding targeted tests | sonnet |
| [`folio-next-supabase-specialist`](./folio-next-supabase-specialist.md) | Edits under `src/app/**`, auth flow, route handlers, RSC/client boundary | sonnet |

## How they are invoked

Claude Code auto-delegates based on each agent's `description` field. You can also invoke one explicitly in a message:

> "Use `folio-flag-auditor` to review the gate I just added on the draft-editorial endpoint."

When in doubt, name the agent. Claude will load it and follow its system prompt.

## Design principles

1. **Heavily Folio-tailored, not generic.** Every agent cites real files: `src/lib/posting/generateEditorialDraft.ts`, `src/app/actions/projects.ts`, `src/lib/post/getPostBySlug.ts`, etc. Off-the-shelf agents from VoltAgent / wshobson / 0xfurai collections were deliberately not adopted — they would re-introduce generic advice that already fails against Folio's patterns.
2. **Enforce `tasks/lessons.md` automatically.** Lessons captured by the solo founder (feature-flag gate scoping, public-vs-draft query asymmetry) are hard checks in the relevant agents.
3. **Small, high-signal reports.** Every agent has a required output format. No padding.
4. **One specialist per domain.** Agents defer to each other instead of overlapping.
5. **Lean, not comprehensive.** Seven agents is the current cap. If you want a new one, it must meet the addition rule below.

## Rule for adding a new agent

A new agent is only worth adding if it:

1. Cites **at least one specific Folio file** it will read every invocation.
2. Encodes **at least one rule from `tasks/lessons.md`** (or adds one).
3. Has a **narrower scope** than any existing agent (no overlap).
4. Has a **required output format** so reports stay scannable.
5. Replaces a workflow the solo founder actually does frequently (not a speculative future need — see CLAUDE.md "Ship It Principle").

If the new agent would duplicate work better done by sharpening an existing one, sharpen the existing one instead.

## Smoke tests

After any edit to an agent file, verify it in a fresh Claude Code session with the probe in the corresponding line of the plan (`/root/.claude/plans/virtual-watching-bunny.md` § Verification). Each probe should trigger the right agent and produce a response that cites the Folio files listed in that agent's system prompt.

## Not included (by design)

- Generic `frontend-developer`, `backend-developer`, `security-auditor`, `performance-engineer` — Folio's specialists absorb the parts of these that matter.
- Product / marketing / SaaS-metrics agents — pre-launch scope is dev-only. Revisit after the first designer onboarding.
- Orchestrator / multi-agent-coordinator agents — Claude Code's built-in delegation is sufficient at this scale.
- CI / deployment agents — Folio doesn't have CI yet. Add one when it does.

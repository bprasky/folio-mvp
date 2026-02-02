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

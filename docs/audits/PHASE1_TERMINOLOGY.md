# Phase 1 — Terminology Non-Negotiables: outcome + deferred migration

Applies `docs/17_INTERVIEW_PROMPT_CANON.md` §7. Per the Phase 1 guardrail, a prompt-copy
fix must **not** silently rename persisted enum keys — those are flagged here for a separate
data migration.

## Discovery result: 2 of the 3 fixes are enum-coupled, only 1 is pure prompt copy

| Canon §7 target | Reality | Action |
|-----------------|---------|--------|
| `buyer → Individual` | Pure prompt copy in `buildConsultationPrompt.ts`; no enum, not persisted | **DONE (this commit)** |
| `HOMEOWNER → Individual` | Persisted `Role` enum value (`prisma/schema.prisma:1326`, "Legacy … deprecated in UI"); interpolated into the live prompt via `${role}` and keyed role-blocks in `generateProjectQuestions.ts` | **DEFERRED → data migration** |
| `BUILDER → Contractor` | Persisted in **two** enums — `Role` (`schema.prisma:1328`) and `ParticipantSide` (`schema.prisma:1559`); also the role key in `designer-bio/questions.ts` (`BASE_QUESTIONS_BY_ROLE.BUILDER`) | **DEFERRED → data migration** |

## What changed in this commit (prompt copy only)
`src/lib/atelier/buildConsultationPrompt.ts` — model-facing prose only, no identifiers/enums:
- `:167` "Help the **buyer** think through…" → "Help the **Individual** think through…"
- `:309` "how the **buyer** will actually use the space" → "how the **Individual** will…"
- `:343` "## What We Know About the **Buyer**" → "## What We Know About the **Individual**"

Internal identifiers (`buyerContext`, `buildBuyerContextSection`) were **not** renamed — they
are never read by the model or shown to users, so canon §7 (which governs displayed/model-read
terminology) does not require touching them. Renaming them would be churn without canon benefit.

## DEFERRED — HOMEOWNER / BUILDER enum migration (do NOT do in a prompt pass)

Why it can't be a prompt edit: in `generateProjectQuestions.ts` the role is
`const role = input.respondentRole || 'DESIGNER'` (`:130`), typed
`'DESIGNER' | 'ARCHITECT' | 'BUILDER' | 'HOMEOWNER' | 'VENDOR' | 'PHOTOGRAPHER'` (`:49`), and
that string is both interpolated into the prompt (`YOU ARE INTERVIEWING A: ${role}`, `:136`)
and used as the literal role-block labels (`BUILDER:` `:154`, `HOMEOWNER:` `:161`,
`If BUILDER:` `:195`, `If HOMEOWNER:` `:202`). Relabeling the blocks without changing what
`role` resolves to would desync calibration (the model told "INTERVIEWING A: HOMEOWNER" with
no HOMEOWNER block). The values mirror the persisted `Role`/`ParticipantSide` enums, so the fix
is a schema+data change, not copy.

**Live-path note (reduces urgency):** the only live caller,
`getInterviewQuestions.ts:182`, passes `respondentRole: 'DESIGNER'` hardcoded. The
HOMEOWNER/BUILDER/ARCHITECT/VENDOR/PHOTOGRAPHER calibration blocks are currently **dormant in
the posting flow** — nothing feeds them a non-DESIGNER role today. So this is a correctness/canon
cleanup, not a live user-facing bug.

**Migration scope (separate, gated PR per CLAUDE.md migration discipline):**
1. `Role` enum (`schema.prisma:1323-1333`): `INDIVIDUAL` already exists. Decide HOMEOWNER's
   fate — map existing `HOMEOWNER` rows to `INDIVIDUAL` and drop the value, or keep as a
   hard-deprecated alias. Backfill stored `User.role` rows accordingly.
2. `Role` + `ParticipantSide` (`schema.prisma:1559`): add/settle `CONTRACTOR`, migrate
   `BUILDER` rows, update `OrgType.CONTRACTOR` alignment (`schema.prisma:1344`).
3. Update every string comparison/label to the new values: `generateProjectQuestions.ts`
   (type union `:49`, blocks `:154,161,195,202`), `designer-bio/questions.ts`
   (`BASE_QUESTIONS_BY_ROLE` keys `:101-102`, `roleLabel` maps `:131,200`, the
   `BUILDER_BASE_QUESTIONS` const `:72`), and any other `=== 'BUILDER'` / `=== 'HOMEOWNER'`
   site (repo-wide grep before the migration).
4. Follow the audit-before-implement + per-migration approval gates in CLAUDE.md
   ("Migration session discipline").

The designer-bio model-facing label (`role === 'BUILDER' ? 'builder' : …` → "contractor")
is technically a safe copy-only change, but is bundled into this migration so the enum key and
its label move together rather than leaving a `BUILDER`-key / "contractor"-label mismatch.

## Related decision — discovery-lunch action (from the Grok kill-list, §5 Q2)
`api/vendor-actions/create-discovery-lunch/route.ts` is a **demo/mock affordance, not a shipped
feature**: it builds its plan from `mockVendorAnalyticsData` (`:105`, "Use mock data (will be
replaced with real data later)") plus a hardcoded `DISCOVERY_VENUES` list, writes nothing to the
DB, and is reachable only through the Grok chat panel (`CreateDiscoveryLunchModal` is imported
only by `DynamicInsightPanel`). The *concept* is canon-aligned (doc 16 Tier D appreciation-event
targeting; doc 11 event layer), but the *implementation* is a demo. Recommendation: shelve it
consciously with the Grok removal (it dies as a mock, not as a real feature). If you want to keep
demoing the event-targeting concept, give it a standalone dashboard entry rather than leaving it
orphaned — but there is no real data path to preserve today.

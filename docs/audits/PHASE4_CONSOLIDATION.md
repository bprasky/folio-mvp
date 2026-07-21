# Phase 4 — Persona/Rules Unification (reviewed, one generator per commit)

Routes each live QUESTION generator onto the SSOT module (`src/lib/interview/prompts/`,
docs/17_INTERVIEW_PROMPT_CANON.md §6) so persona/rules/roles come from ONE place. This is
INTENDED-CHANGE work: the generators share no verbatim persona/rule text, so unifying them
changes their prompts. Diffs are shown, never suppressed. Editorial constants stay
byte-identical (step 1). One generator per commit, each reviewed.

Order: (1) generateProjectQuestions ✅ · (2) generateRoomQuestions · (3) posting follow-ups ·
(4) /api/interview/respond (rewire, live) · (5) prompted-content · (6) editorial-queue ·
(7) designer-bio. Not in this template: collaboration rewrite, editorial-prose standard.

> **Step-2 status note (as required):** the *live LLM* pre/post for step 2 (the arrivals
> gate) has **still not been run** — it needs `ANTHROPIC_API_KEY` + a seeded project, absent
> here. Step 2 was verified via the real validator over representative questions, not live
> generation. Flag it if you want a live run before continuing.

---

## Generator 1 — `src/lib/interview/generateProjectQuestions.ts` (role-calibrated openers)

**What changed:** the prompt now leads with the canonical persona + rule spine imported from
the module; the drifted bespoke persona and three module-owned "good question" bullets were
removed. Generator-specific craft (role calibration, the source-narration masterclass) was
KEPT — replacing it with the terse module lines would be a regression.

**Imports added:**
`FOLIO_INTERVIEWER_PERSONA` (persona.ts), `SHARED_RULE_BLOCK` + `ARRIVALS_CONTRAST_POLICY` (rules.ts).

### (i) Persona / rules text diff — old bespoke → new canonical

**Persona (direct conflict resolved):**
- OLD: *"…ask them in a way that feels like **a journalist who already read the brief and
  looked at the photos** — not like a form with required fields."*
- NEW: the module `FOLIO_INTERVIEWER_PERSONA` — *"the Folio Interviewer: **a knowledgeable
  colleague, not a journalist chasing a story** … calm, precise, observational,
  non-performative,"* plus the merit-not-prestige rule. (The "not a form with required
  fields" intent is preserved in the retained TASK line.)

**Rule spine (was implicit/scattered → now explicit from the module):**
- Prepended `SHARED_RULE_BLOCK` (rules 1–7: grounding/anti-fabrication, one-question,
  specificity, arrivals, never-narrate-source, on-the-record, canonical terminology) and
  `ARRIVALS_CONTRAST_POLICY` (§3).

**Deduped — removed local bullets now owned by the module spine:**
- `- Asks ONE thing clearly (not compound questions)` → module rule 2.
- `- Favors arrivals: contrast is welcome when it resolves to the choice made …` → module ARRIVALS_CONTRAST_POLICY.
- `- Sounds like a colleague asking over coffee, not a form field` → module persona.

**KEPT (generator-specific craft, not duplicated by the module):**
- The six role-calibration blocks and per-category role adaptations.
- The full "RULES FOR USING WHAT YOU KNOW (HOLD IT LIGHTLY, NEVER NARRATE IT)" masterclass —
  this is the generator's rich *implementation* of module rule 5; the module states the rule,
  the generator elaborates it. (Retitled the good-question list "…(beyond the rules above)".)
- The soft-impression / storytelling / role-calibrated good-question bullets and the
  bad-question examples; the JSON contract.

**Per instruction B — openers NOT gated:** the fixed 5-category contract means filtering
would drop a required category. `validateInterviewQuestion` is intentionally not wired here
(same reasoning as step 2). It is wired only where a generator emits free-form per-question
output (generateRoomQuestions).

### (ii) Representative-question check (real validator; live gen not available here)
The openers this reconciled prompt produces all pass — no over-block, no regression:
```
✅ PASS  "Sounds like a move was part of the story here — tell me about these clients…"
✅ PASS  "What were you working with — how much of this was new vs. existing?"
✅ PASS  "What was the big idea for this project?"
✅ PASS  "What in this project is most recognizably yours?"
✅ PASS  "What changed from the original concept?"
✅ PASS  "I get the sense this one ran long — walk me through how it actually played out."
```

### ⚠️ Flagged tension (NOT resolved here — enum-migration track)
`SHARED_RULE_BLOCK` rule 7 says use canonical **Contractor**, but this generator's role blocks
still say **BUILDER** and **HOMEOWNER** — persisted `Role`/`ParticipantSide` enum values whose
rename is the separate data migration (docs/audits/PHASE1_TERMINOLOGY.md). So the prompt now
carries a terminology inconsistency between the imported rule 7 and the local role labels.
**Live impact: none today** — the only live caller passes `respondentRole: 'DESIGNER'`
(getInterviewQuestions.ts:182), so the BUILDER/HOMEOWNER blocks are dormant. Resolving it means
landing the enum migration; do not fold that into the prompt pass.

### Verification
- Representative validator check: all pass (above).
- No NEW `tsc` errors in `generateProjectQuestions.ts` (pre-existing repo errors are ignored via
  `next.config.js` `typescript.ignoreBuildErrors: true`).
- Validator unit tests: 3/3 pass.
- Live LLM pre/post: not run (no API key + seeded project here).

**Next generator: (2) generateRoomQuestions.ts** — validator already wired in step 2, so this
is persona/rules unification only.

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

---

## Generator 2 — `src/lib/interview/generateRoomQuestions.ts` (live per-room)

Persona/rules unification only — the validator was already wired here in step 2 (66f57c0).

**Imports added:** `FOLIO_INTERVIEWER_PERSONA`, `SHARED_RULE_BLOCK`, `ARRIVALS_CONTRAST_POLICY`.

### (i) Persona / rules text diff — old bespoke → new canonical

**Persona (drifted voice resolved):**
- OLD: *"You are **a senior editorial journalist** at an interior design publication interviewing a designer about the {room}…"*
- NEW: leads with the module `FOLIO_INTERVIEWER_PERSONA` (*"knowledgeable colleague, not a journalist…"* + merit-not-prestige), followed by a plain TASK line (*"interview the designer about the {room}… grounded in this room's photos and tagged products"*).

**Rule spine:** prepended `SHARED_RULE_BLOCK` + `ARRIVALS_CONTRAST_POLICY`.

**Deduped:** rule 3's inline arrivals clause (added in step 2) → collapsed to *"Every question sets
up an answer the designer would be proud to publish (arrivals/contrast policy above applies)."*
The policy now lives once, at the top, from the module.

**KEPT (generator-specific craft):** the Product Naming Gate (rules 2 & 5 — nameable-vs-descriptor,
"never say Unknown Brand"), the anti-generic rule with its editorial example (rule 4), the
question-type mix (rule 6), the cross-room instruction (rule 7), the lane-contract known-facts
block, the AI-detected-details block, and the JSON contract.

**No rule-7 tension here:** unlike generator #1, this prompt is designer-only ("interview the
designer") — it carries no BUILDER/HOMEOWNER role labels, so importing rule 7 ("use Contractor")
introduces no terminology conflict.

### (ii) Representative-question check (real validator; live gen still blocked — no key)
All representative Kitchen questions pass, including a contrast question — confirming the arrivals
gate (step 2) and the new persona coexist with no over-block:
```
✅ PASS  "The Waterworks bridge faucet in unlacquered brass — walk us through choosing that over a polished finish."
✅ PASS  "The honed marble island top sets a quiet tone — how did you land on honing it rather than a polish?"
✅ PASS  "You mentioned white oak runs through the house — how does it carry from the kitchen into the primary bath?"
✅ PASS  "What did you try first for the island before the honed marble landed?"   (contrast → arrival)
✅ PASS  "The brass against the oak millwork — was that pairing an early decision or something that emerged?"
```

### Verification
- Representative validator check: all pass (above).
- No NEW `tsc` errors in `generateRoomQuestions.ts` (pre-existing repo errors ignored via
  `ignoreBuildErrors`).
- Validator unit tests: 3/3 pass.
- Live LLM pre/post: **still not run** — no usable `ANTHROPIC_API_KEY` in this environment
  (`.env.local` is gitignored and absent from the fresh clone; env-var config is gated to
  Team/Enterprise). Harness + procedure ready in `docs/audits/PHASE4_LIVE_PREPOST.md`. Per your
  direction, the sweep continues on validator-based verification.

---

## Generator 3 — posting follow-ups (F1 `followups/route.ts`, F2 `followups/single`, F3 `followups/batch`)

Treated as one generator group, one commit.

**⚠️ Correction to the brief:** the task said "F3 already routes through the gate." It does
**not** — a grep for `isArrivalSafe`/`validateInterviewQuestion` across all three routes
returned nothing. Step 2 only reconciled F3's *prompt* wording, never wired the validator. So
this run wires the gate into **all three** (F1, F2, F3), not just F1/F2.

**Imports added (all three):** `FOLIO_INTERVIEWER_PERSONA`, `SHARED_RULE_BLOCK`,
`ARRIVALS_CONTRAST_POLICY`, `isArrivalSafe`.

### (i) Persona / rules text diff — old bespoke → new canonical
- **Persona (drifted voices resolved):** F1 & F2 said *"You are **an editorial interviewer for
  a design magazine**…"*, F3 said *"**You are interviewing a designer** … for a design magazine
  feature."* All three now lead with the module `FOLIO_INTERVIEWER_PERSONA` (colleague, not
  journalist; merit-not-prestige), followed by a plain task line.
- **Rule spine:** prepended `SHARED_RULE_BLOCK` + `ARRIVALS_CONTRAST_POLICY` to each.
- **Arrivals dedupe (policy now from the module only):**
  - F1: removed the rule line *"Ask about ARRIVALS, not departures. 'What clicked…' not 'Why
    did you reject the alternatives?'"*
  - F2: removed the same clause from its system-prompt paragraph **and** from the per-answer
    user-prompt line.
  - F3: system-prompt persona swapped; its "chase" rules were already §3-reconciled in step 2
    and are kept as craft (see below).
  - **Note — intended §3 alignment, not a silent change:** F1/F2's old "not why did you reject"
    was *more* restrictive than §3 (which allows "the alternative you considered and set aside").
    Sourcing the policy from the module makes F1/F2 permit contrast-that-resolves-to-the-choice,
    matching F3 and the room/project generators. The **"what clicked" framing is preserved** via
    the retained example questions in F1.

**KEPT (follow-up craft):** F1's project-level "30,000-feet / cover all five categories / don't
chase room specifics" scope and its examples; F2's coverage-morphing + dedupe-against-covered
logic and the 0–2 / hard-cap-at-2 shape; F3's "chase the decision / the arrival not the
grievance" heuristics; one-follow-up-at-a-time everywhere.

### (ii) Gate wiring (net for F1/F2/F3 — was absent on all three)
Each route now filters its emitted follow-ups through `isArrivalSafe` with drop-logging,
matching the generateRoomQuestions pattern (F1 filters the nested per-question arrays; F2 filters
the 0–2 list; F3 filters before the maxFollowUps slice).

### (iii) Representative-question check (real validator; live gen still deferred)
```
✅ PASS  (contrast→arrival)          "…before you landed on the RH Cloud. What clicked about this one?"
✅ PASS  (compromise-as-rationale)   "…the island was a compromise with the budget — how did you make it feel intentional?"
✅ PASS  (coverage-morph)            "You mentioned the warm oak in the kitchen — how did you carry that into the living room?"
✅ PASS  (benign)                    "Waterworks appears throughout the bathrooms. What keeps you coming back to them?"
🚫 BLOCK [frustration] (grievance)   "What frustrated you most in the primary suite?"
🚫 BLOCK [do differently] (regret)   "Anything you'd have done differently in the kitchen?"
```
Contrast/compromise/morph/benign pass; clear grievance/regret block. No over-block.

### 🚩 Deferred cleanup (flagged, NOT built this commit)
F3 references known facts via `formatKnownFacts` (the lane contract). Per instruction #4, I did
NOT create a new source-handling block. Open question for a later cleanup: promote generator #1's
source-narration masterclass and the lane-contract approach to a **shared module export**
(e.g., `prompts/sourceHandling.ts`) so they stop living per-generator. Deferred, not this commit.

### Verification
- Representative validator check: correct pass/block above.
- No NEW `tsc` errors in the three routes — the errors present are the pre-existing
  `LLMResult.code/.status/.message` family in the error branches (and one unrelated `events`
  route matched by path substring), all ignored via `next.config.js` `ignoreBuildErrors`.
- Validator unit tests: 3/3 pass.
- Live LLM pre/post: still deferred to a single pre-ship run (no usable key). Harness ready in
  `docs/audits/PHASE4_LIVE_PREPOST.md`.

---

## Generator 4 — second-surface `/api/interview/respond` (I1 generic, I2 hook, I3 preview)

REWIRE, not delete (`NEXT_PUBLIC_POSTING_V1=true`, live). One commit.

**Scope confirmations:**
- `/api/interview/generate-draft` (I4) — **untouched**: confirmed dead (Phase 0, zero fetchers);
  belongs to the separate dead-code deletion batch.
- `/api/interview/start` — **left as-is**: it carries no interviewer prompt; it just sets up the
  session and delegates to `getInterviewQuestionsWithContext` (already routed through the unified
  #1/#2 generators). Nothing to unify.

**Imports added:** `FOLIO_INTERVIEWER_PERSONA`, `SHARED_RULE_BLOCK`, `ARRIVALS_CONTRAST_POLICY`,
`isArrivalSafe` (for I1/I2), `FOLIO_TONE` (for I3).

### Question generators — I1 (generic) & I2 (hook)
**Persona/rules diff:** both said *"You are an interviewer for an interior design publication…"*
→ now lead with `FOLIO_INTERVIEWER_PERSONA` + `SHARED_RULE_BLOCK` + `ARRIVALS_CONTRAST_POLICY`.

**Intended changes (flagged, not silent):**
- **I2 §3 reconciliation.** *"Invite the EMOTIONAL stakes: what they hoped someone would feel,
  **what was at risk**, what made it personal, what told them they'd gotten it right"* →
  *"Invite the emotional stakes **of the win** … the moment they knew they'd gotten it right.
  **Reach for the arrival, not what was at risk.**"* Drops the loss/risk framing per §3; keeps the
  hook's emotional depth pointed at the arrival.
- **Voice unification:** I2's *"Sound like a journalist"* → *"Sound like a colleague who was in
  the room"* (matches the module persona).
- **I1 minor:** *"Focus on emotion, intention, and process"* → *"Focus on intention and process"*
  — trims the bare "emotion" focus toward the work (§4 labeling / merit-not-prestige); the
  why/intention/process depth is preserved.

**KEPT craft:** I2's "echo the theme, splice into the opening pull quote" move and its
no-specific-product / no-therapist-question rules; I1's why/intention/process depth and the
skip-if-already-publication-quality short-circuit.

**Gate:** wired `isArrivalSafe` into `generateFollowUp` (covers both I1 and I2) — a blocked
question returns `null`, so no follow-up is shown (graceful degrade), with a drop-log.

### Editorial output — I3 (preview draft: title + first paragraph)
- **Tone from the module:** prepended `FOLIO_TONE` (editorialTone.ts) as the canonical editorial
  voice.
- **Verbatim-quote rule applied now:** *"If you quote the designer, use their exact words … do
  not polish or paraphrase into a quote."*
- **No question validator** (it emits prose, not questions) — per instruction.

**🚩 Deviation from the brief (flagged for your call):** the brief said "unify its persona from
prompts/persona.ts." I did **not** inject `FOLIO_INTERVIEWER_PERSONA` into I3 — persona.ts is the
*interviewer* voice ("You are the Folio Interviewer… interviewing"), which is incoherent for an
editorial *writer*. Per canon, editorial prose voice is `FOLIO_TONE` (§5), which is what I used.
The module has **no dedicated editorial-writer persona**; whether to add one is a Phase 5 decision.

**🚩 I3 still needs the full Phase 5 editorial-standard pass:** the grounding / anti-fabrication
guardrail and the centralized banned-phrase list are NOT applied here (I3 currently says "Focus on
the emotional and intentional aspects" with no anti-invention rule). Flagged, not built.

### Verification
```
✅ PASS  (I2 contrast→arrival)  "You said you were chasing calm — what did you hope someone would feel walking in?"
✅ PASS  (I1 contrast)          "The oak went a few directions before this one — what made it click?"
✅ PASS  (I1 benign)            "Why did the brass feel right for this space?"
🚫 BLOCK [frustration]          "What frustrated you most about how it turned out?"
🚫 BLOCK [regret]               "Anything you regret about the opening?"
```
- No `tsc` errors in `respond/route.ts` (clean — no pre-existing or new).
- Validator unit tests: 3/3.
- Live LLM pre/post: still deferred to a single pre-ship run.

---

## Dead-code deletion batch (Phase 0 SAFE-TO-DELETE, re-verified post-rewire)

Importer graphs were **re-grepped now** (rewires #1–#4 changed them) — not trusted from the
Phase 0 snapshot. Each item was confirmed to have zero live importers immediately before removal.

### 1. `/api/interview/generate-draft/route.ts` — WHOLE ROUTE deleted (I4, the dead "polished" path)
Evidence: `grep -rn "interview/generate-draft" src` → **no fetchers, no importers**; the route
exported only `dynamic` + `POST`. Removing it also removes the "pull quotes … slightly polished"
editorial path the audit flagged (SOFT conflict #7) — it dies rather than needing reconciliation.

### 2. `src/lib/interview/buildInterviewBrief.ts` — WHOLE FILE deleted
Evidence: the only importers were the `index.ts` barrel re-export and `generateQuestions.ts:21`
(used only inside the dead `generateInterviewQuestions` pipeline). No live consumer of
`buildInterviewBrief`, `InterviewBrief`, `NarrativeBrief`, `AIGeneratedQuestion`, `VendorMapEntry`,
`HeroMoment`, `EditorialLayoutHints`, `PriorWorkConnection` (grep excluding self+barrel → empty).
The barrel's two `buildInterviewBrief` export blocks were removed with it.

### 3. `src/lib/interview/generateQuestions.ts` — SURGICAL (dead pipeline excised, live kept)
Removed (lines 88–1286): the `TOPICS` map, `LEVEL_0_QUESTIONS` + `PROSPECTIVE_QUESTIONS`,
`generateContextualOpener`, `generateProspectiveQuestions`, `generateLevel0…5Questions`, the
`prioritizeQuestions`/`specificityScore`/`topicQualifier`/`deduplicateSimilar` helpers +
`PrioritizationOptions`, `GenerateQuestionsOptions`, **`validateAIQuestion` (the dead keyword-ban
gate: `/(regret|compromise|sacrifice|didn't make|cut|lost|wish you had)/`)**, `convertAIQuestionToGenerated`,
`generateInterviewQuestions`, `generateTemplateQuestions`, and `orderByRoom`. Trimmed the now-unused
imports (`randomUUID`, `formatRoomName`, the `contextLevel` types except `ContextLevel`, and the
`buildInterviewBrief` import). File: **1320 → 121 lines.**

KEPT (live, verified importers intact): `QuestionType`, `HOOK_OPENER_ID_PREFIX` /
`HOOK_FOLLOWUP_ID_PREFIX` (imported by `respond/route.ts` + `generateEditorialDraft.ts`),
`GeneratedQuestion` (type-imported by the live per-room path), and `toInterviewQuestion` (called by
`getInterviewQuestions.ts`). Barrel re-export of `GenerateQuestionsOptions` removed; `toInterviewQuestion`
/ `GeneratedQuestion` / `QuestionType` re-exports kept.

**This completes canon §3's implementation consequence:** the dead keyword-ban gate is now deleted;
the net-new `validateInterviewQuestion` (§3 intent gate, wired into the live generators in #2–#4) is
the only question gate in the codebase.

### Dangling-reference proof (repo-wide, post-deletion)
- `buildInterviewBrief` import/path: **none**.
- `interview/generate-draft` fetch/import: **none**.
- Removed `generateQuestions` symbols: **none** — the sole match is
  `logAttributeVerification.ts` importing `ContextualQuestion` from the *unrelated*
  `src/lib/editorial/generateInterviewQuestions.ts` (a different, still-present file).

### Verification
- No NEW `tsc` errors in `generateQuestions.ts` / `index.ts` (touched-file grep empty; pre-existing
  `LLMResult`/`z.infer` noise elsewhere is ignored via `next.config.js` `ignoreBuildErrors`).
- Validator unit tests: 3/3 pass.

**Next options:** generator #5 (`prompted-content/generateQuestions.ts`) · #6 (`editorial-queue`) ·
#7 (`designer-bio`). Note: `src/lib/editorial/generateInterviewQuestions.ts` (`generateContextualQuestions`,
a separate deterministic attribute-question generator, type-only importer) is a candidate for a later
dead-code check — not part of this batch.

# Collaboration Module Rewrite (C1–C4)

**Scope:** the vendor×designer collaboration question generators —
`round1.ts` (C1 vendor static, C2 designer static), `generateRound2.ts` (C3 AI
follow-ups), `generateRound3.ts` (C4 AI cross-pollination). **Out of scope:**
`narrative/assembleStory.ts` (C5) — editorial prose, deferred to Phase 5.

Governing canon: `docs/17_INTERVIEW_PROMPT_CANON.md` — §1 merit-not-prestige,
§2 rule 2 (one question at a time), rule 6 (on-the-record cross-referencing),
§3 arrivals/contrast policy.

---

## 1. Unified persona/rules onto the SSOT module

Before, both AI generators carried a **local** persona line and their own
guideline lists:

- C3 (`generateRound2.ts`): `"You are an expert editorial interviewer for a
  design industry publication…"`
- C4 (`generateRound3.ts`): `"You are crafting the final round of questions…"`
  (no persona, no shared rules, no arrivals policy)

After, both prepend the canonical blocks and keep only their round-specific
craft:

```
${FOLIO_INTERVIEWER_PERSONA}

${SHARED_RULE_BLOCK}

${ARRIVALS_CONTRAST_POLICY}

<round-specific guidelines>
```

Free-form emitters now route through the arrivals gate
(`isArrivalSafe`) with a drop-log, matching the pattern already used in
designer-bio question generation:

- C3 emit map: `questions.filter(q => q?.prompt && isArrivalSafe(q.prompt))`
  → `console.info('[generateRound2] arrivals gate dropped', n)`
- C4 emit map: arrivals gate **plus** the rule-6 grounding filter (see §4).

C1/C2 are static arrays (no LLM), so they are verified against the validator
at authoring time rather than gated at runtime — all 17 pass
`validateInterviewQuestion` and `isArrivalSafe`.

---

## 2. De-lead C1/C2 (HARD conflict — presumptive praise removed)

The audit's hardest conflict: Round 1 static questions presumed praise before
the subject had said anything. Every leading/presumptive opening was replaced
with a neutral, observational ask for a **specific moment**. The working
relationship stays the subject (merit-not-prestige, §1) — praise-seeking does
not.

### C1 — Vendor Round 1

| id | Before | After |
|----|--------|-------|
| v1-relationship-2 | "What makes working with this designer **particularly effective**?" | "From a vendor's side, walk us through what it's **actually like** to work with this designer." |
| v1-project-2 | (stacked, see §3) | "Tell us about a **specific place** one of your products ended up in this designer's work." |
| v1-outcome-1 | "…**memorable ways**…" framing | "How has working with this designer **shown up in how you develop your products, if at all**?" |

### C2 — Designer Round 1

| id | Before | After |
|----|--------|-------|
| d1-relationship-1 | "How did you discover this vendor, and what **initially drew you to their work**?" | "How did you **first come across** this vendor?" |
| d1-relationship-2 | "What **qualities do you value most** in your relationship with this vendor?" | "Walk us through how you and this vendor **actually work together**." |
| d1-project-1 | "…where their products became **central to your design narrative**." | "Tell us about a **specific project** where you used their products." |
| d1-project-2 | "Have their products ever **surprised you or opened new creative directions**?" | "Tell us about a **specific time** one of their products shaped a decision in your work." |
| d1-process-2 | "Describe a time when they **went above and beyond** to support your vision." | (split + de-led, see §3) |
| d1-philosophy-1 | "How do strong vendor relationships **elevate your work** for clients?" | "How do your vendor relationships **show up in the work you deliver** to clients?" |
| d1-outcome-1 | "How has this **partnership** shaped your approach to material selection or sourcing?" | "How has working with this vendor shaped **how you select materials**?" |

---

## 3. Un-stack (rule 2 — one question at a time)

Compound, multi-topic questions were split into single-topic asks.

### C1 — Vendor process

Before (one stacked question mixing communication + decisions + adjustments):
a single process question. After, three:

- `v1-process-1` — "How do the two of you **communicate** day-to-day on a project?"
- `v1-process-2` — "When there's a **decision to make on a specification**, how do you land on it together?"
- `v1-process-3` — "When a **spec needs adjusting** mid-project, how do you work through it together?" *(new id)*

### C2 — Designer process

Before: two process questions, one of which ("went above and beyond… could be
customization, timing, problem-solving") both **led** and **stacked** three
topics in the helper. After, three single-topic asks (de-led):

- `d1-process-1` — "How do you and this vendor **communicate** through a project?"
- `d1-process-2` — "When you're **specifying** with them and a choice comes up, how do you land on it?"
- `d1-process-3` — "When something on an **order** needs sorting out, how do the two of you handle it?" *(new id)*

---

## 4. C4 Round-3 cross-pollination — kept, gated on rule 6

The cross-pollination technique (quote one contributor to the other) is
**retained** — it's the point of Round 3. It is now gated so a quote is only
surfaced when it was given **on the record for this published piece** (§2 rule
6, *not* a §16 matter).

Two mechanisms:

1. **Prompt instruction** added to `ROUND3_SYSTEM_PROMPT`:
   > ON-THE-RECORD SOURCING (rule 6): You may only quote the other party's own
   > answers from THIS collaboration story's interview — words they gave on the
   > record for this published piece. Never introduce outside, private, or
   > second-hand information, and never invent a quote. Every referencedQuote
   > must be verbatim from the answers supplied below.

2. **Runtime grounding filter** on the emit map: any `referencedQuote` that is
   not verbatim-substring of one of the other party's supplied answers is
   dropped (guards against invented/outside quotes even if the model ignores
   the instruction). Prompt-only cross-references with no quote are allowed
   through.

The ultra-fallback ("The {other} **spoke highly of your collaboration**…") was
de-led to "The {other} **talked about working with you**…". The primary
fallback already grounds its quote in a real answer snippet, so it is rule-6
compliant by construction.

**Flag — no per-answer publication-consent field exists in the data model.**
`Round1Response` is `{ questionId, answer, answeredAt }`; there is no
per-answer "given for publication" flag. The collaboration interview is
inherently a publication workflow (the whole artifact is the published
collaboration story), so every answer collected in it satisfies rule 6 by
feature nature. If a future draft/private-answer state is added, the grounding
filter is the right place to also check that flag.

---

## 5. Merit-not-prestige (§1) — kept the substance

"How you actually worked together" remains the legitimate subject throughout.
The rewrite drops presumptive praise and status-seeking, **not** the working
relationship itself — questions still ask how the two collaborate, communicate,
and decide, framed observationally rather than as mutual flattery.

---

## Verification

- **Validator sample** — all 17 C1/C2 static prompts + representative C3/C4
  fallback prompts pass `validateInterviewQuestion` (`ok: true`) and
  `isArrivalSafe`. (scratchpad harness against the real validator.)
- **Validator unit tests** — `validateQuestion.test.ts` 3/3 green.
- **tsc (touched files)** — no **new** errors. The 4 remaining
  `result.code`/`result.message` diagnostics on `generateRound2.ts:107` and
  `generateRound3.ts:127` are the pre-existing `LLMResult` family (present at
  HEAD, unrelated to this change; `next.config.js` sets
  `typescript.ignoreBuildErrors: true`). The Set-spread ES5 error initially
  introduced by the rule-6 gate was rewritten to a plain-array `.some(...)`.
- **Live LLM pre/post** — deferred to the single pre-ship run (no usable
  `ANTHROPIC_API_KEY` in this container). Harness ready in
  `docs/audits/PHASE4_LIVE_PREPOST.md`.

## Not touched (flagged)

- `narrative/assembleStory.ts` (C5) — editorial prose, Phase 5.

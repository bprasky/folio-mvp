# Phase 4 — Step 2: the deliberate behavior change (arrivals gate + reconciliation)

This is the single intended behavior change in the consolidation (docs/17 §3). The live
per-room path had **no** validation gate; turning one on will start dropping the
grievance/regret questions that previously passed straight to the model, and the
arrivals language across the openers and the batch follow-up is reconciled to one policy.

Committed separately from the behavior-preserving step 1 (FOLIO_TONE re-home).

## What changed
1. **Gate wired into the live per-room generator.** `src/lib/interview/generateRoomQuestions.ts`
   now filters its parsed questions through `isArrivalSafe` (the net-new §3 gate from
   Phase 3) and logs anything dropped. *(The fixed 5-category project openers in
   `generateProjectQuestions` are intentionally NOT gated — filtering there would break the
   one-per-category contract, and openers carry negligible grievance risk.)*
2. **Reconciled the arrivals contradiction** — the openers forbade all contrast while the
   batch follow-up chased grievance. Both now express the §3 policy ("rejection in service
   of the arrival"):
   - `generateRoomQuestions.ts` rule 3 — was "Ask about arrivals, not departures. Wins,
     not compromises." → now allows contrast that resolves to the choice made, bars
     regret/grievance/loss.
   - `generateProjectQuestions.ts` — "Focuses on wins and arrivals, not compromises or
     failures" → same §3 framing.
   - `followups/batch/route.ts` — "Chase emotion: if they expressed pride or frustration,
     go there." → "Chase the decision behind the feeling … chase how they resolved it —
     the arrival, not the grievance."

## Verification
- Validator unit tests: 3/3 pass (`tsx --test`).
- No new `tsc` errors in touched files (the codebase has pre-existing `LLMResult.code` /
  `z.infer` errors, ignored by `next.config.js` `typescript.ignoreBuildErrors: true`).
- Live end-to-end pre/post generation was **not** run here — it needs `ANTHROPIC_API_KEY`
  plus a seeded project in the DB, which this environment lacks. The sample below exercises
  the real gate over questions that mirror what the reconciled prompts produce. Offer stands
  to run a true live pre/post if pointed at a seedable project.

## Before / after sample (real `validateInterviewQuestion` output)
"before" = no gate existed, every question reached the model.

```
CONTRAST / ARRIVAL (expect PASS)
  ✅  "What did you try before you landed on the Calacatta?"                          → PASS
  ✅  "The client wanted white oak, you pushed for walnut — how did you win them over?" → PASS
  ✅  "What almost made the cut in the primary bath?"                                  → PASS

COMPROMISE / CUT / LOST as rationale (expect PASS — the reversal)
  ✅  "The lighting plan was a compromise with the budget — how did you make it feel intentional?" → PASS
  ✅  "You cut the original island profile — what replaced it, and why is it better?"  → PASS
  ✅  "That first fabric was lost to lead times — what did you land on instead?"       → PASS

BENIGN EDITORIAL (expect PASS — no over-block)
  ✅  "Walk me through the brass-against-navy pairing in the kitchen."                 → PASS
  ✅  "What was the big idea for this project?"                                        → PASS

GRIEVANCE / REGRET (expect BLOCK — the old 'chase frustration' shape)
  🚫  "What frustrated you most about this project?"                → BLOCK [frustration]
  🚫  "What do you regret about the primary suite?"                 → BLOCK [regret]
  🚫  "What would you change if you did it over?"                   → BLOCK [would you change / do]
  🚫  "What did you have to give up to hit the budget?"             → BLOCK [give up]
  🚫  "What was the worst part of the timeline?"                    → BLOCK [worst]
```

Read: contrast-in-service-of-the-arrival passes, the compromise/cut/lost reversal works,
benign editorial is untouched, and only clear grievance is fail-closed — the small,
verifiable footprint we predicted.

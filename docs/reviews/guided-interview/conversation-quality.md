# Guided interview conversation correction

The founder's live example supplied the brief, renovation scope and design direction in one answer. The shipped controller still asked a canned example, then generic scope and direction questions. This contradicted the brief's central requirement to listen and collect only missing information.

The original implementation restricted the model to four fixed follow-up strings, prohibited reactions and new question wording, passed only two earlier same-room answers, and rejected contextual prepared questions through narrow regular expressions. Those were implementation compromises, not product requirements.

## Resulting behavior

- Replies use the accepted conversation and eligible remaining obligations. Prepared identities and server-controlled progression stay intact; wording can follow the actual answer.
- The interviewer may give a brief grounded reaction, ask one useful clarification, or move to a missing part of the next topic. Already supplied plain-language intent counts even when it was volunteered while answering a different question.
- Explicit reuse shows the exact earlier passage. The button or a narrowly recognized typed affirmation confirms that passage. Literal typed confirmation and the full original source remain in history.
- Corrections reopen prepared questions and exclude accepted evidence that depended on the replaced premise, including transitive dependencies. Skips remain intentional skips and are included in decision context.
- Actual pending requests show three animated dots and the submitted answer with an honest pending-save label. The next reply appears in the chat transcript. Reduced-motion users get static dots; failed requests retain drafts.

## Verification

The controller regression fails against the old behavior when an adapted prepared question incorrectly becomes a new optional follow-up. The corrected controller preserves the prepared ID, actual wording and reaction, confirms only the displayed verbatim excerpt, and invalidates dependent evidence after corrections.

Local checks use the actual route, service, store, controller and React components with synthetic provider/database boundaries. They cover save-before-model ordering, duplicates, late responses, authorization, protected spotlight routing, confirmation consent, corrections, skipped-topic progression, draft generation and recovery.

- Guided prompt/controller/service/provenance checks pass.
- Workspace browser: 16 scenarios pass, including actual held HTTP responses, pending save state, exactly three working dots, typed confirmation history, mobile resize and earlier-history scrolling.
- Original entry journey: 11 scenarios pass.
- Core suite: 10 tests pass; one disposable PostgreSQL test is skipped because that infrastructure is unavailable.
- Full lint, client import guard and migration discipline pass. TypeScript ratchet passes with 903 diagnostics against the existing 904 baseline and no new diagnostic fingerprints.

The UI screenshots are synthetic local fixtures, not authenticated production-project testing: [thinking](conversation-working.png), [explicit confirmation](conversation-confirmation.png), [mobile](mobile.png).

Live provider evaluation is recorded separately. Mechanical checks alone do not establish conversational quality. Early trials caught generic direction re-asks, unsupported spatial paraphrases and a reviewer that treated intentional skips as unfinished prerequisites; those outputs were rejected rather than presented as successful evaluations.

No database schema, account eligibility, spotlight selection or publishing permissions change.

## Live provider evaluation

Surface: `src/lib/interview/guided/decision.ts` and its schema. Model: `claude-sonnet-5` before and after. The final transport grammar authors the existing purpose/evidence fields before choosing an action or wording. Purpose assesses known content and the actual remaining gap; fully answered obligations require explicit confirmation. No persisted field or additional model call was added by that final correction.

[Final five snapshots and complete three-turn sequence](conversation-quality-eval.json), [one complete stability repeat](conversation-quality-stability.json), and [exploratory trial outputs](conversation-quality-trials.json) are synthetic only. The baseline was captured before prompt edits. Earlier failed and human-rejected output remains in the trial artifact; it is not counted as passing. No live project was read or modified.

Frozen decision/schema SHA-256: `e07871374219dfef204c90cab4ad1c3b2c3e0784644a713d2e666c1cafd12ebb`. Both final sequence runs used this same hash.

| Fixture | Before input/output | After input/output | Observed continuation |
|---|---:|---:|---|
| friends-new-york-miami | 0/0 | 17440/584 | Asks a named scope gap; offers deadline/budget alternatives. |
| concise-rich-answer | 2085/59 | 10712/275 | Confirms the stated design direction with a verbatim passage. |
| correction | 0/0 | 17151/592 | Uses corrected facts; overall-design wording remains broad. |
| room-progression | 2067/57 | 16356/417 | Moves into the Kitchen without importing Living Room facts. |
| unselected-product | 2032/55 | 10469/305 | Avoids the lamp; asks how the room supports the stated routine. |

Five snapshot continuations and both three-turn sequences completed. Estimated snapshot cost at the application's Sonnet rates ($3/M input, $15/M output) increased from $0.021117 to $0.248979 (1079.0%). Before: 6184/171 input/output tokens; after: 72128/2173. The separate three-turn run used 39334/1282 tokens ($0.137232); the stability repeat used 51925/1732 ($0.181755). All figures include rejected attempts and bounded repairs in those final runs.

The increased cost buys full accepted history, contextual wording, and independent semantic review. The old path made no model call in two fixtures. Several final attempts also required local repair for metadata length or an ineligible question reference. These are measured costs, not a savings claim.

The stability repeat returned this actual sequence:

1. Within 'keeping the bones,' were you free to move walls and change the structure, or was that off the table?
2. Was the guiding idea to keep the exterior quiet while letting the interiors express the clients' personalities?
3. Across all the rooms you were free to change, what feels most recognizably yours?

The second reply proposes explicit reuse of the original quiet-exterior/personal-interior passage. The third follows an actual skip in the real controller; it does not silently mark the skipped obligation answered. In the repeat, an initial proposal tried to revive the skipped topic. Server eligibility rejected it, and the single bounded repair produced the displayed signature question.

Qualitative limits remain: some scope questions offer several parameters as options; the correction fixture asks for an overall design idea after a privacy/connection intention; the room-use fixture asks how the room supports a routine rather than confirming it; and a reaction such as “clear enough directive” is evaluative. The main direction-reuse-and-skip sequence now succeeds twice, but this small synthetic set does not establish perfect conversational quality or production reliability. Invalid responses remain blocked with the accepted answer saved for retry.

Recommendation: ship the bounded conversational correction with these recorded quality limits. The final owned prompt regression checks and diff whitespace checks pass. Keep the deterministic controller/service tests and independent quality assertions; do not equate model self-review with a guarantee.

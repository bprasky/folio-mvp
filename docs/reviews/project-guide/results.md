# Project guide and podcast interview — 2026-10-02

## Product behavior

Eligible designers meet the AI host on Create+ and project upload, tagging and Story surfaces. File and URL uploads remain beside the host. Saved data determines the new, partial or completed greeting and the photo, room and product-tag readiness. Intentionally product-free photos and excluded/document assets are counted separately; tagging coverage is not editorial quality.

Setup guidance is separate from editorial evidence. A deliberate begin/resume choice enters the canonical interview. Restart requires explicit confirmation; detail added after completion is offered as exact text for acceptance. Typing keeps the same avatar. The existing step-by-step workspace remains available.

Podcast mode treats prepared questions as an outline. Useful follow-ups continue before returning to unanswered topics. Reusing an earlier passage requires explicit designer confirmation. Original words, attribution, corrections and unanswered questions remain available.

## Selection and evidence

Independent coverage extraction reads raw accepted answers against pending targets, alongside the first proposal. It sees neither proposed wording nor original collection categories. Application checks validate exact passages, IDs, uniqueness and room scope, and reject open re-asks of fully covered targets. Extraction never changes canonical progress.

Two parallel reviews must both pass. The conversation audit checks repetition, reuse, progression, scope and tone against accepted history and the relevant target/current question. The factual audit sees only spoken wording, cited passages and known room names. Invalid or unavailable review returns the saved-answer retry path rather than accepting an unchecked proposal.

Selection normally uses four provider calls and at most seven per invocation, including one repair. Legacy selection retains its four-call limit. A state-only advance skips factual review. The two parallel waves add no serial stage; this is not a bound for an entire answer crossing preparation phases. Stage greetings and exact guide commands need no model call. Timing instrumentation separates speech finality, save and backend/model durations without logging production answers.

## Verification

Local source checks and the bounded final model evaluation pass. Hosted CI remains pending. Production still runs baseline c3f3285e6b866e0d1d5eaf7b2bda425519517863 (PR807); this feature has not been merged or deployed.

Local checks passed:

- Guided prompt/controller/service/provenance checks; 14 guide adapter checks; 36 transport checks and all seven existing source adapters; planner and upload write-authorization checks.
- Existing browser regressions: 33 live-panel, 20 guided-workspace and 17 composed-entry checks. Twelve new composed checks exercise actual Create+, host, upload and Story components with synthetic auth, HTTP, navigation and provider boundaries.
- Full Next lint, client-import and migration guards; Prisma generation and Next production compile mode. TypeScript ratchet: 903 diagnostics against 904 baseline, no new fingerprints. This is not a clean repository-wide type baseline.
- Independent source review of ownership, feature gates, upload writes, interview transitions, stale/retried receipts, parallel review failures, voice/text confirmation provenance and legacy isolation.

Browser fixtures cover single startup, file/URL inputs, stable mounting, metadata refresh, lost control/skip responses, exact-detail acceptance, partial uploads, Expertise return context, disabled accounts and manual fallback. Screenshots use actual app CSS with fixture fonts and synthetic images/video. Media screenshots substitute a placeholder for unchanged tagging controls. They do not establish full tagging interaction, microphone quality, Tavus event ordering or speech latency.

Actual Prisma/PostgreSQL tests cover competing project and project_guide reservations in both directions and across actors; execution awaits hosted CI. No schema or migration changes.

## Actual-model evidence

Designer answers in all artifacts are fictional fixtures. Tests use actual configured model responses and canonical controller transitions without database writes or Tavus calls. Structural checks and editorial review are separate. Historical failures remain preserved.

- [Final-source evaluation](model-evaluation-final.json): five independent scenarios, source fingerprints, cost and outcomes. Earlier passes belong to earlier source revisions.
- [Full project sequences](sequence-evaluation.json): require the project phase to finish and accept a designer reflection within eight designer turns/40 started model calls. Historical short trials are retained. Initial plan generation and later room interviews are excluded.
- [Joint calibration](constraint-repair-evaluation.json): eight valid/invalid cases covering constraints, exclusive goals, causality, paraphrase, repetition, tentative relationships and neutral room questions; separate factual/conversation verdicts.
- [Coverage extraction](coverage-extraction-evaluation.json): three passing production-helper cases, 3,561 input/190 output tokens, approximately $0.013533. Local tests also validate exact-source enforcement.
- [Factual-only calibration](factual-entailment-evaluation.json) and [reasoning comparison](factual-reasoning-evaluation.json): narrow probes, including a low-effort 8/8 that failed to repeat in the integrated test. That isolated pass is not reliable acceptance evidence.

Earlier combined-review and stronger-model experiments remain in auditor-evaluation.json, known-premise-evaluation*.json and reviewer-model-comparison.json. Two fixture adjudications are explicit: a new application differs from repeating an idea; a tentative relationship question differs from asserting it. Reuse copies only the exact original passage, never a generated interpretation.

The [factual-model comparison](factual-model-comparison.json) uses identical frozen inputs, prompt and schema: Sonnet passed 6/8; configured Opus passed 8/8 with substantively correct reasons. Across eight isolated calls, measured cost rose from $0.031644 to $0.09009 and wall time from 17.732s to 40.543s. This justifies evaluating a dedicated interviewGrounding task class; it is not a global interview-model change or final acceptance. Generation, coverage extraction, conversation review and legacy interviews retain Sonnet with disabled thinking. Only factual grounding uses Opus with medium effort and a 2,400-token ceiling.

The first integrated comparison passed all eight factual judgments but seven of eight joint judgments: conversation review misread an accepted confirmation as pending. Narrowing that context removed the routing ambiguity. A later direct run still falsely rejected a neutral Kitchen-intention question. The final factual prompt explicitly distinguishes an ordinary invitation (which the designer may answer with "none") from an embedded specific premise. All eight existing joint controls then passed unchanged, including all unsupported-assertion negatives. Historical failures remain in the artifact; the final pass does not establish zero error in future calls.

Full sequences also exposed two implementation defects: optional rationale on a state-only advance was rejected, and the SDK moved allowed-action/ID enums into descriptions. The decision schema now accepts only that optional advance rationale and strips it from the canonical action. Podcast requests restore supported native enums and locally constrain the sole repair after a covered-target conflict. Semantic and exact-source checks still apply. A later transcript showed three consecutive consent checks postponing the designer reflection; the host now prioritizes unanswered topics. Remaining style limitations include occasional menus of alternatives, generic wording for a genuinely new topic, and administrative confirmations at section boundaries.

Wall time is distinct from summed provider durations because parallel requests overlap. These small synthetic samples establish no production response-speed improvement. Final measurements and the exact source fingerprints are recorded in the linked aggregate artifact.

Final-source results:

| Evaluation | Result | Actual calls | Wall time | Estimated model cost |
| --- | --- | ---: | ---: | ---: |
| Independent next-turn scenarios | 5/5, manually reviewed | 21 | 28.605s total | $0.250094 |
| Same five scenarios on baseline | Historical comparator, includes a failed room transition | 12 | 31.579s total | $0.237498 |
| Joint factual/conversation controls | 8/8 unchanged expectations | 16 | 32.361s total | $0.186245 |
| Complete project sequence A | 6 turns, completed with reflection | 23 | 40.953s total | $0.315445 |
| Complete project sequence B | 6 turns, completed with reflection | 26 | 47.156s total | $0.396876 |

Both final sequences follow discovery → consequence → remaining topics → personal reflection and complete the project phase. They preserve exact source reuse and separate confirmations with open questions. Manual review flags scope questions that offer alternative constraints despite the prompt preference for one focused detail; a generic question also remains in an independent case where that topic is genuinely new. These are bounded pilot passes with documented style limitations, not claims of flawless podcast interviewing.

Final sequence turn waits ranged from 3.977s to 9.279s before Tavus delivery. An earlier trial reached 26.008s after repair; variability remains material. The final five-scenario sample costs 5.3% more and has 9.4% less elapsed time than the historical baseline, but this small, non-contemporaneous sample cannot substantiate a speed improvement. It excludes human speech, event finality, initial preparation, network/device playback and Tavus generation. Summed provider times were 48.597s for the final five scenarios and 62.036s/69.639s for sequences A/B, reflecting parallel overlap.

## Editorial and media boundaries

A concrete discovery and its consequence offer promising teaser material. Pull quotes need the designer's own point of view; the full-sequence test must actually elicit the reflection, not merely contain a prepared fixture. Repeated assent requests and processing pauses can interrupt the conversation, so structural success alone is insufficient.

This is a text/dialogue assessment, not a listened-to recording or evaluation of voice delivery. Recording and exports remain separately gated; guide sessions reject recording. No worker deployment, ASR credential, storage-limit change or media rollout is included. Existing edit plans concatenate selected source scenes; automatic silence removal is not part of this change. Unrecorded speech must not be represented as captured media.

Public readers, published home and Publish remain inert. Authorized owners may use the host in editing/interview views. Approved-account, allowlist, membership, ownership and Spotlight exclusions remain enforced. Publishing behavior is unchanged.

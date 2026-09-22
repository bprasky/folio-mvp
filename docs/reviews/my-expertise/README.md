# My expertise implementation review

Implemented September 22, 2026 from Folio_My_Expertise_Specification.docx. The feature is disabled by default (`STUDIO_MY_EXPERTISE=false`). No production data, schema, deployment or activation changes were made.

## Designer experience

- Both Studio paths place My expertise after primary recommendations. Cards show a purpose and exact, labeled photographs across at least two relevant projects. Fewer qualified cards are allowed; no portfolio quota or invented intent fills the feed.
- Explicit discovery uses published prose, original answers and concrete verified spatial observations. Generic style/material tags alone do not qualify. Designers can select exact photographs and introduce a comparison themselves. Adding a project retains the topic and return destination.
- Opening an opportunity is read-only. Starting creates resumable work. Answers save before follow-up generation; a provider failure preserves the answer. Corrections invalidate affected claims while retaining originals. Skipping, changing examples and saving for later remain available. Readiness depends on covered examples, reasoning and framing confirmation.
- Designers edit and review an illustrated native article, choose a project/portrait/logo cover, publish explicitly and optionally feature it in their profile's separate Expertise tab. This does not replace About or create editorial recognition.
- Social output freezes the reviewed revision and offers a downloadable title card/caption for manual sharing. No external posting or scheduling is claimed.

## Storage and boundaries

Existing candidate/version/event JSON storage holds opportunities, discovery cache, feedback, impressions and exports. Existing story/revision/answer/source tables hold interviews and immutable published revisions. No migrations or new model blocks.

Owner/workspace and current source checks apply to all author operations. Public reads and exports validate the approved revision's sources and media again. Changed/private assets are withheld; saved answers remain available for repair. Archiving uses the existing withdrawn status and suppresses the opportunity. Legacy story/readiness readers exclude expertise records.

| Gate/caller | Behavior |
| --- | --- |
| Studio server page, both client paths | Section only mounted when enabled |
| Expertise author page and API/service | Server-side feature and ownership checks |
| Public article and profile reads | Feature gate, published pointer and current permissions |
| Project return banner | Feature gate and existing authorized project surface |

## Verification

Production compile passed. Final TypeScript ratchet passed at 903 diagnostics against the unchanged 904 baseline. Next lint and scoped ESLint passed with warnings; client-import and migration-discipline guards passed. Existing Studio regression checks passed, with legacy test doubles updated to honor the expertise exclusion.

New CI checks: `check-expertise-engine.cjs`, `check-expertise-ui.cjs`, `check-expertise-navigation.cjs`, `check-expertise-persistence.cjs`, `check-expertise-postgres.cjs`. They cover qualification/provenance, correction propagation, read-only opening, dirty exit, failed-save retention, saved-answer/model failure recovery, ownership, stale edits, revocation, frozen revisions, repeated exports and feature toggles. The PostgreSQL-compatible PGlite harness applies the actual existing SQL migrations and checks CAS, JSONB, foreign keys, caches and native publication constraints. It is distinct from the service's mocked lifecycle tests.

Browser walkthrough used actual React components with a synthetic in-memory API (`node scripts/preview-studio-expertise.cjs`, port 4185), not production data or live model responses. Verified placement, paired mobile evidence, explicit start, answer/save/leave/resume, article edit/save/reload, review/publication controls, native article labels and author/project links. Desktop and 375px mobile presentation inspected with no horizontal overflow. Screenshots: [desktop](desktop.png), [mobile](mobile.png), [article](article.png). The fixture does not demonstrate production authentication, model quality or every export/compare service path.

## Pilot gates and limitations

Keep disabled until a real-designer pilot and live-model quality/token-cost evaluation. Those evaluations have not been performed. Calls have rate/output budgets; actual quality and cost remain unmeasured. Discovery runs through an explicit POST with persisted processing/error/cache state, not a durable background worker. Automatic discovery uses existing verified evidence; it adds no new visual-inference pipeline. Publication requires current permitted sources. Previously downloaded files cannot be recalled.

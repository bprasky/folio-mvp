# Publishing Studio presentation redesign

Implemented on `codex/studio-editorial-presentation`, September 21, 2026. No merge, deployment, feature activation, production query, or production migration was performed for this redesign.

## What changed

- Compact approved introduction, semantic keyboard-operated Suggestions / In progress / Exports tabs, existing navigation preserved.
- The first three eligible recommendations share a desktop grid in existing server order. Fewer remain fewer. Additional stories stay accessible; an additional qualified cross-project story can appear below without duplication. Developing opportunities remain secondary.
- Actual selected photographs, candidate-specific rationale, factual preparation summaries and blocker-derived actions. Failed imagery falls back within the supplied assets or visibly reports its absence.
- Existing configurator presents the actual next blocker beside the prepared material. Ready candidates skip completed questions. Explicit Save draft and server-response change summaries; no client-generated readiness decisions.
- Unsaved text is recoverable within the same browser session, keyed to candidate, version and source. Back/discard and pending saves are guarded. Saved edits and answers still use the existing API.
- Read-only event projections expose started work and actual download-exported snapshots. Publication and source refreshes cannot erase earlier exports. Publication recorded without a download remains accessible as saved work, not an export. Historical versions reopen by exact version and remain read-only.
- Legacy generated work and empty campaigns remain accessible. A legacy generated status is never presented as a stored download package or confirmed publication.

## Files changed

Application:

- `src/components/publishing-studio/StudioWorkspace.tsx` (new)
- `src/components/publishing-studio/ReadinessStudio.tsx`
- `src/components/publishing-studio/PublishingStudio.tsx`
- `src/components/publishing-studio/StudioFeedCard.tsx`
- `src/components/publishing-studio/CandidateConfigurator.tsx`
- `src/lib/publishing-studio/readiness/presentation.ts` (new)
- `src/lib/publishing-studio/readiness/service.ts` (read projections only)
- `src/lib/publishing-studio/readiness/store.ts` (read projections only)

Verification:

- `scripts/check-readiness-ui.cjs`
- `scripts/check-candidate-configurator.cjs` (new)
- `scripts/check-studio-landing.cjs`
- `scripts/check-readiness-service.cjs`
- `scripts/check-readiness-store-postgres.cjs`
- `scripts/preview-readiness.cjs`
- This report and screenshots; redesign section in `tasks/todo.md`.

Unrelated existing changes in tasks, lessons and Spotlight documentation were preserved.

## Verification results

Passed:

- `node scripts/check-readiness-ui.cjs`: 0/1/2/3+ candidates, mixed requirements, correct handoff, keyboard tabs, image fallback, dismissal, portfolio deduplication, navigation, historical-version identity, publication-only saved records.
- `node scripts/check-candidate-configurator.cjs`: ready bypass, pending locks, save errors, unchanged server readiness, back guard, session recovery, version migration, explicit discard, read-only snapshots.
- `node scripts/check-studio-landing.cjs`: legacy candidate ceilings, saved/generated records, campaign access, editor handoffs, no generation on browse.
- `node scripts/check-readiness-service.cjs`: authorization, stale sources, saved work, export history, publication without download.
- `node scripts/check-readiness-store-postgres.cjs` against disposable PGlite PostgreSQL: exact-version events, immutable snapshots, ownership/workspace checks, private author history, historical exports and publication-only records. Existing local dependency selected with `READINESS_PGLITE_PATH=.tmp/studio-completion-pg/node_modules/@electric-sql/pglite/dist/index.js`; no application database connection.
- Existing engine, source, campaign-readiness, Studio recommendation and Publishing Studio data suites.
- Client-import guard and migration-discipline check.
- Focused lint and TypeScript ratchet: 903 diagnostics versus existing baseline 904; no new diagnostics.
- `npx next build --experimental-build-mode compile`: exit 0. Existing unrelated import warnings for `FaNotes` and `getServerSession` remain.

Browser inspection used actual Studio components and repository styles with isolated synthetic fixtures. Inspected 1440×1000 desktop, 820×1180 tablet and 390×844 phone. No horizontal overflow at tested widths. Verified the bounded question, unsaved-answer guard, saved caption, retained pending answer and resume in the browser. The public demo photographs already appear in the repository's project-tagging demo; fixture stories are explicitly labeled and never seeded into production. The surrounding authenticated global shell was not reproduced in this isolated preview and was not modified.

Screenshots: `desktop.png`, `tablet.png`, `mobile.png`, `mobile-story.png`, `mobile-question.png`, `desktop-configurator.png`.

## Remaining contract gaps

1. **Semantic answer validation remains unmet.** The existing engine accepts nonempty free-text answers as designer evidence and composes the caption directly from claims. It can accept an incomplete or contradictory answer when no existing contradiction flag is present. Current tests prove blank/invalid options and already-flagged contradictions remain gated, and that the UI honors nonready server responses; they do not establish semantic validation of arbitrary new answers. The engine was preserved as requested. Implementing a grounded semantic clarification step requires a separate engine/API change. Supporting copy does not promise guaranteed completion.
2. Partial answers are recoverable only within the browser session, not durable cross-device drafts. Successful Save and continue persists the answer through the existing API; Save draft persists copy. Session recovery does not claim a server save.
3. Legacy generated packages are not stored. Current readiness exports can be regenerated through the existing export endpoint; older exported snapshots remain readable but cannot be redownloaded through that endpoint once superseded. No historical ZIP artifact store was added.
4. Studio supports Download post and explicit user attestation of prior publication. It does not have a Publish to Folio action for these social drafts; none was invented.

Recommendation scores, quality gates, evidence rules, selection/deduplication, activation and generation behavior were not changed.

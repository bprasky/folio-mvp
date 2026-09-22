# Purpose-led Publishing Studio

The Studio now explains the designer's purpose, contribution and result before asking them to choose a format. A shared opportunity adapter carries that context into existing editors. Photography, evidence gates, individual posts and saved work remain accessible.

## Personal introduction walkthrough

1. Choose **Create my introduction**. The card explains the twenty-question interview, editable article, About placement and supported social output.
2. Answer the interview and explicitly save progress. Returning opens the saved interview rather than creating another.
3. Review answers, prepare the article, then edit its title and text. Original answers remain separate. Returning to unchanged answers preserves article edits; changing an answer invalidates the derived article.
4. Explicitly review the final article before publishing. Successful publication makes the article available in the profile's About section and provides the article link/social outputs. It does not overwrite the bio or pin another item.
5. Completed introductions disappear from new-task recommendations. Loading/errors are unknown, not evidence that an introduction is missing. Stale published sources require review instead of showing a ready-to-share claim.

## Project release walkthrough

1. A supported project overview and distinct prepared room stories appear as one opportunity. Its individual cards are removed from the same prominent recommendation area.
2. **Plan this project's release** opens that project and its prepared introduction.
3. Choose one to three eligible rooms; none are preselected or described as favorites until selected.
4. Keep the introduction first, reorder selected room posts, and optionally enter planning dates.
5. Explicitly save the plan. Project, source revisions, room choices, order and dates survive reload in the existing owner/workspace-scoped EditorialDraft storage.
6. Open individual posts in the existing editor for caption/image work and export, then return to the release. Existing saved export edits are reused. Changed or withdrawn sources block continuation until reviewed.

## Verification

- Production compile (`npm run typecheck:prepare`) passes.
- Full lint and client-import guard pass; existing lint warnings remain.
- TypeScript budget passes: 903 diagnostics against the unchanged 904 baseline. This is a debt ratchet pass, not a zero-error typecheck.
- Migration-discipline check passes; no schema or migration changes.
- All 26 existing Studio checks pass, plus opportunity, release service, release UI and PostgreSQL-compatible PGlite persistence checks. New checks are included in CI.
- Authorization, workspace boundaries, stale revisions, failed-save retention, draft reuse, completed-introduction suppression, duplicate removal and honest output labels are covered.
- Review caught and fixed article edits being overwritten after revisiting unchanged answers; client and persistence regressions pass.
- Browser walkthroughs at desktop and 390px mobile verified interview save/resume, article editing/reload, explicit completion, recommendation suppression, explicit room selection, reordering, dates and plan reload. No mobile horizontal overflow observed. Native keyboard controls and loading/error/empty states have component coverage.

Browser checks use `scripts/preview-studio-purpose.cjs`, synthetic interviews and public demo photography on localhost:4184. They are not production authentication, live AI prompt-quality evaluation or an end-to-end test of the real export editor. Service and editor handoffs are tested separately. PGlite persistence checks do not simulate independent concurrent database connections.

## Remaining boundaries

- About placement uses the existing article listing. A single pinned/featured article slot is not supported and is not promised.
- Dates are planning notes. Instagram export/sharing remains manual; saving a plan does not schedule or publish posts.
- When the readiness feature is enabled, new release opportunities are withheld because that engine has no approved project-overview shape. Existing plans remain accessible but blocked for source review. The quality engine is not bypassed.
- No production data mutations, migrations, publication, merge, deployment or feature activation were performed.

## Screenshots

Synthetic local review captures:

- [Desktop Studio](desktop.png)
- [Mobile Studio](mobile.png)
- [Article review](introduction-review.png)
- [Explicit room selection](choose-rooms.png)
- [Saved release sequence](release-plan.png)

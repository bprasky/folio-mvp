# Simpler resume screen and Start over

The Story page now leads with Resume interview and a visible Start over action. Saved answers are collapsed; draft settings appear only after choosing Prepare draft, which requires an accepted room answer. The large Story stepper is replaced with compact project navigation.

Start over explains its scope before confirmation. It atomically clears interview answers, conversation, question caches, recordings metadata, and the relational answer projection, then opens a new session at the first project question. Photos, rooms, tags, editable draft content and publication status are retained. The implementation does not clear the founder's production answers.

The old Restart intent never reached a reset in the guided workspace. The browser regression fails against the committed previous wrapper and passes with the dedicated reset route. Reset needs no model call. Snapshot checks, idempotent receipts and session/reset identities prevent a retry, older tab or in-flight writer from restoring cleared evidence.

## Verification

- Actual Story, progress navigation, modal dispatch and guided workspace exercised in the browser harness. Desktop, 390px mobile and reset confirmation screenshots were visually reviewed.
- Route/service checks cover authorization and protected Spotlight projects, transaction rollback, clearing both canonical and projected answers, preserving assets/drafts, fresh question/session identities, retry receipts and stale snapshots.
- Guided prompt/controller/service/writer checks pass. Browser workspace 16/16 and entry 16/16 pass; core suite 10 pass, 0 fail, 1 skipped because a disposable database is unavailable.
- Full lint, client-import guard, migration discipline and the production compile pass. Existing unrelated lint/import warnings remain. Final source review has no blockers.
- TypeScript ratchet: 903 diagnostics against the existing 904 baseline, with no new fingerprints.
- Regression cases include stale new follow-up requests, stale generation override arrays, both projection directions, unbound older local drafts, and delayed reset acknowledgements preserving fresh work from another tab.

Screenshots: [desktop](resume-desktop.png), [mobile](resume-mobile.png), [confirmation](reset-confirmation.png).

The browser uses mocked HTTP boundaries; service tests use an in-memory transactional database double. They do not establish real PostgreSQL isolation or authenticated production behavior. No production reset or paid model call is used for verification.

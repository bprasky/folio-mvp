# Tavus inside the existing guided project steps

The live wrapper had replaced the real project navigation with two broad choices and exposed uploads beside multiple steps. This correction uses the existing adaptive `ProjectProgressTracker` and the existing Media, tagging, saved-answer and Publish surfaces. One compact project header owns the page. The designer can continue without the host using the original workspace.

Photos owns URL/file uploads; Rooms keeps room organization and credits; Tags keeps tagging; Story owns the podcast interview and media preparation; Publish retains the existing review and permission gates. The same project-scoped Tavus connection remains mounted through these route changes. Opening a step does not complete it or authorize publication.

The server retains guide history and canonical interview state, rereads saved project facts, and receives the currently viewed step separately from project readiness. Step changes produce a relevant transition instead of a new introduction. Unchanged refreshes do not replay speech. Returning to setup leaves saved answers intact and finishes an active creator recording without ending the host connection.

The Create intake and the newly created project have different authorization scopes, so that initial boundary still closes the intake call and opens a project call. The server carries only the same owner's, same workspace's guide history across it; no canonical answers or command receipts are copied. Navigation among project steps then keeps one call.

Verification uses synthetic provider, media, auth and database boundaries: 20 composed browser cases (including all five steps on one connection), 35 live/capture browser cases, 42 transport cases, 16 guide-adapter cases, planner boundaries and all seven source adapters. Desktop/mobile screenshots are in `.tmp/project-guide-browser/review`; step body fixtures are synthetic, while the host, tracker, Create and Story components are real. Client-import and migration guards pass. No live designer answers or resets were used for testing.

PR810's quota/retry and explicit recording-consent repairs are included in the release base. Production recording/export activation is still pending persistent media processing, transcription credentials and adequate private storage capacity. This change does not claim those services are enabled or verify live conversational quality.

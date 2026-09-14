# Production release audit — 14 September 2026

## Verified dashboard state

Authenticated Vercel project: `brad-praskys-projects/folio-mvp`.

- Production domain: `folioad.com`.
- Current production deployment: `CNPt8iwqUdFM9cCcyD8XRxc2TUvL`, Ready, September 4, commit `05303220a06c3aece2381067d98e0717ee972eda` (merge #764), branch main.
- Newest listed preview: `72HowrECqinmwBHx3frR4x1qHgxk`, Ready, September 10, commit `a483ec202b66f588ec85cddcc34a745e92af269f`, branch `codex/spotlight-spec-foundation`. This is an early specification commit, not merged current main and not the quote release.
- Current main: `55db99ae4ac9e035e8bbc45ff9f30acb188c5992` (merge #770).
- Project and Shared environment-variable searches for `UPSTASH` both return no results. No secret values were revealed.
- Project Storage shows no connected databases.
- Repository automatic Git deployment hold remains in `vercel.json`. No promotion, deployment or environment changes were performed.

## Changes since production

| PR | Scope | Release implication |
| --- | --- | --- |
| 765 | Core security/ownership/lifecycle hardening, retired APIs, shared rate limiting, renderer isolation | Requires shared Upstash; absent credentials deliberately deny production requests, including credentials login/signup. Renderer and optional media retain separate rollout gates. |
| 766–767 | Private Spotlight selection and durable question/answer schema | Application postflight documents installation; no migration is applied by the Vercel build command. |
| 768 | Private Spotlight selection/interview/save/resume; protected downstream readers | Cohort defaults off. Public page loader needed the same private-provenance sanitizer as public API before exposure. |
| 769 | Quote picker above room body; direct and Folio modes | Rewrites remain opt-in; public blocks strip supporting rewrite evidence. |
| 770 | Preserve canonical room quote selections; generate title choices after publish-screen regeneration | Complements #769; does not replace its layout. |

## Blocking findings

1. **Missing shared production limiter configuration.** Code requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; there is no alternate environment variable fallback. Configure the intended backend, verify independent-process shared rejection/window reset and authentication behavior before production release. This is the explicit outstanding gate from `FINAL_MERGE_DEPLOYMENT_READINESS_2026-09-09.md`.
2. **Private Spotlight provenance could cross the public page boundary.** `getPostBySlug` spread the entire post into the object passed to client `StoryRenderer`, including `provenance.interview.spotlightDrafts`. Its block sanitizer only covered expandedBlocks. Public API already uses `stripPrivateInterviewData`; reuse it in the page loader and prove serialized private answers are absent. Do not activate Spotlight before the fix.
3. **No suitable existing preview identified.** Promoting the latest listed preview would omit the requested quote changes. Build a reviewed current-main descendant with Production configuration after blockers are resolved; record its immutable commit/deployment and retain the current production deployment as rollback.

## Privacy remediation

The release-audit branch now sanitizes the complete public loader result with the existing `stripPrivateInterviewData` function. The regression exercises the real sanitizer and durable private-question identity lookup; it fails before the fix and passes afterward. Eleven serialized-reader scenarios pass, including private draft objects, durable answer IDs, parent-linked followups and ID-keyed maps. The fixture also preserves public answers and the selected Folio line, without mutating the stored input.

## Remaining verification

Repository review found no opposing behavior between ordinary title/quote generation and private Spotlight eligibility. Existing isolated SQL/service tests and quote suites passed, with inherited design-system CI debt documented previously. No authenticated Folio article UI check, current live database postflight, new Upstash smoke or production candidate test was performed during this audit. A merged PR or successful build alone is not runtime release evidence.

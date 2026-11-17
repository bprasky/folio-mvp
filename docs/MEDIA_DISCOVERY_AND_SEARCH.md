# Media discovery and public discovery

## Decision

Discovery is a publishing output: a public profile connects a person's or studio's identity to attributable, published project evidence. It must remain useful to readers without requiring a search engine to click tabs or wait for a browser-only feed. No ranking promises or hidden keyword copy.

## Baseline (main ed5d2355, 17 November 2026)

- Personal and organization profiles have basic titles/descriptions, but neither canonical identity markup nor a server-rendered default feed. Their client feeds initially render skeletons.
- Organization services, specialties and philosophy are behind a separate About route parameter. The initial profile can expose a useful native disclosure without changing the visual hierarchy.
- Published project features have canonical and social metadata. Photo-only fallbacks need the same canonical discipline. Projects already preserve credit identities.
- No repository sitemap or robots route exists. Publication filters must prevent discovery from exposing private projects, draft features or interview answers.
- Recognition/media cards and an import review store already exist. Organization recognition has no project relationship; copying it to another table would create conflicting approvals.
- Search-backed product research and a DNS-pinned, size/time-bounded HTTP reader already exist. Use the same provider and transport boundaries for press.

## Implementation scope

1. After the website import is ready, one confirmation publishes the selected imported projects and photographs through the existing portfolio publisher. Projects/photos may be excluded and covers changed in an optional review; no tagging, room sorting or interview is required. Exact reviewed versions and individual permission checks protect the batch. Partial completion is reported explicitly and retries preserve successful approvals.
2. Optional Find my coverage and paste-link review in personal/firm profiles and onboarding. Identity comes from the authorized profile. Search result URLs must come from actual provider tool results. Candidates remain private until individually approved; dismissals persist. During completed website onboarding, search starts in the background with supplied project identities and suggests project matches for confirmation. A session-scoped import marker prevents repeat sweeps in the same browser session; returning in a new session can run another bounded search.
3. Store each coverage item once in the existing ImportSession review envelope, namespaced `MEDIA_COVERAGE_V1`, with scope, source provenance, review state, project linkage and private read status. Deterministic scope+URL identity prevents duplicate imports. No schema or production migration.
4. Only approved items enter server-rendered feeds and related public projects. A private linked project stays private and its title/link/photo is suppressed. Withdrawals apply everywhere. Use typography or an explicitly published project photograph, never silently copy publisher imagery.
5. Read available article bodies with bounded safe transport. Respect inaccessible/paywalled sources; a headline/snippet is not interview evidence. Interview use is explicit, project-scoped and source-labelled. Outside text never becomes an accepted answer or designer quotation. Approval with explicit interview consent reads available bodies in the same action. Project interviews and personal bio interviews consume this context; studio profile-only bio interviews are not yet connected, so the UI requires a linked project for that scope. Existing sessions are not reset by this feature.
6. Shared server feed loaders, canonical profile metadata, ProfilePage identity markup, visible expandable profile details, project coverage links, robots and paginated sitemap discovery.

## Verification

Use synthetic sources/accounts to test candidate validation, duplicate handling, authorization, publication/redaction, source failure, withdrawal, interview provenance, SSR output and SEO serialization. Run the repository TypeScript ratchet and affected privacy/interview suites. Browser review must cover small screens, both themes and source-review recovery. Do not claim live provider quality or production indexing from fixtures.

## Following release

- Verify actual production robots, CDN access, canonical URLs and rendered HTML in Search Console/Bing tools. Repository code cannot establish current index coverage.
- Measure search landing visits, project/profile exploration and inquiry actions. Keep AI citation observations separate from dependable referral analytics.
- Broaden source discovery and deduplicate legacy recognition after real cohort feedback. Keep a separate public URL for each substantial project/story; avoid automatic thin keyword pages.
- A dedicated indexed coverage table can replace the bounded import envelope if volume requires it, with a reviewed migration and a compatibility reader.

Primary guidance: https://developers.google.com/search/docs/appearance/ai-features and https://developers.google.com/search/docs/appearance/structured-data/profile-page . Search/AI inclusion is earned through accessible, useful evidence; schema alone does not guarantee it.

## Validation record

- Synthetic coverage service/HTTP checks: verified-result URLs, redirect safety, permissions, version conflicts, consent, public projection, withdrawal and legacy import isolation.
- Bulk import orchestration, existing portfolio publisher (6 tests), workspace import, guided interviews, live adapters, project channel, and organization profile regression suites exercised.
- Actual review components compile with production CSS and fonts. Hosted Chromium exercises bulk approval, partial recovery, coverage reading/approval and small/large light/dark layouts; screenshots are retained by the lint workflow. The local Windows browser remains unavailable.
- Hosted Next compile succeeds and the Vercel preview is READY. Full compiler comparison against main 68051a9 proves 93 changed fingerprints retain the same source spans and constraints: 91 property display order changes and two string-literal union order changes. Complete proof is recorded in `docs/reviews/media-discovery-typescript-proof.json`; the guard retains exact-message and occurrence checks. Diagnostics decrease from 846 to 843; no baseline expansion.
- Incorporated main 68051a9 (the approved About page), preserving the photo approval step from 5d0d7c7. Final hosted checks are required before merge. No schema migration is needed. Live search-provider quality, indexing, ranking and AI-citation outcomes are not established by fixtures.

## Next discovery work

Extend sitemap coverage to published Expertise and Studio stories through their existing source-approval validators, connect confirmed collaborator identities across more article views, and instrument search referrals through inquiry completion. Empty profiles, draft sources and speculative keyword pages should not be added merely to increase URL count.

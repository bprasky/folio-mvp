# PR #853 — project channels audit and hardening

Audit date: 2026-11-10. PR: <https://github.com/bprasky/folio-mvp/pull/853>.
Branch: `feat/editorial-project-channels-profile-hero`.
Starting revision: `9b6f885415505b6d5bc5cb7fed7b8adc3168b3cf`; base: `18fd4b9f015af7168f7c15f8bb59e97883805814`.

## A. Executive verdict

**Ready with conditions for the existing published-project experience. Not certified for production activation, and not portfolio-first ready.** The bounded defects identified below are fixed, with local server, browser, privacy, publishing and production-build evidence. Keep the rollout flags disabled until hosted checks pass and the authenticated integration checklist below is completed against an authorized environment.

No merge, deployment, publication, editorial generation, interview rewrite, schema migration or production mutation was performed. Existing publications retain their original identity and immersive renderer. The organization profile's existing project mosaic is preserved.

Evidence has three distinct levels:

1. Actual public production HTTP reads and a live desktop/mobile reader journey.
2. Actual PR components rendered with snapshots of those public records, plus deterministic fixtures. Framework routing, authentication and database boundaries are isolated in these tests.
3. Full local Next production builds and existing repository checks. There were no database credentials or authorized signed-in production sessions in this workspace. These tests are not proof of deployed PR behavior or database persistence.

## B. Verified behavior and routing

| Entry point | Verified behavior |
| --- | --- |
| `/p/[slug]`, channel flag enabled | Requires a PUBLISHED `ProjectPost` and `Project.isPublic`. Selected approved photograph leads the hero. **Read the Folio Feature** opens the same post at `/feature`. |
| `/p/[slug]/feature` | Same public loader and `StoryRenderer`; original post ID, approved text, room mapping, product sheets and return link are retained. No publication is created. |
| `/p/[slug]?room=…&product=…` | Redirects to the nested feature, preserving room, product, repeated referral parameters and UTM attribution. |
| `/p/[slug]/media/[moduleId]` | Module must belong to that exact public project's published slug, have a non-future publication date, a supported type and eligible renderable assets. Drafts and cross-project IDs fail closed. |
| `/project/[id]` | With channels enabled, visitors and unrelated authenticated users resolve to the published channel before workspace data loads. Authorized workspace viewers retain their editing destination. Private/unpublished projects remain inaccessible. |
| Profile and public feeds | Active organization mosaic retains its published `storyHref`; legacy profile cards now use it too. Public projects with no published post remain without a fabricated reader link. Public feed images must be INCLUDED. |
| Sharing | Channel/feature canonical URLs use the Folio host. Legacy Instagram captions, slide links and QR destinations no longer point to `folio.com`, `folio.ad` or invented `link.bio` paths. Room queries remain compatible. |
| Social image endpoint | Public/PUBLISHED scope, INCLUDED selected hero, Node runtime for Prisma, actual 1200×630 PNG generation, missing-designer fallback and `Cache-Control: no-store`. |
| Rollback | With `FOLIO_EDITORIAL_CHANNELS` disabled, `/p/[slug]` remains the original publication; `/feature` redirects there with its query intact, and module routes are unavailable. No redirect loop. |

The channel uses a single mosaic filtered by All, Spaces, Media and Credits. Media/Credits disappear when no eligible items exist. Shop is a server-authorized, empty **Coming Soon** preview. The separate, pre-existing organization-profile Shop is outside this project-channel preview and was preserved.

Ranking is **deterministic**, not an image-quality assessment: explicit persisted module pins/primary selections, visual media, published feature, then diverse approved spaces and supporting material. The selected hero and persisted photo order are honored. Unpinned repeated rooms are deferred, not discarded. The feature remains in the opening group even with 30 media items; explicit selections can precede it, and its hero CTA remains available. Text-only content stays small. Fixtures cover 0/1/2/3/5/10/25 items and sparse two/three-image layouts.

`ProjectModule.pinned`, `isPrimary`, `ProjectPost.heroAssetId`, photo `displayOrder` and publication presentation settings are persisted fields. **Channel tile `prominence` is only an input type/function capability; there is no persisted channel-layout editor or verified module pinning write flow in this PR.** No new editing system was introduced. A future minimal control should save only validated project-owned IDs/order/sizes through existing project-write authorization, with revision conflict handling; automatic ranking remains the fallback.

## C. Defects fixed

| Priority | Defect and fix | Main files / verification |
| --- | --- | --- |
| High: privacy | Public feed queries could include excluded photos; the legacy profile feed spread complete project records. Added eligibility predicates and explicit public projections. | `src/lib/feed/getPublishedProjectPosts.ts`, `getRecentProjectModules.ts`, `getUpdatesCarousel.ts`; `src/app/api/profile/[userId]/feed/route.ts`; public-feed regression. |
| High: privacy | Public post API returned raw workspace module records, including flexible media metadata and future-dated modules. Added a separate public module reader with exact parent/date/type gates and normalized DTOs. | `src/lib/modules/getProjectModules.ts`, `src/app/api/posting/[slug]/route.ts`, channel page; route/API regression with private sentinels. Workspace reader preserved. |
| High: privacy | Public product DTOs could serialize internal/reference image URLs. Apply the existing provenance policy plus internal display scope before transport; retain approved in-situ crops, product identities and public catalog prices. Pending tags, trade prices and negotiations remain excluded. | `src/lib/post/publicPost.ts`, public branch of `src/app/api/tag-product-to-image/route.ts`; serializer and existing rollout tests. |
| High: privacy | Social-image endpoint lacked public/publication/image gates and used an incompatible Prisma edge runtime. Also, the image library appended custom cache headers to a one-year default. Scope the query, use Node, and replace the cache header after constructing the response. | `src/app/api/og/project/[slug]/route.tsx`; actual raster test catches header and selected-hero behavior, plus private/draft 404 fixtures. |
| High: feature/navigation | Legacy project destinations required workspace access; room links could use missing legacy room IDs and lose attribution. Preserve the workspace for members and redirect public visitors safely. Use the existing story transformer for actual room identities. | `/project/[id]`, all three `/p` routes, `ProjectChannelLanding.tsx`, `links.ts`, legacy profile card; routing and browser journeys. |
| Medium: curation | Media could bury the publication, repeated rooms filled prominent positions, and photography was discarded. Keep all approved photos, diversify placement, bound the feature's automatic position, honor primary selections and restrict large tiles to visual content. | `curation.ts`, Landing, Mosaic; independent ranking fixtures and browser layouts. |
| Medium: media | Stories were treated as videos; object-shaped assets, missing thumbnails, bad URLs and private metadata were mishandled. Normalize known image/video formats and supported provider links. Render image stories as images, native videos only on user action, and explicit unavailable states. | `media.ts`, `ProjectChannelMedia.tsx`, media route, feed readers, `UpdatesCard.tsx`, `StoryViewer.tsx`; format/visibility fixtures and real video decode in Chromium. |
| Medium: permissions/credits | Client-only preview assumptions and dead-end credits were unsafe or misleading. Shop eligibility now comes from project ownership/designer identity or active membership as OWNER/ADMIN in the project's organization. Normalize credits, discard missing names, deduplicate name/role pairs and use plain articles when no valid destination exists. | `access.ts`, channel page/Landing/Mosaic; anonymous/stranger/owner/designer/admin/member/inactive/wrong-org tests, including forged query parameters. |
| Medium: visual/accessibility | Global heading styles made hero titles dark; text could collide with controls; sparse mosaics left poor gaps. Set explicit contrast, wrapping, touch targets, keyboard filter behavior and visual-only sparse spans. | Landing/Mosaic; desktop/tablet/mobile screenshots and keyboard checks. |
| Medium: motion/performance | Slides could change before decoding; motion did not fully respect visibility/reduced-motion preferences. Load one photograph ahead, retain decoded layers (maximum five), transition only after load, skip failed candidates, and pause timers/animation when hidden or requested. | HeroPhotos and its CSS; real seven-second timing, dynamic reduced-motion, pause/resume and visibilitychange tests. |
| Medium: analytics/sharing | Reader referral requests targeted nonexistent `/api/analytics/log`. Use the existing `/api/analytics/event`, with a distinct channel landing event and preserved UTM parameters. Correct stale export hosts. | `StoryRenderer.tsx`, `ProjectChannelShareTracking.tsx`, four legacy Instagram generators; browser request assertions and social export checks. Storage persistence is not verified. |

Regression scripts: `check-project-channel.cjs`, `check-project-channel-routes.cjs`, `check-channel-public-feeds.cjs`, `check-project-channel-og.cjs`, `check-project-channel-browser.cjs`. Package commands and the existing lint workflow now run these checks. Existing public-Folio and project-list privacy tests load the real image-provenance helper; the latter dependency map was corrected after hosted CI identified it. Profile browser tests recognize current generated font names and can exercise the cinematic flag. No assertions were removed to hide a defect.

## D. Remaining conditions, limitations and reproduction

| Severity / scope | Remaining issue | Exact verification or reproduction |
| --- | --- | --- |
| High release-verification condition: `/p/*`, `/project/*`, public APIs | No hosted PR preview or database-backed authenticated role test was available. Local route tests use database/session doubles. | In an authorized preview with this commit and both flags enabled, perform the checklist below using existing approved and private test records. Require hosted checks before merge and this integration pass before activation. |
| High next-product gap: photographic channels without a post | Portfolio-first channels cannot currently be loaded at `/p/[slug]`. | Publish a photographic project without creating a post using the existing authorized flow: it can become public, but has no channel slug/reader. With a draft post present, project publishing invokes editorial lifecycle gates. Do this only in a disposable test environment. |
| Medium content-model gap: Media | ProjectModule JSON permits file IDs/embeds, and separate `Media`/`Story` records are not aggregated. Unsupported structures are omitted rather than exposed or rendered as broken videos. | A published module whose media is only `{fileId: …}`, an opaque embed, or an unknown URL does not appear. A separately published profile `Media` record does not automatically enter the project channel. Add explicit asset-resolution/publication adapters in a separate change. |
| Medium operational limitation: asset availability | A syntactically valid published remote asset can later disappear. No persistent asset-health or thumbnail-generation service exists. | Remove access to a fixture asset: its page shows “This media is currently unavailable.” Live module records and authenticated storage ACLs were not available to test. |
| Medium analytics validation | Requests reach the existing endpoint, which intentionally returns success even when storage fails. | In an authorized test environment, open a share URL, enter the feature, and inspect both event records in the configured analytics storage. A 200 response alone is insufficient. No production analytics writes were made here. |
| Existing repository check failure | Static IDOR CI scan reports 45 findings: 11 Critical, 1 High, 18 Medium, 15 Low. These are heuristic findings, not 45 confirmed exploits. | `npm run security:idor:ci` exits 1. Scan of an archived `origin/main` tree produced the same 45 finding fingerprints. No suppression or unrelated security change was made. |
| Existing build/type debt | Full build succeeds but is not warning-free or fully TypeScript-clean. | Build logs show unchanged `FaNotes` import in `src/app/admin/organizations/page.tsx` and `getServerSession` import in the gen-image feedback route; missing DATABASE_URL causes a magazine-filter fallback. Next skips its embedded type/lint stages by existing configuration; separate lint and the ratchet were run. Baseline reduced 849→846, not raised. |
| Accessibility/device coverage | Chromium viewport and keyboard checks are not a complete WCAG or real-device certification. | Test Safari/iOS, a screen reader and captions/transcripts for actual published videos before claiming comprehensive accessibility. ProjectModule has no standardized caption-track contract. |

Read-only integration checklist (no regeneration, editing, publishing or analytics writes in production):

1. Confirm the exact deployed candidate SHA and flags `FOLIO_EDITORIAL_CHANNELS=true` and `NEXT_PUBLIC_FOLIO_EDITORIAL_PROFILE_HERO=true` in an approved preview. Do not change production flags as part of this audit.
2. As a visitor, open each public slug in section G; assert the selected hero, exact CTA, one feature tile, original headline/introduction and original post ID. Open a room and existing product, close the sheet, return to the project, then visit the designer profile and public feed links.
3. Open `/project/<public project id>?room=<existing room>&product=<existing product>&utm_source=folio_share&ref=a&ref=b`; expect the channel then feature redirects, preserved parameters and no loop. With the channel flag disabled, verify the original publication and feature rollback path.
4. Use separate sessions for the owner, designer, active same-org admin, ordinary member, revoked member and unrelated user. Only the first three should receive the project Shop preview. Inspect HTML/RSC and `/api/posting/<slug>` response bodies: no pending products, raw interview/module metadata, reference/internal product images, trade prices or negotiations. Do not copy private bodies into a public report.
5. Using pre-existing disposable records, request draft/future/cross-project media IDs and unpublished/private slugs, including `/api/og/project/<slug>`: expect 404/absence. Verify a published image story, direct short/long/drone video and external provider link, with and without a thumbnail. No automatic playback.
6. Run database-backed suites only against a disposable database, following the repository's safety acknowledgement. `CORE_TEST_DATABASE_URL` and `EDITORIAL_TEST_DATABASE_URL` were absent here; their skipped tests are not passes.

If an authorized read-only SQL connection is available, the status check can be performed without retrieving editorial/private bodies:

```sql
BEGIN READ ONLY;
SELECT pp.slug, pp.status, p."isPublic", pp."heroAssetId",
       (SELECT count(*) FROM project_images i
        WHERE i."projectId" = p.id AND i.inclusion = 'INCLUDED') AS included_photos
FROM project_posts pp JOIN projects p ON p.id = pp."projectId"
WHERE pp.slug IN ('boca-raton-renovation-JEACJX', 'la-gorce-demo-1-a00c6aee',
                  'lucas-house-VRBWUP', 'meru-XB4XBK');
ROLLBACK;
```

## E. Portfolio-first publishing: precise gap and smallest secure next step

`Project` already has `isPublic` and `publishedAt`, and `publishProjectAction` already permits publication **without** a ProjectPost after firm authorization and photo/room readiness. Interviews are not universally mandatory. However:

- The canonical public slug is on `ProjectPost`, not Project. `getPostBySlug` requires PUBLISHED plus public project. Every new channel currently starts from that loader.
- If a post exists, `publishProjectAction` delegates to `transitionEditorial('publish')`, coupling photographic publication to editorial state/content gates.
- Editorial submit/withdraw/archive transitions can hide the parent project. A permanent photographic destination cannot be independent while that coupling remains.
- Module public readers require the published parent post too. Profile feeds omit a reader destination when no published post exists.
- Imported images' INCLUDED default is not, by itself, durable proof that a designer reviewed and approved the imported portfolio.

The smallest secure follow-up is a stable project-level public slug plus explicit channel publication/review state, a narrow public channel DTO and an authorized channel publish action that checks reviewed included photography/room readiness without publishing any post. Backfill existing eligible channels from their existing published slugs, preserving links and post identities. Reuse durable import approval evidence if available; otherwise record the approved revision/manifest when channel publication is confirmed. Do not infer approval merely from import completion.

Load the optional feature only when its own post is PUBLISHED. Separate **withdraw feature** from **withdraw project** so private editorial work can coexist with a public photo channel, while explicit project withdrawal still hides all public surfaces. Update public module/feed/image eligibility deliberately and test draft imports, stale approval, ownership, excluded photos, independent feature publication and withdrawals. Existing `isPublic`/asset authorization must remain a backstop. No part of this architectural change is implemented by this audit.

Media inventory: `ProjectModule` supports ARTICLE, STORY, SHORT_VIDEO, LONG_VIDEO, GALLERY, BOARD and TIMELINE with flexible JSON; the channel safely renders the four visual types. BOARD retains its legacy feed treatment, not a dedicated channel collection. ARTICLE/TIMELINE need defined public renderers. The separate `Media` table supports video, podcast, interview, webinar, speaking and behind-the-scenes records with hosted/source URLs and `publishedAt`; `Story` has video/expiry fields. `ProjectFile`, `MediaAsset` and `InterviewMediaRecord` are storage/workflow records, not automatic public media. They need explicit approved adapters. Drone footage is ordinary video. No Episodes section or compilation requirement was added.

## F. Visual review

Reviewed actual components and canonical fonts/CSS at 1440×1000, 768×1024 and 390×844. Profile customization additionally passed at 320px. The photographic header, light typography, CTA contrast and preserved profile mosaic are intact. Mobile titles wrap, controls remain reachable and tested pages have no horizontal overflow. Sparse/dense collections retain all items, with no oversized text-only credit cards. Product sheets retain the existing desktop drawer/mobile sheet behavior.

The hero starts at the chosen photograph, uses a seven-second interval with a 1.6-second crossfade and 2.5% zoom, and handles one-image projects without rotating. Reduced motion stops animation and rotation; page-hidden and manual pause stop both. Ordinary images retain Next's responsive optimization; authenticated protected photos retain their existing access-checked optimizer bypass. External module media uses direct URLs, so bandwidth depends on supplied thumbnails/renditions. No measured Core Web Vitals or universal full-resolution reduction is claimed.

Committed screenshots are **local PR component previews**, not deployed PR pages:

- [Boca Raton desktop channel](assets/project-channels-853/channel-desktop.png)
- [Boca Raton mobile channel](assets/project-channels-853/channel-mobile.png)
- [Tablet mixed-content fixture](assets/project-channels-853/channel-tablet.png)
- [Preserved profile mosaic, mobile fixture](assets/project-channels-853/profile-mobile.png)
- [Original Boca Raton room/product sheet, mobile](assets/project-channels-853/feature-product-mobile.png)

## G. Actual published projects

All four public production reader GETs returned 200. Their public serialized records identify them as PUBLISHED with a public project. All 33 approved photo URLs and 30 existing tag-crop URLs returned 200. No private record enumeration was used.

| Public project / slug | Original post ID | Public source contents | PR hero / feature result |
| --- | --- | --- | --- |
| Boca Raton Renovation — `boca-raton-renovation-JEACJX` | `cmm18m8kx0001l2040ecqor0n` | 6 photos, 5 chapters, 26 tags | Selected hero, correct CTA, original publication/headline/introduction/room quote and product sheet in local desktop/mobile tests. |
| La Gorce Dr Home — Demo 1: Published — `la-gorce-demo-1-a00c6aee` | `2aa33afd-42a8-4a87-afbc-ddf5e7940095` | 19 photos, 14 chapters, 4 tags | Same checks, including an existing product sheet. |
| Luca's House — `lucas-house-VRBWUP` | `cmjrzx1sh0001qd0g2govfcb3` | 4 photos, 4 chapters, no tags | Selected hero, correct CTA and original feature text/room quote; no product sheet invented. |
| Meru — `meru-XB4XBK` | `cmhzna2bc0001qdik2hhawf3h` | 4 photos, 4 chapters, no tags | Selected hero, correct CTA and original feature text/room quote; no product sheet invented. |

Production still serves its existing reader at `/p/<slug>`. Boca Raton's live reader was additionally opened and its introduction read at desktop/mobile widths, with no page overflow or browser exceptions. The first mobile attempt was intercepted by the existing cookie banner; dismissing it resolved the interaction. All live browser requests were restricted to GET/HEAD. The PR hero verification used the public snapshots through the PR's public serializer and components; it is not a claim that this PR is deployed.

## H. Final test matrix

| Area | Result | Evidence |
| --- | --- | --- |
| Existing published feature in hero | PASS locally with real public snapshots | Four original post IDs, selected heroes, exact CTA; 30-media ranking fixture retains feature. |
| Feature navigation | PASS | Actual server-page fixtures, query preservation, legacy/member split, original reader browser journeys and product links. |
| Intelligent mosaic | PASS deterministic rules | Independent ranking fixtures, counts 0/1/2/3/5/10/25, pins/primary selections, room diversity, supporting text, three viewport sizes. |
| Media visibility | PASS supported formats; model gap recorded | Parent/date/type gates, normalized private/draft/invalid/deleted asset fixtures; image stories and deliberate real video decoding. |
| Credits | PASS fixtures | Missing names/roles, duplicates, invalid/absent links, conditional tab and noninteractive cards. |
| Private Shop | PASS server fixtures; live-role condition open | Ownership/active same-org admin matrix, forged query denial, no Shop product DTO or purchase flow. |
| Desktop responsive | PASS Chromium | 1440px/768px journeys, screenshots, no overflow. |
| Mobile responsive | PASS Chromium widths | 390px channels/readers; 320px profile/settings; live Boca reader. No iOS device claim. |
| Accessibility | PASS checked behaviors; partial coverage | Keyboard filter activation, labels/state, touch targets, pause and reduced motion, existing publication entry suite. No full WCAG certification. |
| Security | PASS scoped regressions; existing scanner failure | Public serializers and APIs, asset/Shop gates, image delivery; unchanged 45 IDOR fingerprints on main. Database integration pending. |
| Build | PASS local full production build | Flags enabled; dynamic channel/feature/media/OG routes emitted. Existing warnings/fallbacks documented. |
| Portfolio-first readiness | NOT IMPLEMENTED | Public slug/loader and lifecycle coupling remain; secure next step specified in E. |

Additional executed checks:

- `npm run test:project-channels`: 18 pure tests, actual route/API/public-feed regressions, real OG raster, editorial boundary and public module boundary scripts.
- `npm run test:project-channels:browser`: actual components, synthetic adversarial cases and optional public-record snapshots; media decode, failure states, UTM requests, seven-second timing and visibility/reduced-motion checks.
- Profile appearance data/routes: 6 + 12 passing tests. Profile browser customization passes with cinematic flag enabled and disabled, including save/reload, failed-save retry, cover/crop/color/identity/facts and lower-role denial.
- Existing core safety: 3 pass; project draft persistence: 4 pass; firm posting policy: 5 pass; designer authorization: 11 pass / 1 database test skipped; core journeys: 7 pass / 1 database group skipped; editorial lifecycle: 3 pass / 1 database journey skipped.
- Rollout/privacy suite: 6 privacy tests, 3 image input tests, 4 transport tests and 11 serialized-reader scenarios passed. Project-list privacy: 6 checks passed.
- Existing publication entry, immersive rooms (300 gallery sizes and 120-room ordering), presentation, history and social export checks passed. Existing production-mode image-delivery fixture passed optimizer/access/no-store checks.
- `npm run typecheck:prepare`, separate TypeScript ratchet and full production build executed. The final baseline is 846, reduced from 849. No TypeScript configuration or diagnostic suppression was added.
- Repository `npm run lint`: zero errors, existing warnings remain. Client import boundary and migration discipline guards pass.
- The first hosted Design System Discipline run identified raw size/spacing literals in the channel components. These were replaced with canonical Folio type/spacing tokens, without adding guard exemptions. The exact workflow checks and browser previews were rerun.
- `npm run security:idor:ci`: failed identically on current/base, as documented above. It is not counted as a pass.

Local detailed logs are under `.tmp/channel-audit/`; all public snapshots, downloaded assets, temporary fixtures and raw logs remain uncommitted. The committed browser scripts run with synthetic records by default. To reproduce the optional public-snapshot pass after preparing the build/fonts:

```sh
PUBLIC_POST_FIXTURES=/path/to/public-post-json \
PUBLIC_ASSET_FIXTURES=/path/to/public-assets-with-manifest \
npm run test:project-channels:browser
```

## I. PR delivery

Changes are committed and pushed only to the existing PR branch. The exact final commit SHA and hosted check state are supplied in the task delivery; the report is part of that commit. The new server/unit/raster checks run in the existing core job; channel and cinematic-profile browser checks run after generated types/fonts in the TypeScript job, with screenshot artifacts. Local success does not substitute for hosted check completion. No merge or deployment is authorized by this report.

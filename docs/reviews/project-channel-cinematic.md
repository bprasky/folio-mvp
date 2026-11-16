# Cinematic project channels

This change replaces the hard-coded dark channel presentation with a cinematic composition that inherits Folio's existing appearance setting. The default remains light. The saved setting owns the hero wash, continuous canvas, navigation, text-only tiles, media pages and portfolio viewer. No new theme store, system-color override, publication route or feature flag is introduced.

## Behavior and boundaries

- Published posts retain `/p/[slug]` and the original `/p/[slug]/feature` reader. The hero contains **Read the Folio Feature**, and photograph links carry both room and exact photo identity while preserving repeated referral parameters and product links. Valid photo/room links enter the corresponding story or shared gallery directly; ordinary feature entry retains its cover.
- Already-public portfolios with a nonfuture `publishedAt` render at the existing `/project/[id]` URL. The narrow public query selects only public identity and INCLUDED photographs, never a draft post, interviews, product records or workspace data. Private, unpublished and future-dated projects still return not found.
- Members keep the existing workspace. **View public project** opens `?view=public`; once a feature is published, that destination redirects to the canonical channel. No project or editorial publication state is created or changed.
- Portfolio photographs open a full-screen Radix modal with next/previous buttons, arrow keys, swipe, Escape, focus containment and restoration to the originating tile. Single-photo projects omit next/previous controls. The viewer follows the site theme and keeps the selected mosaic filter.
- All / Spaces / populated Media / populated Credits filter one mosaic. Existing deterministic prominence, room diversity and approved hero order are retained. Existing server-side Shop eligibility remains intact; public visitors receive no Shop preview or product payload.
- Existing independently gated module publication behavior is unchanged. Portfolio-only projects do not expose draft editorial credits or modules whose public readers require a published post. This change does not create a separate portfolio publishing workflow or broaden public feed eligibility.
- The approved slideshow retains its five-photo limit, decode-before-transition behavior, seven-second interval, pause/resume, hidden-page pause and reduced-motion support. No episodes or autoplaying media are added.

## Verification

Local checks use the actual components, CSS and fonts. Database/session boundaries are doubled for the server-route suite; browser tests render controlled public fixtures. A read-only snapshot of the existing public Boca Raton project supplies real photography for visual review. No production data was edited or published.

- Project-channel suite: publication/privacy, excluded images, draft/future/cross-project media, owner/stranger/member/admin/revoked permissions, forged parameters, public transport, original feature identity, photo redirects, portfolio admission and later feature upgrade.
- Existing publication-entry and room suites: cover behavior, mobile gestures, ghost-click protection, reduced motion, source images, 300 gallery sizes, 120-room ordering and studio editing.
- Publication presentation: 24 checks, including preservation of saved settings and concurrent-edit protection.
- Core journeys: 21 pass; two database-dependent tests skipped because no disposable database was configured.
- Rollout/public-reader privacy: pass, including 11 serialized-reader boundary scenarios.
- Client import boundary and migration discipline: pass.
- Repository lint: pass with existing warnings. TypeScript ratchet: 846 existing diagnostics, zero additions; baseline unchanged.

The full production build and final responsive/theme browser evidence are recorded below. Existing build warnings include the admin `FaNotes` import, gen-image feedback `getServerSession` import and a magazine-filter fallback without DATABASE_URL. These are unchanged from the prior main report.

Live authenticated database sessions, Safari/iOS and a screen-reader audit were not exercised. No merge, deployment, environment change or production database mutation is part of this PR.

## Final results and screenshots

The full production build passes with the existing warnings above. The final browser suite passes without browser exceptions: desktop/tablet/mobile channel and original reader journeys; 320/390/768/1440px appearance and portfolio viewer cases; actual saved-setting toggle, reload and navigation; OS dark preference with a light default; focus containment/restoration, Escape, button/arrow navigation, single-photo behavior; exact supporting-photo and shared-gallery links; deliberate video decode and unavailable-media fallback; real seven-second slideshow timing, pause, hidden-page and reduced-motion behavior; and referral propagation.

The real public Boca Raton snapshot additionally passes original-post identity, selected hero, feature headline/introduction, room narrative/quotation and product-sheet checks at desktop and mobile widths. Its public API fields are combined with the publicly rendered BP Design identity, without querying private records. Portfolio-state screenshots below simulate absence of an editorial publication using that same public photography; they are not evidence of a new portfolio publication.

These are local component previews with the site's canonical fonts/CSS; existing global navigation is not duplicated in the fixture. Nothing shown here is a deployed change.

| View | Light (default) | Dark (saved site setting) |
| --- | --- | --- |
| Published channel, desktop | [Light desktop](assets/project-channel-cinematic/channel-light-desktop.png) | [Dark desktop](assets/project-channel-cinematic/channel-dark-desktop.png) |
| Published channel, phone | [Light phone](assets/project-channel-cinematic/channel-light-mobile.png) | [Dark phone](assets/project-channel-cinematic/channel-dark-mobile.png) |
| Portfolio state, phone | [Light portfolio](assets/project-channel-cinematic/portfolio-light-mobile.png) | [Dark portfolio](assets/project-channel-cinematic/portfolio-dark-mobile.png) |

Reproduction: `npm run test:project-channels`, `npm run typecheck:prepare`, `CHANNEL_TEST_BROWSER=<Chromium path> npm run test:project-channels:browser`, `npm run typecheck`, `npm run lint`, and `FOLIO_EDITORIAL_CHANNELS=true npm run build`. Optional read-only public snapshots use `PUBLIC_POST_FIXTURES` and `PUBLIC_ASSET_FIXTURES`; `CHANNEL_PUBLIC_ONLY=1` refreshes those visual checks after the full fixture suite has passed. Snapshots and raw local logs are deliberately uncommitted. The existing GitHub workflow runs both channel suites.

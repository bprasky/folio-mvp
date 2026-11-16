# Editorial styling refinement

Approved scope, 2026-11-16. Branch: `codex/editorial-design-tokens`, based on
[project-channel PR #854](https://github.com/bprasky/folio-mvp/pull/854).
The comparison baseline is `d1390362`; this branch also includes the subsequent
`cef0d421` test-only focus-restoration fix, with identical application code.
Review this PR against `codex/project-channel-cinematic` so the already-reviewed
channel implementation stays separate. No merge or deployment was performed;
the existing `git.deploymentEnabled: false` setting is unchanged.

## Architecture and implementation

Folio already centralizes theme colors and typography in `globals.css`, exposed
through Tailwind. Editorial geometry was distributed among literal classes,
CSS modules and duplicated mosaic renderers. Generic radius names also serve
controls: `rounded-md` is 16px, `rounded-lg` 24px, `rounded-xl` 20px and
`rounded-2xl` 28px. Changing them would alter unrelated interfaces.

The patch adds opt-in editorial tokens to the canonical root and exposes card
and hero radii plus decorative rules through Tailwind. Two shared component
classes own the editorial container and small-row mosaic geometry. Consumers
replace their old literals; no page-selector overrides, new runtime wrappers,
theme provider, data layer, routes or ranking rules are introduced.

| Token / helper | Value | Consumers and effect |
| --- | --- | --- |
| `--editorial-radius-card` / `rounded-editorial` | 6px | MagazineMosaicGrid, FlowMosaic, designer project and profile shop tiles, search MomentCard, homepage reel frames, corresponding skeletons. |
| `--editorial-radius-hero` / `rounded-editorial-hero` | 8px | Homepage desktop frame and mobile photo, matching hero skeleton. Mobile title placement and desktop overlays remain unchanged. |
| `--editorial-mosaic-gap` | 10px | Shared small-row mosaics and the existing channel desktop grid. |
| `--editorial-mosaic-gap-compact` | 8px | Existing channel mobile grid; visual value unchanged. |
| `--editorial-mosaic-pitch` / `.folio-editorial-microgrid` | 20px pitch | Grid auto-rows are pitch minus gap. Existing columns, row spans, order and dense packing are retained. |
| `--editorial-gutter`, `--editorial-content-max` / `.folio-editorial-container` | 16px mobile, 32px from 640px, maximum 1440px | Homepage hero, reel, filter contents, mosaic and skeletons share aligned edges. Hero image `sizes` matches the new content width. |
| `--editorial-rule` / `border-editorial-rule` | Existing subtle border at 70% opacity | Homepage filter boundaries and mobile reel separator only. Resolves against the selected light/dark palette. |

A 34-row card originally measured `34 × 8 + 33 × 12 = 668px`. Reducing the gap
alone to 10px would reduce that height to 602px. The paired 10px row unit instead
produces 670px: each tile grows 2px and its row position remains unchanged. This
is the approved compensation, verified against the parent in Chromium.

FlowMosaic adoption reaches events/festivals, organization project feeds and
onboarding selection previews through their existing shared component. Designer
and shop pages consume the same geometry class without sharing or altering
their distinct ranking and routing functions. Search keeps its existing 16px
gaps and grid geometry; its parent frame now owns image clipping, so nested
images no longer impose a competing radius.

ProjectChannel.module.css changes only three declarations, replacing its 6px
radius and 10/8px gaps with equal-valued tokens. Its hero, filters, widths, spans,
viewer, media behavior and theme logic are intact. The original workspace and
the #854 branch were not edited.

Generic Card/RidgeCard, glass surfaces, dialogs, inputs, buttons, pills,
navigation, custom organization colors/profile variants and immersive
publication geometry retain their own styling. Canonical fonts, surfaces,
functional gold and focus indicators are unchanged. No standalone brand book
or mood-board assets were available in the audited repository or referenced
conversation attachments.

## Verification

- Full Next production build and compile/route-type preparation pass. Existing
  unrelated warnings include admin `FaNotes`, gen-image feedback
  `getServerSession`, dynamic-route prerender messages and missing-database
  fallbacks. The build's existing lint/type skips were not changed; those checks
  are run separately.
- Repository lint passes with existing warnings. All seven design-system
  discipline checks pass, as do client-import and migration-discipline guards.
- TypeScript budget passes at 846 existing diagnostics, zero additions, with
  the committed baseline unchanged. The first run through shared dependency
  junctions produced five path-only fingerprint differences. An independent
  dependency directory resolves those; no guard or baseline was relaxed.
- New `npm run test:editorial-styling`: 48 before/after comparisons across six
  actual component flows at 320/390/768/1440px, in light and dark. All pass:
  unchanged tile content, link targets, column/row spans and vertical placement;
  expected 2px height compensation; no new horizontal overflow; shared corners
  and aligned homepage edges.
- The same suite exercises homepage Following/reset/pagination with fixed
  hero/reel content, reel click/impression analytics into a local sink, mobile
  reel scrolling, search callbacks, keyboard onboarding selection, shop modal
  opening, unchanged computed utility card/input/button/dialog styling and
  dialog Escape. Saved dark survives navigation/reload; an OS dark preference
  does not override the light default. No browser exceptions.
- Existing project-channel server/privacy/route suites and browser suite pass:
  original reader/product links, sparse/dense mosaics, media, slideshow timing,
  reduced motion, 320–1440px light/dark, exact photograph navigation, portfolio
  viewer focus/return/arrows and theme persistence.
- Existing organization/profile browser suite passes at 320/390/768/1440px:
  actual tabs/mosaic, settings/save/reload, error recovery and access fixtures.
- Existing navigation browser suite passes. Its font discovery now recognizes
  the current self-hosted Next font names, matching the other browser suites;
  navigation application code is unchanged.
- The responsive journey harness waits for a visible, stable nested-dialog
  opener before clicking. Its existing focus, Escape and unsaved-text assertions
  are retained; dialog application code is unchanged.

These are actual components and styles, served locally with fixture content and
framework/auth/API adapters. Links and ranking results are compared with the
parent, but this is not live database-backed integration. Screenshots use one
previously cached public photograph with clearly synthetic titles/products;
they are layout evidence, not a proposed change to homepage content. Real
accounts, source records and analytics services were not written. Safari/iOS,
screen readers and authenticated hosted routes were not exercised.

## Pre-existing findings kept outside this cosmetic scope

1. At 320px the designer page header overflows in both parent and candidate
   fixtures. Tile geometry is preserved; the header layout is unchanged.
2. In dark mode the homepage active filter is almost white on white. A late
   legacy `:root` block redeclares `--folio-bg` after the dark block; the chip
   uses that legacy foreground alias. The desktop hero eyebrow also keeps a
   light pill behind theme-aware light text. Before/after computed foreground
   and background colors match exactly; these are not regressions from this
   patch. The screenshots deliberately retain them. Follow-up should use
   explicit canonical contrasting foreground/background pairs at those owners,
   rather than globally changing legacy aliases or forcing a theme.

## Reproduction

Use installed Chromium via `EDITORIAL_TEST_BROWSER` when it is not at
`/usr/bin/chromium`, then run `npm run test:editorial-styling`. The default
comparison ref is the reviewed parent `d1390362`; `EDITORIAL_BASE_REF` can select
another parent for a cosmetic comparison. `EDITORIAL_PHOTO` optionally selects
a local photo; otherwise the test serves an illustrated placeholder.
`EDITORIAL_CAPTURE_ONLY=1` produces before/after screenshots and compares
existing label colors without running the full behavior matrix.

Existing checks: `npm run typecheck:prepare`, `npm run typecheck`,
`npm run lint`, `npm run build`, `npm run test:project-channels`,
`npm run test:project-channels:browser`, `node scripts/check-org-profile-browser.cjs`
with `ORG_PROFILE_TEST_CINEMATIC=true`, and `node scripts/check-navigation-browser.cjs`.
Use each browser script's documented executable override on Windows.

## Visual evidence

| | Before | After |
| --- | --- | --- |
| Desktop, light | [Before](assets/editorial-design-tokens/before-home-light-1440.webp) | [After](assets/editorial-design-tokens/after-home-light-1440.webp) |
| Desktop, dark | [Before](assets/editorial-design-tokens/before-home-dark-1440.webp) | [After](assets/editorial-design-tokens/after-home-dark-1440.webp) |
| Mobile, light | [Before](assets/editorial-design-tokens/before-home-light-390.webp) | [After](assets/editorial-design-tokens/after-home-light-390.webp) |
| Mobile, dark | [Before](assets/editorial-design-tokens/before-home-dark-390.webp) | [After](assets/editorial-design-tokens/after-home-dark-390.webp) |

[Geometry/behavior matrix](assets/editorial-design-tokens/results.json) ·
[Existing label comparison](assets/editorial-design-tokens/visual-baseline.json)

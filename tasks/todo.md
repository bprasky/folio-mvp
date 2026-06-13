# Homepage v2 — Editorial Elevation Feed UI-fidelity corrections

Branch: claude/dazzling-noether-lypt3w. Handoff: Folio_Design_System_2 (design_handoff_homepage_v2).
Scope: the five UI-fidelity corrections in the v2 handoff. The data layer / components
(Task 05) already shipped — this is the correction pass for implementation drift.

## Audit result (ran AUDIT.md, read-only)

- #1 Nav anchored + remove in-hero wordmark — **DRIFT**: nav transparent at rest with
  corner wordmark hidden until scroll; a second "FOLIO" is embossed inside the hero
  (HomepageHeroXL:57-82, the `data-folio-wordmark-sentinel`).
- #2 Filter bar below editorial — ✅ already correct (HomepagePage order: hero → reel → filter → mosaic).
- #3 Boost reel fills row (7 + "+N"), no entity leak — ✅ already correct (BoostReel grid 8 cells,
  names React-escaped + truncated with title tooltip; no `&quot;`/Hopson string anywhere).
- #4 Dense mosaic (spanFor + grid-flow-dense, ≥12) — ✅ already correct (MagazineMosaicGrid, take:12).
- #5 Scrim strength 0.82 — **DRIFT**: currently 0.58 single bottom gradient (HomepageHeroXL:49-55).

## Plan

- [ ] 1. HomepageHeroXL: remove the embossed in-hero FOLIO wordmark block (correction #1).
- [ ] 2. HomepageHeroXL: replace the 0.58 bottom-only scrim with the spec's full-inset
      0.82 two-gradient overlay (correction #5).
- [ ] 3. EditorialMasthead: on the homepage, render a solid canvas-background bar with the
      corner FOLIO wordmark always visible; drop the now-removed in-hero sentinel observer
      branch (correction #1). Other routes unchanged.
- [ ] 4. Verify: tsc on touched files, grep no remaining sentinel refs, build sanity.

## Review

Done. Two of the five corrections were live drift; the other three already shipped correctly
(verified, not assumed).

- **#1 (HomepageHeroXL):** removed the embossed in-hero `FOLIO` wordmark + its
  `data-folio-wordmark-sentinel`. The audit had marked #1 "correct" because the wordmark
  wasn't *duplicated* — but the spec says to *remove* it. Re-reading the literal correction
  caught the gap.
- **#1 (EditorialMasthead):** homepage now renders a solid `--surface-canvas` bar with a
  `--folio-border-subtle` hairline and the corner FOLIO mark always visible (`showCornerMark`
  includes `isHomePage`). Dropped the now-dead in-hero sentinel observer branch; the homepage
  falls through to the harmless scroll-threshold fallback. Other routes unchanged
  (transparent-at-rest → glass-on-scroll preserved).
- **#5 (HomepageHeroXL):** replaced the 0.58 bottom-only gradient with the spec's full-inset
  0.82 two-gradient overlay (bottom ramp 0.82→0.41→0.082→transparent@68% + top wash
  0.35→transparent@22%).
- **#2/#3/#4:** confirmed already correct — filter bar sits below the editorial; BoostReel is
  7 + "+N" with React-escaped, title-tooltipped names (no `&quot;`/Hopson leak); mosaic uses
  `MagazineMosaicGrid` `spanFor()` + `grid-flow-dense` with 12 tiles.

Verification: `tsc` clean on both touched files (repo has unrelated pre-existing type drift);
no remaining `folio-wordmark-sentinel` refs in `src/`; no tests depend on the touched files.

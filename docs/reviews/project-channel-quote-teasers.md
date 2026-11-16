# Project-channel interview teasers

Published features now lend their selected designer quotations to the existing project slideshow. A quote replaces the description on its associated photograph, with a small attribution and the existing feature action below it. The title and actions stay in place across rotations. The site appearance setting continues to own the colors and defaults to light.

## Selection and scope

- Reuse the canonical story's room/photo associations, including supporting photographs. Keep the selected hero, photo order, five-photo limit and seven-second interval.
- Show up to three distinct selected quotations of at most 180 characters, in slideshow order. Preserve their text exactly; do not regenerate, trim or truncate it. Repeated supporting photos may share their room's quote.
- Honor quote authorship: Folio editorial lines, inactive designer selections and unselected alternatives are not presented as designer quotations. Legacy selected strings remain supported.
- Reused photos with conflicting chapter associations, missing selections, oversized quotes and unmatched photos use the existing description. Quotes do not migrate to unrelated photographs.
- Prefer the public designer's name for attribution, then the existing firm/studio identity. If no identity exists, use only “From the Folio Feature.”
- Resolve selection on the server and pass only selected text and photo identities to the slideshow. Public post transport, publication/privacy gates, routes, feature links and product tags are unchanged.
- Portfolio-only projects receive no quotes, even if draft interview data exists. Their description, slideshow behavior and accessible photo viewer remain unchanged.

## Reading behavior

Photograph and quote use the same active slide state. A failed or still-loading next image cannot advance the quote independently. Hover and keyboard focus pause quote-bearing slides; explicit pause, document visibility and reduced motion continue to work. All selected copy occupies one reserved grid area, so differences in copy length do not move the title or actions. Only the active copy is visible or exposed to assistive technology; automated changes are not live announcements. Reduced motion disables quote transitions.

## Verification

The review uses local actual-component browser fixtures, including a read-only snapshot of the published Boca Raton project. It does not publish or change production data.

- Channel selection/server/privacy suites: pass, including exact selected text, legacy and supporting-photo mapping, ambiguity, quote limits, editorial authorship and portfolio exclusion.
- Existing verbatim pull-quote contract: pass. On Windows, the existing shell-based checks ran through Git Bash with the TypeScript loader.
- Production build: pass. Existing unrelated `FaNotes`, `getServerSession` and database-unavailable prerender warnings remain.
- TypeScript diagnostic budget: 846 existing, zero added. Scoped ESLint and client import boundary: pass.
- Chromium at 320/390/768/1440px: light-default and saved-theme persistence, portfolio description/viewer preservation, precise feature/product navigation, short/long quote geometry, description fallback, seven-second timing, hover/focus/explicit/hidden-page pauses, reduced motion, failed-image skipping and delayed-image synchronization all pass.
- The Boca Raton public snapshot passes in light/dark on desktop/mobile, including original publication prose and product-sheet behavior. The screenshots below capture the implemented components after photo/copy transitions finish.
- Design-system discipline and whitespace checks: pass. GitHub checks run independently on the PR.

## Visual review

| Appearance | Desktop | Mobile |
| --- | --- | --- |
| Light (default) | [Preview](assets/project-channel-quotes/light-desktop.png) | [Preview](assets/project-channel-quotes/light-mobile.png) |
| Dark (saved setting) | [Preview](assets/project-channel-quotes/dark-desktop.png) | [Preview](assets/project-channel-quotes/dark-mobile.png) |

This change does not alter interview generation or publication. Safari/iOS and authenticated production sessions have not been exercised. Merge and deployment require a separate follow-up.

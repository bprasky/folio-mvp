# Editorial loading continuity

The approved loading treatment is a faint Folio wordmark near the top of the incoming page, resolving into the always-visible header brand. It is an overlay, not a splash screen or permanent banner. Removing the duplicate masthead recovers vertical space without changing editorial content.

## Route audit

| Surface | Previous mismatch | Updated behavior |
| --- | --- | --- |
| Root / homepage | Spinner, generic loading copy; session gate replaced the entire page with unrelated text bars | Homepage hero at 5:4 mobile / 21:10 desktop with 600px desktop minimum, tagged-products reel, filters and mosaic |
| Feed | Only hero/grid; heading, modes, updates strip and card text omitted | Full page shell and mode-aware content, shared with nested Suspense fallback |
| Events | Removed sidebar still reserved 256px; obsolete filters/card grid | Current festival timeline widths, nearby-event controls and FlowMosaic row spans |
| Photographer | Wrong avatar size, portfolio width and missing About sections | Current profile/header, dividers, About/styles/travel and portfolio geometry |
| Inherited root fallback | Same spinner everywhere | Quiet status with transient branding; never guesses that another route has the homepage layout |
| Shared layout | Session resolution hid the header and remounted content | Persistent navigation and one stable content shell; page-level authorization remains unchanged |

Data-dependent content counts and optional sections cannot be known before data arrives. Skeletons represent the populated layout, not a promise of exact item counts or text lengths. MainLayout and SimpleLayout had equivalent spacing; the shared layout now uses one stable SimpleLayout instance for ordinary routes. Marketing, auth and project-workspace exceptions remain.

## Motion and accessibility

- No new images, fonts, packages, requests or artificial minimum page duration.
- Reveal only when a fallback remains mounted after 160ms; fast loads never show the mark.
- A 280ms transform/opacity animation targets the measured header logo. Content is already interactive during this exit.
- The provider survives fallback unmounts; overlapping boundaries and interrupted exits are handled independently.
- Resize remeasures the position; scrolling during exit cancels outdated geometry. Auth routes have no header target and no decorative mark.
- Decorative copy is hidden from assistive technology and never receives pointer input. Each route fallback announces loading once. Reduced motion disables the collapse.

## Verification

Run `LOADING_TEST_BROWSER=/path/to/chromium node scripts/check-editorial-loading.cjs` after `npm run typecheck:prepare` to use build-cached brand fonts. The fixture renders actual React loading components, shared layout/header and homepage hero with synthetic routing, auth and data. It does not call production APIs.

Browser checks cover 320, 390, 768 and 1440px: exact homepage hero bounding-box parity; overflow across all five layouts; fast loads; interrupted exits; nested fallback handoffs; resize; persistent header through session resolution; immediate content interaction; reduced motion; unrelated root routes and auth routes. Screenshots use the project's actual fonts and have been inspected. See browser-results.json.

Focused lint passes with existing `any` warnings in the feed and events pages. Client-import and migration guards pass. Compile-mode build passes with existing unrelated import warnings (`FaNotes`, `getServerSession`). No migration, merge or deployment is part of this change.

TypeScript: the branch and untouched main each produce 895 diagnostics with the same dependency installation and generated route types. The standard ratchet still flags a differently truncated/ordered rendering of the existing authOptions route-export error. Worktree comparison also exposes absolute dependency-path differences caused by shared node_modules. No changed source file has a TypeScript diagnostic. Hosted checks must complete before merge; baseline files have not been loosened.

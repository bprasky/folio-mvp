# Session — Great Folio Delete Batch 2

Date: 2026-09-08  
Branch: `codex/folio-hardening`  
Implementation commit: `e2f8b8cc5cedeede4b87b78c046de0f647bd80d5` — Remove superseded editorial renderer tree  
Status: committed and pushed to origin.

## Scope and outcome

Removed the unmounted legacy editorial renderer after rebuilding its current import graph. All 22 original candidates were confirmed obsolete and deleted: 3,248 production-source lines. No candidates were retained and no additional assets or barrels were removed.

There were zero route, API route, dependency, Prisma or migration changes. No surviving application source was modified. Shared outbound helpers, quote/status APIs, canonical editorial generation/lifecycle, public rendering, preview, social export and magazine/feed queries remain unchanged.

## Exact deletion set

All paths below are relative to `src/components/project/editorial/`.

| Deleted file | Source lines |
|---|---:|
| DetailBlock.tsx | 59 |
| EditorialCaption.tsx | 61 |
| EditorialProductFloat.tsx | 139 |
| EditorialProjectLayout.tsx | 378 |
| EditorialPullQuote.tsx | 36 |
| EditorialSpread.tsx | 154 |
| GalleryBlock.tsx | 74 |
| GlassSurface.tsx | 31 |
| HeroSpreadBlock.tsx | 92 |
| ProductFloatFallback.tsx | 24 |
| ProductFloatMesh.tsx | 103 |
| ProductInsertBlock.tsx | 152 |
| PullQuoteBlock.tsx | 173 |
| ScrollCinematic.tsx | 140 |
| ScrollCinematicCanvas.tsx | 178 |
| SplitEditorialBlock.tsx | 99 |
| TextInterludeBlock.tsx | 39 |
| layoutEngine.ts | 943 |
| productImageHelper.ts | 96 |
| roomPriority.ts | 126 |
| spacing.ts | 31 |
| textHelpers.ts | 120 |
| **Total: 22 files** | **3,248** |

## Caller and canonical-path evidence

- Reconstructed static imports, re-exports, literal dynamic imports and require calls using TypeScript resolution across tracked JS/TS files; checked symbols, mounts, routes, scripts, tests, docs and recent history.
- `EditorialProjectLayout.tsx` had no inbound caller. `spacing.ts` was independently callerless. Every inbound edge for the remaining candidates originated inside the obsolete tree.
- Internal branches included EditorialSpread → EditorialCaption; EditorialProductFloat → mesh/fallback/image helper; ScrollCinematic → canvas; hero/split blocks → GlassSurface; and layoutEngine → text/room helpers.
- No external runtime callers or dangling runtime references remained. No renderer-exclusive barrels, CSS, static assets or obsolete-only tests required removal.
- Public chain: `/p/[slug]` → `getPostBySlug` → canonical `ProjectPost` (PUBLISHED and parent Project public) → `StoryRenderer` → `buildStoryData` / `buildEditorialChapters` → Mosaic, RoomTilePair, PhotoTile, QuoteTile and current product/media components.
- Feed, magazine, designer preview, social export and admin editorial surfaces did not depend on the candidate tree.
- Preserved shared TaggedImage, ActionIconBar, folder hooks/modal, editorial types, schemas, formatRoomName, package dependencies and both interview quote/status APIs.

## Verification results

| Check | Result |
|---|---|
| `npm run test:core` | PASS: 8 passing tests, 1 live-database group skipped |
| Editorial lifecycle tests | PASS: 3 passing tests, 1 live-database group skipped |
| Single-generator and editorial block bounds | PASS |
| Pull-quotes/verbatim/provenance and quote audit | PASS |
| Generation context and editorial room matching | PASS |
| Regeneration surfaces and story editing | PASS |
| Canonical StoryRenderer server-render smoke | PASS: fixture title/data, room/product mapping, room image markup and initial hero placeholder |
| `npm run typecheck:prepare` | PASS |
| `npm run typecheck` | PASS: debt reduced, zero new fingerprints |
| `npm run typecheck:baseline:update` | PASS: lower baseline committed |
| `npm run typecheck:test` | PASS: all 5 guard tests |
| Client-import guard | PASS: 0 violations |
| Production build | PASS |
| Changed-file lint | Not applicable: no surviving JS/TS source changed |
| IDOR scan | Unchanged: 558 routes; 0 Critical, 1 existing High, 16 Medium, 19 Low |
| Diff scope and whitespace review | PASS |

All five core journeys retained passing status: signup/onboarding; project/room/image/product tagging; ownership isolation; interview → ProjectPost → publication, including public read and withdrawal; vendor/designer collaboration.

The renderer smoke exercised actual server rendering with a fixture and session provider. It did not exercise browser hydration. Live database groups were explicitly skipped, not counted as passing database verification.

## TypeScript reduction

| Metric | Before | After |
|---|---:|---:|
| Diagnostics | 1,003 | 994 |
| Fingerprints | 635 | 627 |
| Files with diagnostics | 257 | 255 |
| New fingerprints | — | 0 |

All nine removed diagnostics (eight fingerprints) belonged to deleted EditorialProjectLayout and layoutEngine files. No unrelated TypeScript source was changed.

## Other changed files

- `tools/typescript-baseline.json`: valid reduction above.
- `tasks/todo.md`: Batch 2 plan, completed checklist and verification review.
- `docs/contextual-search-audit-report.md`: replaced a stale current-renderer claim with a historical note and the canonical public chain.

This session summary is a subsequent documentation-only addition.

## Concrete findings and remaining limits

- The approximate audit count of 3,270 included one extra trailing empty line per file; Git reports 3,248 actual source lines removed.
- Existing grep-based editorial scripts needed installed Git Bash as their Windows child shell. They passed unchanged in that environment.
- StoryRenderer initially emits a hero placeholder until client orientation detection; the server-render smoke checks that existing behavior.
- Historical source comments and audit references were retained where they do not create runtime imports.
- Live database execution and the previously parked P0 infrastructure verification remain parked. This batch did not reopen either workstream.
- Local verification logs are under `tasks/delete-batch2-*`; these were left as local artifacts. Existing unrelated untracked files were preserved.

GREAT FOLIO DELETE BATCH 2 COMPLETE

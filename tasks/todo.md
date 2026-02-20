# Align Article Format to Luca's House Canonical Layout

## Problem
The `generateEditorialDraft.ts` (old path used by `getOrCreateEditorialDraft.ts`) produces a flat, impoverished block structure compared to the canonical format produced by `composeEditorialHard()` in the generate route.

### Canonical Format (Luca's House / composeEditorialHard output):
- `lead: { kicker, deck }` — proper headline + subtitle
- Multiple `galleryChapters` organized by room, each with title, body[], imageIds[], optional pullQuote
- `pullQuotes: string[]`
- `credits: [{ role, name }]`
- `materialsLedger: { items: [{ name, finish?, note?, productId?, vendorId? }] }`
- `mode: 'recomposition'`

### Broken Format (old generateEditorialDraft / parseNarrativeToBlocks):
- `lead: { deck }` — NO kicker, no title
- Single flat `galleryChapter` with project title, only 3 paragraphs, max 4 images
- `method: string[]` — raw truncated answers as method items
- `qa: [{ q: "Q", a: ... }]` — bare "Q" placeholder
- Empty `credits: []`
- No `mode` set

## Fixes

### Fix 1: `generateEditorialDraft.ts` - `toFallbackBlocks()`
- [x] Add `kicker` to lead block (use project title or designer name)
- [x] Generate multiple gallery chapters (group images by room if available)
- [x] Set `mode: 'recomposition'`
- [x] Populate credits with designer info
- [x] Don't put raw answers in method/qa

### Fix 2: `generateEditorialDraft.ts` - `parseNarrativeToBlocks()`
- [x] Extract kicker from article headline
- [x] Distribute images across multiple chapters instead of stuffing all into one
- [x] Generate proper credits from input.designer
- [x] Set `mode: 'recomposition'`
- [x] Remove placeholder "Q" in qa items

### Fix 3: `getOrCreateEditorialDraft.ts` - fallback block generation
- [x] Add kicker to lead block
- [x] Set `mode: 'recomposition'`

## Verification
- [x] Build passes
- [x] Blocks from both paths match canonical schema shape

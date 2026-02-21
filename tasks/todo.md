# Content Storage & Display for Super Articles

## Problem Statement
As Folio moves from single-designer articles to multi-party Super Articles, each
contributor will be interviewed about materials, products, design decisions, etc.
The current AI generation pipeline compresses all interview content into a ~4096-token
editorial (expandedBlocks) with strict character limits. This means contributor-specific
commentary about products gets summarized, merged, or dropped entirely.

**The user's goal:** Never lose context. The AI-composed editorial should be the
curated highlight reel, but ALL contributor commentary—especially per-product
insights—should be stored and surfaced in dedicated UI locations:
- Product hover tooltips (what each person said about this product)
- Materials section (expanded per-contributor notes)
- Credits/voices section (contributor perspectives)

No content should be "dumbed down or factored out due to discretion by the AI."

---

## Current State Analysis

### What exists already
1. **`SupplementalQuote` model** — stores question/answer pairs linked to a specific
   `ProductTag` and `ProjectPost`, with `displayLocation` field ('near_product',
   'sidebar', 'end_of_post') and `source` field. Currently designed for single-designer
   "micro-answers" — no `userId` or contributor attribution.

2. **`Contribution` model** — stores full voice contributions from any user, linked to
   an `ArticleTopic`, optional `productId`, `projectId`. Has `status`, `editedContent`,
   `pullQuote`, `displayOrder`. Currently tied to the ArticleTopic system, not directly
   to the per-product interview flow.

3. **`EditorialInterviewAnswer`** — stores raw interview answers (unlimited text), linked
   to optional `linkedProductId` and `linkedImageId`. This is where the uncompressed
   designer voice lives today. No multi-party support (tied to a single EditorialInterview
   per project).

4. **`expandedBlocks` schema** — tight character limits:
   - Body paragraphs: 5000 chars each
   - Material notes: 140 chars
   - Q&A answers: 800 chars, max 8 pairs
   - Pull quotes: 300 chars, max 5

5. **Generation pipeline** — 4096 token output budget for Claude Sonnet. This is the
   bottleneck where multi-party context gets compressed.

### What's missing
- **No per-product, per-contributor commentary storage** that's surfaced on the
  published page
- **SupplementalQuote has no userId** — can't attribute quotes to specific contributors
- **No UI to display per-product commentary** on hover or in materials section
- **No mechanism to preserve ALL interview answers** about products when generating
  the compressed editorial

---

## Implementation Plan

### Step 1: Extend SupplementalQuote for multi-party attribution
**Database change:** Add `userId` and `contributorRole` to `SupplementalQuote`.

```sql
ALTER TABLE supplemental_quotes
  ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN contributor_role TEXT;
CREATE INDEX idx_supplemental_quotes_user ON supplemental_quotes(user_id);
```

This is the simplest path: SupplementalQuote already has `productTagId`,
`displayLocation`, and is linked to `ProjectPost`. Adding attribution makes it
the per-product, per-contributor commentary store.

**Why not Contribution?** Contribution is tied to ArticleTopic (a content-gathering
system for roundup articles). SupplementalQuote is already the "micro-answer tied
to a product on a published article" model — it just needs attribution.

### Step 2: Populate SupplementalQuotes during article generation
After the AI composes the editorial (expandedBlocks), run a second pass that:

1. Collects ALL interview answers that reference a product (`linkedProductId`)
2. For each product × contributor pair, creates a `SupplementalQuote` with:
   - The interview question as `question`
   - The full, uncompressed answer as `answer`
   - `productTagId` linking to the spatial tag on the image
   - `userId` of the contributor
   - `contributorRole` (Designer, Architect, Contractor, etc.)
   - `displayLocation = 'near_product'`
   - `source = 'interview'`
3. Does NOT truncate or summarize — stores the raw answer

This means the editorial can be as tight as it wants (4096 tokens), but every
word the contributor said about a product is preserved in SupplementalQuotes.

### Step 3: Fetch product commentary for the published page
Extend `getPostBySlug` to include supplemental quotes:

```typescript
// In getPostBySlug, add to the query:
supplementalQuotes: {
  where: { displayLocation: 'near_product' },
  select: {
    id: true,
    question: true,
    answer: true,
    contributorRole: true,
    userId: true,
    productTagId: true,
    pinned: true,
  },
  orderBy: { createdAt: 'asc' },
}
```

Then group them by `productTagId` so the UI can look up commentary per product.

### Step 4: Enhanced product hover (ImageTagDots)
When hovering over a product dot on an image, show contributor commentary:

**Current tooltip:** Product thumbnail + name + vendor + "Add to project"

**Enhanced tooltip:**
```
┌─────────────────────────────────┐
│ [img] Heath Ceramics Tile       │
│       Heath Ceramics            │
│ ────────────────────────────── │
│ Designer: "We chose this       │
│ for its matte finish that      │
│ catches morning light..."       │
│                                 │
│ Architect: "The tile module    │
│ aligns with our 4" grid..."    │
│ ────────────────────────────── │
│ [+ Add to project]             │
└─────────────────────────────────┘
```

Each commentary entry shows contributor role + a truncated preview (with
"read more" expanding inline or navigating to the materials section).

### Step 5: Enhanced MaterialsSection with per-contributor commentary
Transform the materials section from a simple list to expandable cards:

**Current:** `Heath Ceramics Tile • Matte White • Designer's note`

**Enhanced:**
```
┌─────────────────────────────────────────┐
│ Heath Ceramics Tile                      │
│ Matte White · Heath Ceramics             │
│                                          │
│ ▸ Designer — Sarah Chen                  │
│   "We chose this for its matte finish    │
│   that catches morning light perfectly.  │
│   The 4x4 format gave us flexibility..."  │
│                                          │
│ ▸ Architect — James Park                 │
│   "The tile module aligns with our 4"    │
│   grid system. We specified the matte    │
│   to reduce glare from the skylight..."  │
│                                          │
│ ▸ Contractor — Pacific Coast             │
│   "Setting this tile required a specific │
│   thin-set for the radiant floor below.  │
│   We used Laticrete 254..."              │
└─────────────────────────────────────────┘
```

Each contributor section is collapsible. Default: show first 2 lines with
"read more" toggle. This keeps the page scannable but makes ALL context
accessible.

### Step 6: Update generation pipeline to extract product quotes
In the generate route, after composing the editorial:

1. Parse all `EditorialInterviewAnswer` records for the project
2. For each answer with a `linkedProductId`:
   - Find or match the corresponding `ProductTag` (product → tag lookup)
   - Create/upsert a `SupplementalQuote`
3. For Super Articles with multiple InterviewSessions:
   - Each contributor's session produces their own SupplementalQuotes
   - The `userId` and `contributorRole` come from the InterviewSession owner
4. On regeneration (new contributor added):
   - Only add new quotes, don't delete existing ones
   - Mark stale quotes if the contributor re-interviews

---

## Files to modify

1. **`prisma/schema.prisma`** — Add userId, contributorRole to SupplementalQuote
2. **`src/lib/post/getPostBySlug.ts`** — Include supplementalQuotes in query
3. **`src/components/project/ImageTagDots.tsx`** — Enhanced hover with quotes
4. **`src/components/project/MaterialsSection.tsx`** — Expandable cards with commentary
5. **`src/components/project/ImmersiveProjectPage.tsx`** — Pass quotes data down
6. **`src/app/api/posting/project/[projectId]/interview/generate/route.ts`** — Extract
   product-specific quotes after generation
7. **`src/app/api/posting/project/[projectId]/route.ts`** — Include quotes in preview
   data fetch

## What this does NOT change
- The editorial generation budget (4096 tokens) — that stays tight and curated
- The expandedBlocks schema — no new limits needed
- The interview flow — designers/contributors answer the same way
- The Contribution model — that's for ArticleTopic roundups, separate system

## Key principle
**The AI editorial is the highlight reel. SupplementalQuotes are the director's
commentary.** Nothing gets thrown away — it just gets tucked into the right place.

---

## Previous Task History (archived)

### Interview Flow Implementation - Completed
- Interview component directory, types, shared components
- Text interview flow, API routes, orchestrator
- Interview Intelligence System phases 0-6

### Pending (unrelated)
- Voice interview (Phase 2), vendor data backfill, cross-interview learning

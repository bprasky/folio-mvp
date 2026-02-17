# Interview System Current State Assessment (V2)

**Date**: 2026-02-17
**Purpose**: Comprehensive code-level audit of the interview system for planning upgrades

---

## QUESTION 1: Image Classification Pipeline

### Answer

Folio uses **Claude Vision (Anthropic claude-sonnet-4-20250514)** for per-image classification at upload time. Classification runs asynchronously (fire-and-forget) and extracts 6 attribute categories. There is **no project-level synthesis** — only per-image classification.

### Evidence

**Model called**: `claude-sonnet-4-20250514` via Anthropic SDK
- `src/lib/aesthetic/imageClassification.ts:20-22`

**Fields extracted per image** (`ImageClassification` interface at `src/lib/aesthetic/imageClassification.ts:5-12`):

```typescript
export interface ImageClassification {
  colors: string[];      // "green", "navy", "brass", "warm white"
  materials: string[];   // "marble", "oak", "brass", "velvet", "linen"
  styles: string[];      // "modern", "coastal", "minimalist", "mid-century"
  mood: string[];        // "airy", "moody", "warm", "dramatic", "serene"
  elements: string[];    // "pendant lighting", "kitchen island", "built-ins"
  spaces: string[];      // "kitchen", "living room", "primary bedroom"
}
```

Prompt requests 2-5 items per category, lowercase, designer-focused vocabulary.

**Storage** (`prisma/schema.prisma:348-378`, `ProjectImage` model):

| Column | Type | Purpose |
|--------|------|---------|
| `aiClassification` | `Json?` | Full `ImageClassification` result |
| `aiClassifiedAt` | `DateTime?` | When classification ran |
| `aiTags` | `String[]` | Combined explicit + AI tags |
| `aiColors` | `Json?` | Dominant color palette |
| `aiMaterials` | `String[]` | AI-detected materials |
| `aiSpaces` | `String[]` | AI-detected space types |

**Example JSON shape** (from type definition + prompt):
```json
{
  "colors": ["navy", "warm white", "brass"],
  "materials": ["marble", "velvet", "oak"],
  "styles": ["modern", "mid-century"],
  "mood": ["serene", "sophisticated"],
  "elements": ["pendant lighting", "built-in shelving"],
  "spaces": ["kitchen", "dining area"]
}
```

**Trigger points:**
1. **At upload** (async, non-blocking): `src/app/api/projects/[id]/images/route.ts:120-124` — calls `indexMoment(image.id)` fire-and-forget
2. **On-demand reclassification**: `src/app/api/posting/project/[projectId]/classify-images/route.ts:34-56` — catches images where initial classification failed
3. **Admin batch reindex**: `src/app/api/admin/reindex-moments/route.ts` — processes all images in batches of 100

**Classification execution flow** (`src/lib/search/indexMoment.ts:262-416`):
1. Fetch image + relations
2. `analyzeImage()` — Sharp-based color/contrast (fallback)
3. `detectAITags()` -> `classifyImage()` -> Claude Vision
4. `extractAttributes()` — merge AI tags with product data
5. Update `ProjectImage` (aiClassification, aiTags, etc.)
6. Upsert `MomentIndex` for search

**Richness level**: GOOD per-image (6 categories x 2-5 items, designer vocabulary like "brass" not "gold"). THIN at project level — no aggregated palette, style consensus, or mood synthesis.

**Project-level synthesis**: NONE. `generateContextualQuestions()` at `src/lib/editorial/generateContextualQuestions.ts:80-146` samples attributes from individual images but does not aggregate.

### Gaps
- No project-level aesthetic synthesis
- Color palette not aggregated across images
- No style consensus calculation
- Fallback to Sharp-only produces empty materials/styles/mood/elements

---

## QUESTION 2: Typical Project Data Shape at Interview Time

### Answer

A single `prisma.project.findUnique()` fetches images (with AI classifications + product tags), rooms (with selections), standalone selections, and project files. ProductTags always link to a Product record (cannot be freetext). Vendor name is frequently null and falls back to "Unknown Brand".

### Evidence

**Data loading function**: `assessProjectContext()` at `src/lib/interview/contextLevel.ts:345-404`

**Query includes:**
```typescript
const project = await prisma.project.findUnique({
  where: { id: projectId },
  include: {
    images: {
      select: {
        id, url, name, room, aiClassification, aiMaterials, aiColors,
        tags: { include: { product: true } }
      },
      orderBy: { displayOrder: 'asc' }
    },
    files: { select: { id, fileName, fileType, fileUrl } },
    rooms: {
      include: {
        selections: { select: { id, productName, vendorName, colorFinish, unitPrice } }
      }
    },
    selections: {
      select: {
        id, productName, vendorName, colorFinish, roomId, unitPrice,
        room: { select: { id, name, type } }
      }
    }
  }
});
```

**Image handling**: No limit on images — all fetched, ordered by `displayOrder ASC`.

**ProductTag model** (`prisma/schema.prisma:486-505`):
- `productId: String` — REQUIRED, always links to Product
- Cannot be freetext

**Product model** (`prisma/schema.prisma:442-484`):
- `name: String` — REQUIRED
- `brand: String?` — OPTIONAL (nullable)
- `vendorId: String?` — OPTIONAL (nullable)

**Selection model** (`prisma/schema.prisma:575-615`):
- `vendorName: String?` — OPTIONAL
- `productName: String?` — OPTIONAL
- `roomId: String?` — OPTIONAL (unassigned selections possible)
- `unitPrice: Decimal?` — used for hero piece detection (`> 1000`)

**Vendor data handling** (`src/lib/interview/contextLevel.ts:457-467`):
```typescript
const selections = project.selections
  .filter((s) => s.productName || s.vendorName)
  .map((s) => ({
    productName: s.productName || 'Unknown Product',
    brand: s.vendorName || 'Unknown Brand',
    room: s.room?.name || 'Unassigned',
    isHeroPiece: Boolean(s.unitPrice && Number(s.unitPrice) > 1000),
  }));
```

**Context levels** (sequential, each requires previous):
- Level 0: No data -> generic questions
- Level 1: `hasPhotos`
- Level 2: `hasMaterialSchedule` OR `hasSelectionsAsSchedule`
- Level 3: `hasConceptPresentation`
- Level 4: `hasFloorPlan`
- Level 5: `hasProgressPresentations`

**Project size classification** (`src/lib/interview/contextLevel.ts:111-140`):
- 0-1 rooms: `focused` -> 6 questions
- 2-3 rooms: `medium` -> 8-10 questions
- 4-6 rooms: `large` -> 12-14 questions
- 7+ rooms: `showcase` -> 15-18 questions

### Gaps
- Vendor name frequently null, substituted with "Unknown Brand" — questions using this feel generic
- No limit on image count could cause performance issues with large projects

---

## QUESTION 3: Question Generation — Templates vs AI

### Answer

Question generation is **100% template-based with no LLM calls**. There are ~50+ distinct templates organized by context level (0-5). Context injection is sophisticated — inserts product names, vendor names, room names, spatial relationships. Deduplication uses two-phase semantic topic grouping + text-based fallback.

**AI is used downstream** in answer analysis (Claude Sonnet) and narrative generation — but NOT in question generation itself.

### Evidence

**No LLM calls in generation path:**
- `src/lib/interview/generateQuestions.ts` — 100% template interpolation
- `src/lib/editorial/generateContextualQuestions.ts` — 100% template interpolation

**Contextual question templates** (`src/lib/editorial/generateContextualQuestions.ts:27-53`):

5 attribute types x 3 variations = **15 templates**:
```typescript
const QUESTION_TEMPLATES = {
  color: [
    "What drew you to {value} for this space?",
    "The {value} tones really set the mood here. What influenced that choice?",
    "Tell us about the color story - particularly the {value}.",
  ],
  material: [
    "Tell us about the {value} - what led you to that choice?",
    "The {value} is striking. What made it right for this project?",
    "Walk us through your thinking on the {value} selection.",
  ],
  style: [
    "The space feels very {value}. Was that the direction from the start?",
    "There's a clear {value} sensibility here. How did that evolve?",
    "What does {value} mean to you in this context?",
  ],
  mood: [
    "There's a {value} atmosphere throughout. How did you achieve that?",
    "The {value} quality is palpable. Was that intentional?",
    "Tell us about creating this {value} feeling.",
  ],
  element: [
    "The {value} really anchors the space. What's the story there?",
    "Tell us about the {value} - it's such a focal point.",
    "How did the {value} come into the design?",
  ],
};
```

**Core interview templates** (`src/lib/interview/generateQuestions.ts`):
- **Level 0**: 8 generic questions (lines 95-140)
- **Prospective**: 8 prospective project questions (lines 145-190)
- **Level 1**: 9 room-type-specific templates (lines 325-455)
- **Level 2**: 6 material schedule patterns (lines 461-559)
- **Level 3**: 4 concept presentation templates (lines 565-631)
- **Level 4**: 5 floor plan patterns (lines 637-721)
- **Level 5**: 5 progress presentation patterns (lines 727-806)

**Specificity spectrum:**

| Level | Example | Specificity |
|-------|---------|-------------|
| Generic | "Tell us about this project and what made it special." | Low |
| Attribute | "What drew you to {value} for this space?" | Medium |
| Room-specific | "The kitchen feels like the heart of this home..." | Medium-High |
| Vendor+room | "${vendor.name} appears throughout--in the ${roomList}. What keeps you coming back?" | High |
| Product+room | "The ${productName} in the ${room}...Tell us about selecting this piece." | Very High |
| Spatial flow | "The ${fromRoom} leads to the ${toRoom}...Was that drama intentional?" | Very High |

**Deduplication** — Two phases:

**Phase 1: Topic-based semantic dedup** (`src/lib/interview/generateQuestions.ts:880-927`):
- Groups questions by 15 semantic topics (PROJECT_STORY, VENDOR_LOYALTY, ANCHOR_PIECE, etc.)
- Within each topic, keeps most specific (highest `specificityScore()`)
- Specificity scoring (lines 851-861): +4 for product, +2 for rooms, +1 for vendors, +0-5 for context level

**Phase 2: Text-based dedup** (lines 932-950):
- Normalized text comparison (first 50 chars, lowercase, alphanumeric only)
- Same type+room combo filter

**Question count**: Determined by `classifyProjectSize()` — 6-18 questions by project size.

### Gaps
- No AI personalization of question phrasing
- Templates are static — don't adapt to designer's communication style
- "Unknown Brand" substitution creates awkward questions

---

## QUESTION 4: Current Interview Flow (Text Mode)

### Answer

The interview is a **sequential one-question-per-screen flow** with no manual question selection (auto-selected). Follow-ups are generated per-question via AI after each answer. The system includes **question morphing** — remaining questions get rewritten or skipped based on prior answers.

### Evidence

**Flow sequence:**

```
1. Mode selector: "Live Conversation" vs "Written Responses"
2. Questions auto-selected (no picker phase)
   - src/components/posting/interview/InterviewModal.tsx:428-435
3. Sequential Q&A phase (one question per screen)
   - Phase: "question"
   - Component: QuestionCard
   - Progress: "Question 1 of N"
4. After each answer:
   - Save answer to DB
   - POST /api/.../interview/followups/single -> AI generates follow-ups
   - Returns: followups + acknowledgment + questionUpdates (morph/cover)
   - Skip fully-covered questions, rewrite morphed questions
5. Follow-up phase (batch, optional)
   - Phase: "followup"
   - Component: FollowUpsForm
   - Grouped by parent question
   - Autosave every 60 seconds
6. Generate editorial
   - Phase: "complete"
   - POST /api/.../interview/generate
```

**Key UI components:**
- `InterviewModal.tsx` (1,525 lines) — main orchestrator
- `QuestionCard.tsx` — single-question display
- `FollowUpsForm.tsx` — batch follow-up answers
- `PromptPicker.tsx` — **EXISTS but UNUSED** (manual picker, kept in codebase)
- `InterviewModeSelector.tsx` — mode choice UI
- `FooterBar.tsx` — phase-aware navigation

**Question morphing** (`InterviewModal.tsx:134`, API at `followups/single/route.ts:45-72`):
- After each answer, API returns `questionUpdates` with three statuses:
  - `"covered"` — skip this question entirely
  - `"morphed"` — rewrite question text based on prior answer context
  - (default) — leave unchanged

**Answer constraints:** Max 2,000 chars per answer. Cmd/Ctrl+Enter to submit.

**Persistence:** Server + localStorage autosave (every 400ms).

### Gaps
- PromptPicker exists but is dead code
- No skip/dismiss individual questions during sequential flow
- Follow-ups are optional batch — could feel like an afterthought

---

## QUESTION 5: Voice Mode (Sofia) Status

### Answer

Sofia is **code-complete but NOT deployed to production**. Full microservice exists at `services/interview-orchestration/` with LiveKit/Deepgram/Cartesia/Claude integration. UI component exists but **simulates** the interaction. Feature flags exist and default to enabled in `.env.example`.

### Evidence

**Infrastructure:** `services/interview-orchestration/` — standalone Node.js microservice (Express, port 3001)

**Feature flags** (`src/lib/flags.ts`):
- Client: `NEXT_PUBLIC_FLAG_REALTIME_INTERVIEW === '1'`
- Server: `REALTIME_INTERVIEW_ENABLED` in session route

**Sofia system prompt** (`services/interview-orchestration/src/conversation/persona.ts:9-76`):
- "A senior editorial journalist who has spent twenty years covering interior design"
- "Genuinely curious, never performative. Warm but incisive"

**Voice config** (`services/interview-orchestration/src/services/cartesia.ts:204-211`):
- Model: `sonic-english`, Speed: 0.95, Stability: 0.7, Clarity: 0.9

**UI simulation** (`RealtimeInterviewView.tsx:108-129`):
```typescript
// Note: In production, you would connect to LiveKit here
// For now, we'll simulate the connection and use polling
```

**Database schema** (`prisma/schema.prisma:4759-4850`):
- `RealtimeInterviewSession` with extracted quotes/products/themes
- `RealtimeConversationSegment` with per-turn extractions

**External services:** LiveKit (WebRTC), Deepgram (STT), Cartesia (TTS), Claude (conversation)

**Why not live:** No deployment manifest. Client uses simulation. ORCHESTRATION_SERVICE_URL not in prod config.

---

## QUESTION 6: Completed Interview Count

### Answer

**Cannot be determined from code alone.** System ~2 weeks old (since early Feb 2026). No seed data, fixtures, or admin analytics for interview counts.

### Evidence

**Status enum** (`prisma/schema.prisma:1334-1358`):
```prisma
enum EditorialInterviewStatus {
  IN_PROGRESS
  COMPLETED
  PUBLISHED
}
```

**Migration timeline:** Feb 4-14, 2026. No seed data for interviews. No admin dashboard.

**To query:** `SELECT status, COUNT(*) FROM editorial_interviews GROUP BY status;`

---

## QUESTION 7: Signal Recording Bug Confirmation

### Answer

**BUG CONFIRMED.** `recordAtelierSignal()` passes a `value` field that does not exist in the `AtelierSignal` schema. The error is silently swallowed by try/catch. All 8 callers are affected — **zero signals are being persisted.**

### Evidence

**Function** (`src/lib/atelier/signals.ts:18-44`):
```typescript
export async function recordAtelierSignal(input: SignalInput) {
  const { ownerType, designerId, vendorId, sourceType, sourceId, key, value, weight } = input;
  try {
    await prisma.atelierSignal.create({
      data: {
        ownerType, designerId, vendorId, sourceType, sourceId, key,
        value,      // <-- FIELD DOES NOT EXIST IN SCHEMA
        weight: weight ?? 1.0,
      },
    });
  } catch (error) {
    console.error("[Atelier] Failed to record signal:", error, input);
  }
}
```

**Schema** (`AtelierSignal` model): Has `metadata: Json?` — NOT `value`.

**All 8 callers (all silently failing):**

| File | Line | Signal Key | Value Passed |
|------|------|-----------|-------------|
| `src/app/api/tag-product-to-image/route.ts` | 243 | `product_tagged` | productId |
| same | 255 | `category:{cat}` | productId |
| same | 268 | `vendor:{vendor}` | productId |
| same | 281 | `decision_reasoning` | decisionReasoning |
| same | 293 | `alternatives_considered` | JSON.stringify(...) |
| same | 305 | `tradeoffs` | tradeoffs |
| same | 317 | `conviction_level` | String(convictionLevel) |
| `src/lib/editorial/processInterviewAnswers.ts` | 152 | `interview_verified_*` | correctedValue |

### Fix Required
Change `value` to `metadata` wrapping in JSON: `metadata: { value }`

---

## QUESTION 8: Other AI Processing in Project Lifecycle

### Answer

**35+ LLM integration points** using OpenAI (gpt-4o-mini, gpt-4o, text-embedding-3-large) and Anthropic Claude (claude-sonnet-4-20250514). AI processing occurs at image upload, interview answer submission, editorial draft generation, narrative creation, PDF import, designer reasoning extraction, and embedding generation.

### Evidence

**Models used:**

| Model | Provider | Usage |
|-------|----------|-------|
| `claude-sonnet-4-20250514` | Anthropic | Interview analysis, narratives, classification, import, reasoning |
| `gpt-4o-mini` | OpenAI | Editorial drafts, captions, support chat, product autocomplete |
| `gpt-4o` | OpenAI | Collaboration Round 2/3 questions |
| `text-embedding-3-large` | OpenAI | Semantic search embeddings |

**Key AI calls by trigger:**
- **Image upload**: Claude Vision classifies aesthetics
- **Interview answer**: Claude analyzes sentiment, quotability, vendor mentions -> boost creation
- **Editorial draft**: OpenAI gpt-4o-mini generates structured blocks
- **Narratives**: Claude generates spatial, design, room, material narratives
- **PDF import**: Claude Vision detects rooms/products from slides
- **Atelier recompute**: Claude extracts designer reasoning patterns
- **Embeddings**: OpenAI for products, vendors, events, projects (batch job)

**Intelligence available for interview leverage (no additional API calls):**
1. Per-image classifications (colors, materials, styles, mood, elements, spaces)
2. Designer reasoning patterns (statedApproach, materialTendencies, vendorAffinities)
3. Answer analysis results (sentiment, themes, quotability)
4. Spatial narrative generation
5. Product/vendor embeddings

### Gaps
- Answer analysis happens post-submission but doesn't feed back into question selection
- Designer reasoning extraction exists but isn't consumed by interview question generation
- No cross-project pattern detection

---

## SUMMARY TABLE

| Question | Key Finding |
|----------|-------------|
| **Q1: Image Classification** | Claude Vision per-image, 6 categories x 2-5 items, stored as JSON. No project-level synthesis. |
| **Q2: Project Data Shape** | Single query fetches images+tags+rooms+selections. ProductTags require Product link. Vendor often null. |
| **Q3: Question Generation** | 100% template-based (~50+ templates). No AI. Sophisticated context injection. Two-phase dedup. 6-18 questions. |
| **Q4: Interview Flow** | Sequential one-per-screen. Auto-selected. Per-question follow-ups via AI. Question morphing/skipping. |
| **Q5: Sofia Voice Mode** | Code-complete, NOT deployed. Full microservice with LiveKit/Deepgram/Cartesia/Claude. UI simulated. |
| **Q6: Interview Count** | Cannot determine from code. System ~2 weeks old. No admin analytics. |
| **Q7: Signal Bug** | CONFIRMED. `value` vs `metadata` mismatch. All 8 callers silently failing. Zero signals persisted. |
| **Q8: Other AI Processing** | 35+ integration points. Rich intelligence exists but interview system doesn't leverage designer reasoning or cross-project patterns. |

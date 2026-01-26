# Folio Designer Content Creation Flows - Audit Report

**Date:** 2026-01-26
**Scope:** Project Upload, Photo Tagging, PDF Import, Editorial Generation

---

## Executive Summary

Folio has four primary content creation flows for designers. This audit maps each flow's entry points, inputs, outputs, and documents how they connect (or fail to connect).

### Key Findings

| Flow | Entry Point | Output | Connected To |
|------|-------------|--------|--------------|
| Project Upload | Designer Dashboard → "Add Project" | Project + ProjectImages + ProductTags | Tagging, Editorial |
| Manual Tagging | ProjectCreationModal Step 3 | ProductTag records + Atelier signals | Project Upload |
| PDF Import | Designer Dashboard → "Import Presentation" | Rooms + Selections + PendingProductTags | **Disconnected from ProductTag flow** |
| Editorial | MediaSection → "Continue to Interview" | ProjectPost.expandedBlocks | Project, Tags |

### Critical Gaps Identified

1. **PDF Import creates Selections, not ProductTags** - Two parallel product systems
2. **No direct path from PDF Import → Editorial** without manual intervention
3. **Atelier signals only recorded in manual tagging** - PDF import bypasses ML training
4. **Room creation only in PDF import** - Manual flow doesn't create rooms

---

## Flow 1: Project Upload

### Entry Point
**Location:** `src/app/designer/page.tsx:479-486`

```
Designer Dashboard → "Add Project" button → ProjectCreationModal opens
```

### Process Steps

| Step | UI | Data Collected |
|------|-----|----------------|
| 1 | Project Details | title, category, client, credits |
| 2 | Image Upload | files OR URLs → ProjectImage[] |
| 3 | Product Tagging | click positions → ProductTag[] |

### State/Data Collected

```typescript
// Step 1: Project Details
{
  projectName: string,          // Required
  projectCategory: ProjectType, // Required: Residential|Commercial|Hospitality|Retail|Office
  projectClient?: string,
  credits: Credit[]             // Designer collaborators with roles
}

// Step 2: Images
ProjectImage {
  id: string,
  url: string,      // Supabase URL or external
  name: string,
  room?: string     // User-entered room name (unused downstream!)
}

// Step 3: Tags
ProductTag {
  x: number,        // 0-100% position
  y: number,
  productId: string,
  imageId: string
}
```

### API Calls (Sequence)

1. `POST /api/projects` → Creates Project (status="draft")
2. `POST /api/projects/{id}/images` → Creates ProjectImage per image
3. `POST /api/tag-product-to-image` → Creates ProductTag per tag
4. Records Atelier signals (async, non-blocking)

### Output State

| Entity | Count | Status |
|--------|-------|--------|
| Project | 1 | draft, isPublic=false |
| ProjectPost | 1 | DRAFT (if credits provided) |
| ProjectImage | N | Linked to project |
| ProductTag | M | Linked to images |
| Products | K | isPending=true (if scraped) |

### Key Files

- `src/components/ProjectCreationModal.tsx` (1792 lines - main modal)
- `src/app/api/projects/route.ts` (CRUD)
- `src/app/api/projects/[id]/images/route.ts` (image upload)
- `src/app/api/tag-product-to-image/route.ts` (tagging)

---

## Flow 2: Manual Photo Tagging

### Entry Points

**Primary:** ProjectCreationModal Step 3 (during project creation)
**Secondary:** Project edit mode (existing projects)

```
ProjectCreationModal → Step 3: "Tag Products" → Click image → Product selection modal
```

### Input Requirements

| Requirement | Source | Required? |
|-------------|--------|-----------|
| Image URL | Uploaded in Step 2 | Yes |
| Project ID | Created in API call | Yes |
| Image ID | Created after image upload | Yes (for persistence) |
| Product catalog | `/api/products` | Yes |

### Tagging Interface

**Component:** `src/components/AdvancedTagProducts.tsx`

```typescript
// Click-to-tag interaction
1. User clicks anywhere on image
2. Modal opens with two tabs:
   - "Search Products" - search existing catalog
   - "Add from URL" - scrape new product
3. Select product → tag created at click coordinates
```

### Product Sources

| Source | API | Creates |
|--------|-----|---------|
| Existing catalog | `GET /api/products` | ProductTag only |
| Scraped (new) | `POST /api/scrape-product` | Product (isPending=true) + ProductTag |

### Output

**ProductTag record:**
```typescript
{
  id: string,
  x: number,          // Percentage 0-100
  y: number,
  productId: string,
  imageId: string,
  createdAt: DateTime
}
```

**Atelier Signals (ML training data):**
- `product_tagged` - main signal
- `category:{category}` - category preference
- `vendor:{vendorId}` - vendor preference
- Optional: `decisionReasoning`, `alternativesConsidered`, `convictionLevel`

### Key Files

- `src/components/AdvancedTagProducts.tsx` - Click-to-tag interface
- `src/components/product/ProductTagPanel.tsx` - Tag display panel
- `src/components/project/ImageTagDots.tsx` - Visual tag dots
- `src/app/api/tag-product-to-image/route.ts` - Tag creation API

---

## Flow 3: PDF/Presentation Import

### Entry Points

**Location:** `src/app/project/[id]/MediaSection.tsx`

```
Designer Dashboard → "Import Presentation" button
  OR
Drag-drop PDF/PPTX file on media section
```

### File Types Accepted

| Format | Extension | Max Size |
|--------|-----------|----------|
| PDF | .pdf | 50MB |
| PowerPoint | .pptx | 50MB |

### Processing Pipeline

```
┌─────────────────────────────────────────────────────────┐
│ 1. SESSION CREATION                                     │
│    POST /api/import/session                             │
│    → ImportSession (status: PROCESSING)                 │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 2. FILE UPLOAD → Supabase Storage                       │
│    Bucket: "imports"                                    │
│    Path: imports/{sessionId}/source-{i}.{ext}          │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 3. IMAGE EXTRACTION                                     │
│    POST /api/import/presentation                        │
│    - PPTX: Extract from ppt/media/ directory           │
│    - PDF: Convert pages via Cloudinary                  │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 4. AI ANALYSIS (Parallel)                               │
│    POST /api/import/{sessionId}/analyze                │
│    ┌──────────────────┐  ┌──────────────────┐          │
│    │ Visual (Claude)  │  │ Text Extraction  │          │
│    │ - Room type      │  │ - Vendors (60+)  │          │
│    │ - Products       │  │ - Prices         │          │
│    │ - Style/colors   │  │ - Dimensions     │          │
│    │ - Confidence     │  │ - SKUs           │          │
│    └──────────────────┘  └──────────────────┘          │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 5. PENDING TAGS CREATED                                 │
│    Database: PendingProductTag                          │
│    (NOT ProductTag - different entity!)                 │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 6. USER REVIEW (VerificationQueue)                      │
│    - Confirm/Correct/Dismiss each tag                  │
│    - Batch operations for high/low confidence          │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 7. FINALIZE                                             │
│    POST /api/import/{sessionId}/finalize               │
│    Creates:                                             │
│    - Room records (auto-detected)                       │
│    - Selection records (NOT ProductTag!)               │
└─────────────────────────────────────────────────────────┘
```

### AI Extraction Details

**Visual Detection (Claude API):**
```typescript
{
  roomType: 'living_room' | 'bedroom' | 'kitchen' | ...,
  products: [{
    description: "Navy velvet sofa with brass legs",
    category: FURNITURE | LIGHTING | RUG | ...,
    position: { x: 0.45, y: 0.62 },  // Normalized 0-1
    confidence: 'high' | 'medium' | 'low',
    searchQuery: "navy velvet sofa brass legs"
  }],
  styleIndicators: ["mid-century modern"],
  dominantColors: ["navy", "brass"],
  materials: ["velvet", "brass"]
}
```

**Text Extraction (Pattern Matching):**
- **Vendors:** 60+ known brands (RH, West Elm, CB2, etc.)
- **Prices:** `$1,485`, `$6,120 ea.`
- **Dimensions:** `92"W × 19"D × 26"H`
- **SKUs:** Product codes
- **Materials:** Wood, leather, velvet, marble, etc.

### Confidence Levels

| Level | Criteria | Auto-Action |
|-------|----------|-------------|
| HIGH | Has vendor AND price from text | Can auto-confirm |
| MEDIUM | Has vendor OR price OR dimensions | Needs review |
| LOW | Visual only, no text specs | Can auto-dismiss |

### Output

**Creates (NOT ProductTag!):**
```typescript
// Room record
Room {
  id, projectId, type, name
}

// Selection record (different from ProductTag!)
Selection {
  projectId,
  roomId,
  productName: string,
  vendorName: string,
  productUrl?: string,
  unitPrice?: number,       // In dollars
  dimensions?: { width, depth, height },
  tags: string[],           // Category
  source: 'import',
  uiMeta: {
    specConfidence: 'high' | 'partial' | 'visual_only'
  }
}
```

### Key Files

- `src/components/import/PresentationImportModal.tsx` - Main import UI
- `src/components/import/VerificationQueue.tsx` - Tag review interface
- `src/components/import/PendingTagCard.tsx` - Individual tag card
- `src/app/api/import/session/route.ts` - Session management
- `src/app/api/import/[sessionId]/analyze/route.ts` - AI analysis
- `src/app/api/import/[sessionId]/finalize/route.ts` - Finalization

---

## Flow 4: Editorial Generation

### Entry Point

**Location:** `src/app/project/[id]/MediaSection.tsx:343-595`

```
Project page → "Continue to Interview" button
  → FinishScheduleOptionsModal (options/file upload)
    → InterviewModal opens
```

### Input Requirements

| Requirement | Required? | Used For |
|-------------|-----------|----------|
| Project ID | Yes | Data fetching/storage |
| Images with URLs | Yes | Room-based chapters, contextual questions |
| ProductTags | No (beneficial) | Materials ledger, product attribution |
| Project metadata | Yes | Title, description in editorial |

### Interview Process

**Phases:**
1. **pick** - User selects which questions to answer
2. **question** - Sequential answering (or batch mode)
3. **followup** - AI-generated probing questions
4. **complete** - Ready to generate

**Question Types:**
```typescript
// Base questions (from questionBank.ts)
- Design philosophy
- Client collaboration
- Material choices
- Spatial decisions

// Contextual questions (AI-generated per project)
Based on image classifications:
- Color questions: "What drew you to [detected color]?"
- Material questions: "Tell us about the [detected material]"
- Style questions: "The space feels very [style]..."
- Mood questions: "There's a [mood] atmosphere..."
```

### Generation API

**Endpoint:** `POST /api/posting/project/[projectId]/interview/generate`

**Input:**
```typescript
{
  answers: InterviewAnswer[],      // User's responses
  followups: FollowUp[],           // Follow-up responses
  images: ProjectImage[],          // With room associations
  tags: ProductTag[],              // For materials ledger
  roomOrganization: RoomGroup[]    // Images grouped by room
}
```

**LLM Call (Claude):**
```typescript
Model: claude-sonnet-4-20250514
Prompt: Write like Architectural Digest
  - Organize by rooms/spaces
  - Explain design decisions
  - Weave products into narrative
  - 600-900 words total
```

### Output

**ProjectPost.expandedBlocks:**
```typescript
{
  lead: {
    kicker: string,     // One-line essence
    deck: string        // 2-3 sentence intro
  },
  galleryChapters: [{
    title?: string,     // Room name
    imageIds: string[],
    body: string[],     // 2-4 paragraphs
    pullQuote?: string
  }],
  pullQuotes: string[],
  materialsLedger: {
    items: [{
      name: string,
      finish?: string,
      productId?: string
    }]
  },
  credits: Credit[],
  mode: 'recomposition'
}
```

### Storage

| Field | Location |
|-------|----------|
| Interview answers | `ProjectPost.provenance.interview.payload` |
| Editorial blocks | `ProjectPost.expandedBlocks` |
| Hero image | `ProjectPost.heroAssetId` |
| Excerpt | `ProjectPost.excerpt` |

### Key Files

- `src/components/posting/interview/InterviewModal.tsx` - Main UI
- `src/components/posting/interview/QuestionCard.tsx` - Question display
- `src/app/api/posting/project/[projectId]/interview/generate/route.ts` - Generation
- `src/lib/editorial/generateInterviewQuestions.ts` - Contextual questions

---

## Flow Connections & Gaps

### Connection Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DESIGNER DASHBOARD                            │
│  ┌─────────────────┐              ┌─────────────────────────────┐   │
│  │  "Add Project"  │              │  "Import Presentation"      │   │
│  └────────┬────────┘              └──────────────┬──────────────┘   │
└───────────│───────────────────────────────────────│──────────────────┘
            │                                       │
            ▼                                       ▼
┌───────────────────────┐              ┌───────────────────────────────┐
│ PROJECT UPLOAD FLOW   │              │ PDF IMPORT FLOW               │
│ ┌───────────────────┐ │              │ ┌───────────────────────────┐ │
│ │ ProjectCreation   │ │              │ │ PresentationImportModal   │ │
│ │ Modal             │ │              │ └─────────────┬─────────────┘ │
│ └─────────┬─────────┘ │              │               │               │
│           │           │              │               ▼               │
│           ▼           │              │ ┌───────────────────────────┐ │
│ ┌───────────────────┐ │              │ │ AI Analysis + Extraction  │ │
│ │ Step 3: MANUAL    │ │              │ └─────────────┬─────────────┘ │
│ │ TAGGING           │ │              │               │               │
│ └─────────┬─────────┘ │              │               ▼               │
│           │           │              │ ┌───────────────────────────┐ │
│           ▼           │              │ │ VerificationQueue         │ │
│  Creates:             │              │ └─────────────┬─────────────┘ │
│  • Project            │              │               │               │
│  • ProjectImage       │              │               ▼               │
│  • ProductTag ◄───────┼──────────┐   │ Creates:                     │
│  • Atelier signals    │          │   │  • Room                      │
└───────────┬───────────┘          │   │  • Selection ◄── DIFFERENT!  │
            │                      │   │  • PendingProductTag         │
            │                      │   │  • NO Atelier signals!       │
            │                      │   └───────────────┬───────────────┘
            │                      │                   │
            │                      │                   │
            │  ╔═══════════════════╧═══════════════╗   │
            │  ║           GAP #1                  ║   │
            │  ║  PDF Import creates Selections    ║   │
            │  ║  Manual tagging creates ProductTag ║   │
            │  ║  These are DIFFERENT entities!    ║   │
            │  ╚═══════════════════════════════════╝   │
            │                                          │
            ▼                                          ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    EDITORIAL GENERATION FLOW                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ InterviewModal                                                   │ │
│  │                                                                  │ │
│  │ READS FROM:                                                      │ │
│  │  • Project.images ✓                                             │ │
│  │  • ProductTag[] (for materials ledger) ✓                        │ │
│  │  • Selection[] ??? (NOT USED - GAP #2)                          │ │
│  │                                                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### Gap Analysis

#### GAP #1: Two Parallel Product Systems

| Aspect | Manual Tagging | PDF Import |
|--------|----------------|------------|
| Entity created | `ProductTag` | `Selection` |
| Position data | Yes (x, y %) | No position on image |
| Linked to Product | Yes (productId) | No (stores name/vendor strings) |
| Room support | No | Yes |
| ML signals | Yes (Atelier) | No |
| Vendor attribution | Via Product.vendorId | Inline vendorName string |

**Impact:** Products imported via PDF cannot be displayed as visual tags on images. Products tagged manually don't belong to rooms.

#### GAP #2: Editorial Ignores Selections

The Editorial generation flow reads `ProductTag[]` for the materials ledger but does NOT read `Selection[]` from PDF imports.

**Code evidence** (`src/app/api/posting/project/[projectId]/interview/generate/route.ts`):
```typescript
// Fetches ProductTags
const images = await prisma.projectImage.findMany({
  where: { projectId },
  include: { tags: { include: { product: true } } }
});

// Does NOT fetch Selections!
```

**Impact:** PDF-imported products are invisible to editorial generation.

#### GAP #3: No Atelier Signals from PDF Import

Manual tagging records designer preferences:
```typescript
await recordAtelierSignal({
  designerId,
  signalType: 'product_tagged',
  productId,
  ...
});
```

PDF import finalization does NOT record signals.

**Impact:** AI recommendations won't learn from PDF import data.

#### GAP #4: Room Field Unused in Manual Flow

ProjectCreationModal Step 2 collects `room` per image, but:
1. It's stored on `ProjectImage.room` (string field)
2. It's never used to create `Room` entities
3. Editorial generation doesn't group by `ProjectImage.room`

PDF Import creates proper `Room` entities that editorial COULD use.

### Missing Connections Table

| From Flow | To Flow | Connection Status |
|-----------|---------|-------------------|
| Project Upload → Manual Tagging | ✅ Integrated (Step 3) |
| Manual Tagging → Editorial | ✅ Connected (ProductTag → materials ledger) |
| PDF Import → Editorial | ⚠️ **DISCONNECTED** (Selections not read) |
| PDF Import → Manual Tagging | ⚠️ **DISCONNECTED** (No ProductTag created) |
| Manual Tagging → Atelier ML | ✅ Connected |
| PDF Import → Atelier ML | ❌ **NOT CONNECTED** |
| Room creation → Editorial | ⚠️ Partial (PDF rooms exist, manual rooms don't) |

---

## Recommendations

### High Priority

1. **Unify Product Data Models**
   - Either convert Selection to use ProductTag on finalize
   - Or extend Editorial to read both ProductTag AND Selection

2. **Add Atelier Signals to PDF Import**
   - Record signals during finalize step
   - Use `source: 'pdf_import'` to differentiate

3. **Make Editorial Read Selections**
   - Add Selection query to interview/generate endpoint
   - Merge Selection products into materials ledger

### Medium Priority

4. **Create Room Entities in Manual Flow**
   - Convert `ProjectImage.room` string to Room entity
   - Group images by room for editorial chapters

5. **Add Visual Tags from PDF Import**
   - PendingProductTag has x,y coordinates
   - Convert to ProductTag on finalize (if projectImageId exists)

### Low Priority

6. **Cross-Flow Dashboard**
   - Show unified product view (Tags + Selections)
   - Indicate source: "Tagged" vs "Imported"

---

## Appendix: Database Schema Reference

### Core Entities

```prisma
model Project {
  id          String         @id
  title       String
  status      String         // draft, published
  designerId  String
  images      ProjectImage[]
  rooms       Room[]
  post        ProjectPost?
}

model ProjectImage {
  id        String       @id
  url       String
  room      String?      // String field, not linked to Room entity!
  projectId String
  tags      ProductTag[]
}

model ProductTag {
  id        String  @id
  x         Float
  y         Float
  productId String
  imageId   String
  product   Product @relation
  image     ProjectImage @relation
}

model Product {
  id        String  @id
  name      String
  brand     String?
  price     Float?
  vendorId  String?
  isPending Boolean
}

model Room {
  id         String      @id
  projectId  String
  type       String
  name       String
  selections Selection[]
}

model Selection {
  id          String  @id
  roomId      String?
  projectId   String
  productName String
  vendorName  String?
  unitPrice   Float?
  source      String  // 'import' | 'manual'
  room        Room?   @relation
}

model ImportSession {
  id          String              @id
  userId      String
  sourceType  String              // PRESENTATION, WEBSITE, BULK_IMAGES
  status      String              // PROCESSING, ANALYZED, READY_FOR_REVIEW, COMPLETED
  pendingTags PendingProductTag[]
}

model PendingProductTag {
  id                String  @id
  importSessionId   String
  tempImageUrl      String
  x                 Float
  y                 Float
  description       String
  category          String
  topSuggestion     Json?
  confidence        String
  extractedVendor   String?
  extractedPrice    Float?
}
```

---

**Report generated by content flow audit**
**Session:** https://claude.ai/code/session_018NsHD7F2gDCzWs9gy4cSV7

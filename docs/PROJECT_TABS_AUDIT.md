# Project Tabs Architecture Audit

> Audit Date: January 21, 2026
> Purpose: Document current implementation before refactoring to BOARDS / FILES / PUBLISH structure

---

## Audit Findings

### 1. Current Tab Structure

**Files:**
- `/src/app/project/[id]/page.tsx` - Main project page (server component)
- `/src/app/project/[id]/ProjectTabs.tsx` - Tab navigation component
- `/src/app/project/[id]/DesignerBoard.tsx` - Boards tab content
- `/src/app/project/[id]/MediaSection.tsx` - Media tab content
- `/src/app/project/[id]/DraftsPanel.tsx` - Story/Drafts tab content
- `/src/app/project/[id]/ProjectHero.tsx` - Header with Overview kebab menu
- `/src/app/project/[id]/OverviewModal.tsx` - Overview modal (moved from tabs)

**Current Implementation:**

| Tab Name | ID | Icon | Badge | Notes |
|----------|-----|------|-------|-------|
| Designer Boards | `boards` | FaThLarge | Product count | Default view, shows rooms with selections |
| Media | `media` | FaImages | No | Image gallery and upload management |
| Story | `drafts` | FaFileAlt | No | Editorial drafts and interview answers |

**Previously Removed Tabs:**
- **Overview** - Moved to kebab menu (three-dot icon) in ProjectHero as a modal
- **Interview** - Now invoked as a modal from the Media tab

**Tab State Management:**
- URL parameter-based: `?view=boards|media|drafts`
- Default: `boards` (when no param, param is deleted for clean URLs)
- Validated against `TabView` TypeScript type
- Navigation via `router.replace()` to update URL without history push

**Tab-Specific Data Fetching:**
- **Boards**: Server-side Prisma query for rooms with selections
- **Media**: Server-side images query + client-side API calls for posts
- **Story/Drafts**: Pure client-side API calls for interview answers and drafts

---

### 2. Designer Boards Implementation

**Files:**
- `/src/app/project/[id]/DesignerBoard.tsx` - Main board container
- `/src/app/project/[id]/DesignerBoardRoom.tsx` - Individual room with mosaic grid
- `/src/app/project/[id]/EditProductDrawer.tsx` - Product editor drawer
- `/src/app/project/[id]/BoardTileMenu.tsx` - Tile context menu
- `/src/app/project/[id]/roomTemplates.ts` - Room type templates with slots
- `/src/app/project/[id]/tileSizing.ts` - Tile sizing algorithm
- `/src/components/designer/QuickAddToRoom.tsx` - Quick add product dialog
- `/src/lib/rooms/defaultRoom.ts` - Default "Unsorted" room creation

**Current Implementation:**
- Rooms displayed in a filter dropdown (can view all or specific room)
- Each room renders as a mosaic grid with responsive columns (1→2→4→6)
- Selections display as tiles with image, product name, vendor, price
- Template-based slot system for room types (KITCHEN, BATH, LIVING, etc.)
- Tile sizing algorithm based on dimensions, product type, or manual override

**Room Creation:**
1. **Automatic**: Default "Unsorted" room created for all projects
2. **Manual**: Inline room creation via API
3. **Inferred**: From PDF imports and image analysis (for PAST projects)

**Empty State Handling:**
- Project-level: `ProjectEmptyState.tsx` with drag-drop upload zone
- Room-level: Template placeholders with "Shop" and "Upload" CTAs
- Placeholders show slot roles (e.g., "Countertop", "Sofa") with shop links

**Room Templates (7 types):**
```
KITCHEN: countertop, backsplash, sink, faucet, appliances, lighting, island
BATH: vanity, mirror, toilet, shower, tub, tile, lighting
LIVING: sofa, coffee table, rug, art, lighting, accent chair
BEDROOM: bed, nightstand, dresser, rug, art, lighting
DINING: dining table, dining chairs, chandelier, sideboard, rug
OFFICE: desk, desk chair, bookshelf, lighting, rug
ENTRY: console, mirror, lighting, rug, bench
```

---

### 3. Media/Upload Handling

**Files:**
- `/src/app/project/[id]/MediaSection.tsx` - Media tab UI
- `/src/components/ProjectCreationModal.tsx` - Multi-step upload workflow
- `/src/components/import/PresentationImportModal.tsx` - PDF/PPTX processing
- `/src/components/VideoUploader.tsx` - Video upload component
- `/src/lib/uploadToSupabase.ts` - Core upload utility
- `/src/lib/storage.ts` - Storage operations with EXIF stripping

**Upload UI Location and Flow:**
- **Media Tab**: Upload button + "Import Presentation" button + drag-drop zone
- **Project Creation Modal**: 3-step workflow (Details → Images → Tagging)
- **Presentation Import**: PDF/PPTX → Extract images → AI analysis → Room creation

**Supported File Types:**
| Type | Max Size | Use Case |
|------|----------|----------|
| Images (PNG, JPG, WEBP) | 10MB | Project media |
| PDF | 50MB | Presentation import, spec extraction |
| PPTX | 50MB | Presentation import |
| Audio (MP3, WAV) | Unlimited | Interview recordings |
| Video (MP4, WebM) | Unlimited | Video uploads |
| CSV | Unlimited | Event invites |

**Storage Structure (Supabase):**
```
Primary bucket: event-images (or FOLIO_STORAGE_BUCKET)
Fallbacks: events, images, public

Paths:
- {projectId}/{roomId}/generated/{id}.{ext}  - AI-generated images
- {projectId}/cutouts/{productId}/{id}.{ext} - 2D product cutouts
- imports/{sessionId}/{id}.{ext}             - Extracted presentation images
- interviews/{interviewId}/recording.{ext}   - Audio recordings
```

**File Type Classification:**
- Automatic detection via MIME type
- PDF vs PPTX via extension
- Product type classification from extraction (specification vs inspiration)

---

### 4. Interview/Content Tab (Story)

**Files:**
- `/src/app/project/[id]/DraftsPanel.tsx` - Story tab interface
- `/src/components/posting/interview/InterviewModal.tsx` - Interview modal (1345 lines)
- `/src/components/posting/interview/AnswerForm.tsx` - Question selection
- `/src/components/posting/interview/FollowUpsForm.tsx` - Follow-up questions
- `/src/lib/editorial/getInterviewQuestions.ts` - Question generation
- `/src/lib/editorial/processInterviewAnswers.ts` - Answer processing
- `/src/lib/editorial/generateContextualQuestions.ts` - AI question generation

**What This Tab Currently Does:**
1. **Question Selection**: Base questions + AI-generated contextual questions
2. **Answer Collection**: Text answers with optional image/product linking
3. **Follow-up Generation**: AI generates follow-up questions based on answers
4. **Editorial Generation**: Synthesizes answers into magazine-style draft

**Question Types:**
- **Base Questions** (5): Project vision, challenges, highlights, aesthetic, emotional impact
- **Contextual Questions**: Generated from image classification (colors, materials, styles)
- **Follow-up Questions**: AI-generated based on user answers

**Data Storage:**
- Interview answers: `ProjectPost.provenance.interview` (main storage)
- Also synced to: `EditorialInterview` and `EditorialInterviewAnswer` tables
- Editorial drafts: `ProjectPost.expandedBlocks` + `EditorialDraft` table

**Mapping Recommendation:**
- **Should map to PUBLISH** (not deprecate)
- Interview is prerequisite for quality editorial content
- Currently missing: formal publish action, version history, `PublishedPost` integration
- Preserved functionality: Question generation, answer collection, follow-ups, editorial synthesis

---

### 5. Data Models

**Room Model:**
```prisma
model Room {
  id            String         @id @default(uuid())
  name          String
  type          String?        // KITCHEN, BATH, LIVING, BEDROOM, DINING, OFFICE, ENTRY
  projectId     String
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  selections    Selection[]
  quotes        Quote[]
  skeletonItems SkeletonItem[]
  project       Project        @relation(...)
}
```

**Selection Model:**
```prisma
model Selection {
  id                String   @id @default(uuid())
  photo             String?
  vendorName        String?
  productName       String?
  colorFinish       String?
  notes             String?
  phaseOfUse        String?
  source            String   @default("upload")
  timestamp         DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  roomId            String?
  projectId         String
  quantity          Int?
  specSheetFileName String?
  specSheetUrl      String?
  unitPrice         Decimal? @db.Decimal(10, 2)
  vendorProductId   String?
  productUrl        String?
  tags              String[] @default([])
  slotKey           String?  // Room template slot (e.g., 'countertop', 'sofa')
  uiMeta            Json?    // displaySize, featured, dimensions
  productTagId      String?  @unique
  // Relations...
}
```

**SkeletonItem Model (EXISTS):**
```prisma
model SkeletonItem {
  id                 String             @id @default(cuid())
  roomId             String
  projectId          String
  searchQuery        String?            // AI-generated search query
  description        String?
  imageData          String?            @db.Text  // Base64 or URL
  imageUrl           String?
  extractedBrand     String?
  extractedPrice     Int?               // In cents
  extractedMaterial  String?
  extractedDimensions Json?
  sourceExtractionId String?            // Link to PdfExtraction
  sourcePage         Int?
  confirmedProductId String?
  resultingSelectionId String?          @unique
  status             SkeletonItemStatus @default(UNCONFIRMED)
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
}
```

**Product Linking:**
- `Selection.productTagId` → `ProductTag` (image tags)
- `SkeletonItem.confirmedProductId` → `Product` (catalog match)
- `SkeletonItem.resultingSelectionId` → `Selection` (after confirmation)

---

### 6. Project Model & Status

**Project Model:**
```prisma
model Project {
  id                   String        @id @default(uuid())
  title                String        @default("")
  description          String?
  category             String?
  status               String        @default("active")
  stage                ProjectStage  @default(concept)
  isPublic             Boolean       @default(false)
  publishedAt          DateTime?
  isAIEnabled          Boolean       @default(false)
  views                Int           @default(0)
  saves                Int           @default(0)
  shares               Int           @default(0)
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt
  designerId           String?
  ownerId              String
  vendorOrgId          String?
  designerOrgId        String?
  isHandoffReady       Boolean       @default(false)
  handoffInvitedAt     DateTime?
  handoffClaimedAt     DateTime?
  projectType          ProjectType   @default(UNSPECIFIED)
  clientType           ClientType    @default(RESIDENTIAL)
  budgetBand           BudgetBand    @default(UNSPECIFIED)
  city                 String?
  regionState          String?
  // Relations: files, images, rooms, selections, post, etc.
}
```

**Status Tracking:**
- `status`: String field ("active" default) - basic lifecycle
- `stage`: `ProjectStage` enum - project phase tracking
- `isPublic` / `publishedAt`: Publication status
- `isHandoffReady` / `handoffInvitedAt` / `handoffClaimedAt`: Handoff workflow

**ProjectFile Model (EXISTS):**
```prisma
model ProjectFile {
  id           String   @id @default(uuid())
  fileName     String
  fileType     String
  fileUrl      String
  uploadedBy   String
  dateUploaded DateTime @default(now())
  projectId    String
  project      Project  @relation(...)
}
```

**Stage Inference:**
- Currently no automatic stage inference logic
- Stages defined in `ProjectStage` enum (concept, design, procurement, installation, complete)

---

### 7. Empty State Patterns

**Files:**
- `/src/components/projects/EmptyStateHero.tsx` - Projects dashboard empty
- `/src/app/project/[id]/ProjectEmptyState.tsx` - Project upload empty
- `/src/app/project/[id]/ProjectEmptyStateDiscovery.tsx` - Individual discovery
- `/src/components/profile/states/EmptyProfileState.tsx` - Profile onboarding
- `/src/components/monograph/EmptyState.tsx` - Public profile empty

**Design Patterns:**
1. **User Type Differentiation**: Different states for Designers vs Individuals
2. **Progressive Disclosure**: States evolve as content is added
3. **Contextual CTAs**: Point to relevant next steps

**Key Empty States:**

| Component | Trigger | Primary CTA |
|-----------|---------|-------------|
| EmptyStateHero | No projects | "Add Your First Project" |
| ProjectEmptyState | No media/rooms | "Import Presentation" |
| ProjectEmptyStateDiscovery | Individual, empty | "Explore Magazine" |
| EmptyProfileState | No projects/brand | "Upload Projects" / "Add Brand Assets" |

**Visual Style:**
- Ridge-card components with neumorphic styling
- Icon clusters with lucide-react / react-icons
- Text hierarchy: folio-h1/h2, folio-body, folio-meta classes
- CSS variables for colors (--text-primary, --accent, --bg-base)
- Drag-and-drop zones with dashed borders

**Copy/Messaging Examples:**
- "Your Studio Starts Here" (Designer projects empty)
- "Drag files here to upload" (Project empty state)
- "Search for ideas, products, or designers" (Discovery mode)

---

### 8. File Processing Pipelines

**Files:**
- `/src/lib/pdf/` - PDF processing pipeline
  - `extractionPipeline.ts` - Main orchestration
  - `extractText.ts` - Text/image extraction
  - `patterns.ts` - Regex patterns for prices, dimensions, brands
  - `clustering.ts` - Spatial text clustering
  - `confidence.ts` - Confidence scoring
  - `aiEnhancement.ts` - Claude-powered completion
- `/src/lib/import-agent/` - Presentation import
  - `extract.ts` - PDF/PPTX image extraction
  - `analyze.ts` - AI image analysis
- `/src/lib/vendor/extractProductData.ts` - URL scraping

**Libraries Used:**
| Library | Purpose |
|---------|---------|
| pdfjs-dist v5.4.530 | PDF rendering and text extraction |
| pdf-parse v2.4.5 | Text extraction |
| pdf-lib v1.17.1 | PDF creation/manipulation |
| pdf-to-png-converter v3.11.0 | PDF to image conversion |
| exceljs v4.4.0 | Excel parsing |
| papaparse v5.5.3 | CSV parsing |
| officeparser v6.0.4 | PPTX/DOC extraction |
| sharp v0.33.0 | Image processing |
| cheerio v1.1.2 | HTML parsing for scraping |
| @anthropic-ai/sdk v0.71.2 | Claude AI |

**API Routes:**
- `POST /api/projects/[id]/extract-pdf` - PDF specification extraction
- `POST /api/import/presentation` - Presentation processing
- `POST /api/import/[sessionId]/analyze` - Image analysis
- `POST /api/import/[sessionId]/finalize` - Room/tag creation
- `POST /api/scrape-product` - URL scraping

**Extracted Data Storage:**
```prisma
model PdfExtraction {
  id        String   @id @default(cuid())
  projectId String
  fileName  String
  result    Json     // ExtractionResult with items by confidence
  status    String   // pending_review, completed, cancelled
  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ImportSession {
  id             String   @id @default(uuid())
  userId         String
  sourceType     String   // PRESENTATION, WEBSITE, BULK_IMAGES
  status         String   // PROCESSING → ANALYZED → READY_FOR_REVIEW → COMPLETED
  projectId      String?
  totalImages    Int?
  totalProducts  Int?
  verifiedTags   Int?
  processingMeta Json?
  pendingTags    PendingProductTag[]
}
```

**Confidence Scoring:**
- **HIGH**: Has productName + brand + price
- **MEDIUM**: 2 of (name/brand/price) OR has SKU/dimensions
- **LOW**: Minimal/no structured data (inspiration)

---

## Migration Considerations

### What Can Be Reused

**Components:**
- `DesignerBoard.tsx` and `DesignerBoardRoom.tsx` → BOARDS tab (core logic intact)
- `roomTemplates.ts` and `tileSizing.ts` → BOARDS tab (slot system)
- `ProjectEmptyState.tsx` → BOARDS empty state (modify copy)
- `PresentationImportModal.tsx` → FILES tab (move from Media)
- `DraftsPanel.tsx` → PUBLISH tab (interview/editorial flow)
- Empty state visual patterns → All tabs

**Data Models:**
- `Room` and `Selection` → BOARDS (no changes needed)
- `SkeletonItem` → FILES (already exists for PDF extraction)
- `ProjectFile` → FILES (already exists, may need enhancement)
- `PdfExtraction` and `ImportSession` → FILES (extraction history)
- `ProjectPost` and `EditorialDraft` → PUBLISH (editorial content)

**Processing Pipelines:**
- PDF extraction pipeline → FILES tab
- Presentation import → FILES tab
- Image analysis → FILES tab (for auto-room detection)
- Interview system → PUBLISH tab

### What Needs to Change

**Tab Structure:**
- Rename `boards` → `boards` (keep)
- Rename `media` → Split into `files` (uploads) and images move to boards
- Rename `drafts` → `publish`

**Media Section Split:**
- Image gallery functionality → BOARDS (images associated with rooms)
- File upload/import → FILES (separate tab)
- "Continue to Interview" → PUBLISH tab

**Empty State Copy:**
- Update messaging to explain new BOARDS/FILES/PUBLISH structure
- BOARDS empty state should explain "what files we want and what designers get"
- FILES empty state should show extraction history and supported formats
- PUBLISH empty state should guide to complete interview first

**URL Parameters:**
- Add `?view=files` as valid value
- Update `TabView` type to include new tab IDs

### New Components Needed

**FILES Tab:**
- `FilesTab.tsx` - Main files tab container
- `FileUploadHistory.tsx` - List of uploaded files with status
- `ExtractionHistoryCard.tsx` - Shows extraction results for each file
- `FileTypeFilterChips.tsx` - Filter by presentations/schedules/documents

**PUBLISH Tab:**
- `PublishTab.tsx` - Main publish tab container
- `PublishReadinessChecklist.tsx` - Shows what's needed before publish
- `PortfolioPreview.tsx` - Preview of publishable content
- `EditorialSubmissionFlow.tsx` - Magazine submission workflow

**Shared:**
- `TabEmptyStateContract.tsx` - Reusable empty state with onboarding copy

### Schema Changes Required

**Minimal Changes Needed:**
```prisma
// Enhance ProjectFile for better file tracking
model ProjectFile {
  // Existing fields...
  fileCategory   String?   // 'presentation', 'schedule', 'document', 'other'
  processedAt    DateTime?
  extractionId   String?   // Link to PdfExtraction if processed
  roomsCreated   Int?      // Count of rooms auto-created
  itemsExtracted Int?      // Count of SkeletonItems created
}

// Optional: Add extraction status enum
enum FileProcessingStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

**No Changes Needed:**
- `Room`, `Selection`, `SkeletonItem` models are sufficient
- `PdfExtraction`, `ImportSession` models handle extraction history
- `ProjectPost`, `EditorialDraft`, `EditorialInterview` handle publish flow

---

## Summary

The current implementation provides a solid foundation for the BOARDS/FILES/PUBLISH restructure:

1. **BOARDS**: `DesignerBoard` + room templates + selections are fully functional
2. **FILES**: PDF extraction, presentation import, and file storage already exist but need UI consolidation
3. **PUBLISH**: Interview system and editorial generation exist but need formal publish workflow

Key architectural decisions:
- Tab state via URL params (can be extended)
- Room template slot system (can support more types)
- SkeletonItem for extracted products (ready for FILES)
- Confidence scoring for extraction quality
- Empty state patterns are consistent and reusable

The main work is reorganizing existing functionality into the new tab structure rather than building from scratch.

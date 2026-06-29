# 12_IMPORT_AGENT_SPEC

## Purpose
This document specifies the Folio Import Agent—an AI-powered system that helps designers import projects from existing presentations and websites, automatically detect products, search for attribution, and queue tags for verification.

The agent dramatically reduces friction in project creation while capturing rich data for Atelier.

---

## Strategic Value

### For Designers
- **10x faster project setup**: Upload a deck, get a tagged project
- **No manual data entry**: Agent does the research, designer just confirms
- **Completeness scoring boost**: Verified tags improve project visibility
- **Existing work → Folio presence**: Portfolios become Folio-ready overnight

### For Folio's Data Moat
- **Product relationships captured pre-vendor**: Learn what products designers use before vendors join
- **Presentation context**: How designers organize and present work reveals decision patterns
- **Cross-project patterns**: Same products appearing across projects strengthen the graph
- **Verification signals**: Designer confirmations are high-confidence training data

### For Vendors
- **Discovery before signup**: "Your products were tagged in 47 projects"
- **Real usage context**: Products tagged in actual designer presentations, not just catalog shots
- **Relationship mapping**: Which designers consistently use which products

---

## Architecture Overview

### The Claude-Powered Import Agent

The agent uses **Anthropic's Claude API** (your existing keys) as the intelligence layer. This is strategic:
- Same API infrastructure you're already using for editorial generation
- Claude's vision capabilities for image analysis
- Claude's web search tool for product attribution
- Consistent AI behavior across Folio

```
┌─────────────────────────────────────────────────────────────────┐
│                     FOLIO IMPORT AGENT                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  INGEST      │    │  ANALYZE     │    │  ATTRIBUTE   │      │
│  │  ────────    │ →  │  ────────    │ →  │  ────────    │      │
│  │  • PDF/PPTX  │    │  • Extract   │    │  • Web search│      │
│  │  • Website   │    │    images    │    │  • Catalog   │      │
│  │  • Images    │    │  • Detect    │    │    match     │      │
│  │              │    │    products  │    │  • Confidence│      │
│  │              │    │  • Infer     │    │    scoring   │      │
│  │              │    │    rooms     │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
│                              ↓                                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   VERIFICATION QUEUE                      │  │
│  │  ─────────────────────────────────────────────────────── │  │
│  │  Designer reviews: Confirm | Correct | Dismiss            │  │
│  │  Batch actions for efficiency                             │  │
│  │  Progress → Completeness Score                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│                              ↓                                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    FOLIO PROJECT                          │  │
│  │  ─────────────────────────────────────────────────────── │  │
│  │  • ProjectImages with ProductTags                         │  │
│  │  • Rooms auto-organized                                   │  │
│  │  • Ready for editorial generation                         │  │
│  │  • Atelier signals captured                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Import Sources

### 1. Presentation Import (Primary)

**Supported Formats:**
- PDF (exported from Canva, InDesign, Keynote, PowerPoint)
- PPTX (direct PowerPoint files)
- Google Slides (via export or API)

**What the Agent Extracts:**
- Individual slide images
- Text content (project names, room labels, product callouts)
- Slide structure (sections, headers)
- Any embedded links

**Processing Flow:**
```
1. Designer uploads presentation
2. Agent converts to images (one per slide/page)
3. Claude analyzes each image:
   - Identifies room type (living room, kitchen, bathroom, etc.)
   - Detects visible products (furniture, lighting, materials)
   - Extracts any text callouts or labels
4. Agent groups images by inferred room
5. For each detected product → web search for attribution
6. Results queued for verification
```

### 2. Website Import (Secondary)

**Input:**
- Designer provides their portfolio URL
- Agent crawls project pages

**What the Agent Extracts:**
- Project images
- Project titles and descriptions
- Any tagged products or vendor credits
- Room categorizations if present

**Processing Flow:**
```
1. Designer provides portfolio URL
2. Agent crawls sitemap or project listing page
3. For each project page:
   - Downloads high-res images
   - Extracts metadata (title, description, credits)
   - Parses any existing product/vendor mentions
4. Creates draft projects in Folio
5. Runs product detection on images
6. Results queued for verification
```

### 3. Bulk Image Import (Tertiary)

**Input:**
- ZIP file or folder of project images
- Optional: CSV with room assignments

**Processing Flow:**
```
1. Designer uploads images
2. If no CSV provided:
   - Claude groups images by visual similarity
   - Infers room types from image content
3. Runs product detection
4. Results queued for verification
```

### 4. Finish Schedule Import (Targeted Locate)

**Input:** one structured document. Typically an Excel finish schedule, also a PDF table export. Products are already named and grouped by room.

This source differs from the other three in one way that matters. The other three do open detection: find whatever products appear in an image. The finish schedule already names the products for each room, so the work is targeted localization, not search. Known target, locate on the photo.

**Processing flow:**
```
1. Designer drops one finish book / Excel at the project level
2. Parse stage: extract rows {roomLabel, productDescription, vendor?, sku?}
3. Match roomLabel to the project's existing Rooms
4. Locate stage: per room, one vision call over that room's ProjectImages
   - Input:  the room's photo(s) + the room's product rows
   - Output: per product -> {projectImageId, x, y, confidence, found}
5. Queue results as PendingProductTag rows
   - found      -> x/y set, renders with a pin, awaits one confirm
   - not found  -> x/y null, renders in the per-photo list as "place manually"
6. Results surface in the inline per-photo lists (05_WORKFLOWS), not a
   standalone verification queue
```

A room may hold several photos. The locate call ranges over the whole room photo set and returns, per product, the single best photo and coordinate. Products named for a room with no usable photo queue unlocated.

> **Audit note (`AUDIT_autotag_vision_findings.md`):** the locate stage reuses the existing
> targeted vision capability `estimateProductCoordinates(imageUrl, productNames)` +
> `matchProductsToLocations(...)` in `src/lib/tagging/estimateProductCoordinates.ts` (already
> called in targeted mode by `auto-tag/route.ts`). It is a new *route*, not a new vision call.
> A room's photos are enumerated via the structured `Room.projectImages` relation
> (`ProjectImage.roomId` / `@relation("RoomProjectImages")`). The current
> `/api/import/finish-schedule` route is a stub (upload + mark COMPLETE); the parse and
> locate stages are the net-new build, with `exceljs` / `papaparse` / `pdf-parse` already
> installed.

---

## The Claude Agent Implementation

### API Configuration

```typescript
// lib/import-agent/claude-client.ts

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // Your existing key
});

export const IMPORT_AGENT_CONFIG = {
  model: 'claude-sonnet-4-20250514', // Best balance of speed/quality for this task
  maxTokens: 4096,
  // Enable vision for image analysis
  // Enable web search for product attribution
};
```

### Agent System Prompt

```typescript
const IMPORT_AGENT_SYSTEM = `You are the Folio Import Agent, helping interior designers
import their project presentations into the Folio platform.

Your capabilities:
1. ANALYZE images to identify:
   - Room type (living room, bedroom, kitchen, bathroom, dining, office, outdoor, etc.)
   - Visible products (furniture, lighting, rugs, art, fixtures, materials)
   - Design style indicators
   - Notable materials or finishes

2. DETECT products in images:
   - Describe each product clearly (type, color, material, style)
   - Estimate position in image (for tag coordinates)
   - Note any visible brand indicators

3. SEARCH the web to find product attribution:
   - Use product descriptions to search
   - Look for exact matches in vendor catalogs
   - Return product URL, vendor name, product name, and confidence level

4. ORGANIZE content:
   - Group images by room when structure isn't provided
   - Infer project sections from presentation structure
   - Maintain designer's original organization when clear

Your output should be structured JSON that Folio can process directly.

IMPORTANT: You suggest, never assert. All attributions are queued for designer verification.
Confidence levels should be honest - if uncertain, say so.`;
```

### Core Agent Functions

```typescript
// lib/import-agent/analyze.ts

interface DetectedProduct {
  description: string;           // "Navy velvet sofa with brass legs"
  category: ProductCategory;     // FURNITURE, LIGHTING, RUG, etc.
  position: { x: number; y: number }; // Normalized 0-1 coordinates
  confidence: 'high' | 'medium' | 'low';
  searchQuery: string;           // Optimized query for web search
}

interface RoomAnalysis {
  roomType: RoomType;
  products: DetectedProduct[];
  styleIndicators: string[];     // "mid-century modern", "coastal", etc.
  dominantColors: string[];
  materials: string[];
}

export async function analyzeImage(
  imageBase64: string,
  context?: { roomHint?: string; projectStyle?: string }
): Promise<RoomAnalysis> {
  const response = await anthropic.messages.create({
    model: IMPORT_AGENT_CONFIG.model,
    max_tokens: IMPORT_AGENT_CONFIG.maxTokens,
    system: IMPORT_AGENT_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Analyze this interior design image.
${context?.roomHint ? `Room hint: ${context.roomHint}` : ''}
${context?.projectStyle ? `Project style: ${context.projectStyle}` : ''}

Return JSON with:
{
  "roomType": "living_room" | "bedroom" | "kitchen" | etc,
  "products": [
    {
      "description": "detailed description for search",
      "category": "FURNITURE" | "LIGHTING" | "RUG" | etc,
      "position": { "x": 0.0-1.0, "y": 0.0-1.0 },
      "confidence": "high" | "medium" | "low",
      "searchQuery": "optimized search terms"
    }
  ],
  "styleIndicators": ["style1", "style2"],
  "dominantColors": ["color1", "color2"],
  "materials": ["material1", "material2"]
}`,
          },
        ],
      },
    ],
  });

  return parseAnalysisResponse(response);
}
```

### Product Attribution via Web Search

```typescript
// lib/import-agent/attribute.ts

interface ProductAttribution {
  productUrl: string;
  vendorName: string;
  productName: string;
  price?: string;
  confidence: 'high' | 'medium' | 'low';
  matchReason: string;  // Why we think this is a match
}

export async function searchProductAttribution(
  product: DetectedProduct,
  designerContext?: { preferredVendors?: string[] }
): Promise<ProductAttribution[]> {
  const response = await anthropic.messages.create({
    model: IMPORT_AGENT_CONFIG.model,
    max_tokens: IMPORT_AGENT_CONFIG.maxTokens,
    system: IMPORT_AGENT_SYSTEM,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Find the product source for this interior design item:

Description: ${product.description}
Category: ${product.category}
Search query: ${product.searchQuery}
${designerContext?.preferredVendors ? `Preferred vendors: ${designerContext.preferredVendors.join(', ')}` : ''}

Search for this product and return up to 3 potential matches.
Prioritize:
1. Exact product matches from reputable design vendors
2. Similar products from known brands
3. Generic category matches

Return JSON:
{
  "attributions": [
    {
      "productUrl": "full URL",
      "vendorName": "vendor/brand name",
      "productName": "product name",
      "price": "if found",
      "confidence": "high" | "medium" | "low",
      "matchReason": "why this matches"
    }
  ]
}`,
      },
    ],
  });

  return parseAttributionResponse(response);
}
```

---

## Data Models

### New Prisma Models

```prisma
// Addition to schema.prisma

model ImportSession {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  sourceType    ImportSourceType  // PRESENTATION, WEBSITE, BULK_IMAGES
  sourceUrl     String?           // Original URL if website import
  fileName      String?           // Original filename if upload

  status        ImportSessionStatus @default(PROCESSING)
  // PROCESSING → ANALYZED → READY_FOR_REVIEW → COMPLETED → FAILED

  projectId     String?           // Created/target project
  project       Project?          @relation(fields: [projectId], references: [id])

  // Metrics
  totalImages   Int      @default(0)
  totalProducts Int      @default(0)
  verifiedTags  Int      @default(0)

  // Processing metadata
  processingMeta Json?   // Agent state, partial results
  errorMessage   String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  completedAt   DateTime?

  pendingTags   PendingProductTag[]

  @@map("import_sessions")
}

model PendingProductTag {
  id              String   @id @default(uuid())
  importSessionId String
  importSession   ImportSession @relation(fields: [importSessionId], references: [id], onDelete: Cascade)

  // Image reference
  projectImageId  String?
  projectImage    ProjectImage? @relation(fields: [projectImageId], references: [id])
  tempImageUrl    String?      // Before project image is created

  // Position on image
  x               Float
  y               Float

  // Agent's detection
  description     String       // "Navy velvet sofa with brass legs"
  category        String       // FURNITURE, LIGHTING, etc.
  searchQuery     String       // Query used for attribution

  // Agent's attribution suggestions
  suggestions     Json         // Array of ProductAttribution objects
  topSuggestion   Json?        // Best match for quick display

  // Confidence
  detectionConfidence   String  // high, medium, low
  attributionConfidence String? // high, medium, low (after search)

  // Verification status
  status          PendingTagStatus @default(UNREVIEWED)
  // UNREVIEWED → CONFIRMED → CORRECTED → DISMISSED

  // If confirmed/corrected, link to actual product
  confirmedProductId String?
  confirmedProduct   Product? @relation(fields: [confirmedProductId], references: [id])

  // If corrected, what did designer change?
  correctionNote     String?

  // Resulting ProductTag (after confirmation)
  resultingTagId     String?   @unique
  resultingTag       ProductTag? @relation(fields: [resultingTagId], references: [id])

  createdAt       DateTime @default(now())
  reviewedAt      DateTime?

  @@index([importSessionId, status])
  @@map("pending_product_tags")
}

enum ImportSourceType {
  PRESENTATION
  WEBSITE
  BULK_IMAGES
}

enum ImportSessionStatus {
  PROCESSING
  ANALYZED
  READY_FOR_REVIEW
  COMPLETED
  FAILED
}

enum PendingTagStatus {
  UNREVIEWED
  CONFIRMED
  CORRECTED
  DISMISSED
}
```

### Finish Schedule additions (ADD-only, with one widening)

Confirmed against `AUDIT_autotag_vision_findings.md`, then migrate:

- `ImportSourceType`: add `FINISH_SCHEDULE`. (Today the finish-schedule route mislabels its
  session `PRESENTATION` because the value does not exist yet.)
- `PendingProductTag`:
  - `x` and `y` become **nullable** to support the unlocated fallback. This is the one
    relaxation, not a pure ADD. Audit confirms both are currently required (`x Float`,
    `y Float`). Widening a required column to nullable is non-destructive.
  - Add `isLocated Boolean @default(true)`. Unlocated rows set `false` and render in the
    per-photo list with a place-manually prompt.

No other model changes are required. Confirm-and-dismiss reuse the existing pending-tag
verify path (`/api/import/pending-tag/[tagId]/verify`).

---

## API Routes

### Import Session Management

```typescript
// app/api/import/session/route.ts

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { sourceType, projectId } = await req.json();

  const importSession = await prisma.importSession.create({
    data: {
      userId: session.user.id,
      sourceType,
      projectId,
      status: 'PROCESSING',
    },
  });

  return json({ sessionId: importSession.id });
}
```

### Presentation Upload & Processing

```typescript
// app/api/import/presentation/route.ts

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const sessionId = formData.get('sessionId') as string;
  const projectId = formData.get('projectId') as string | null;

  // 1. Upload file to Supabase Storage
  const fileUrl = await uploadToStorage(file, 'imports');

  // 2. Update session
  await prisma.importSession.update({
    where: { id: sessionId },
    data: { fileName: file.name },
  });

  // 3. Queue processing job
  await queueImportJob({
    sessionId,
    fileUrl,
    projectId,
    userId: session.user.id,
  });

  return json({ status: 'processing', sessionId });
}
```

### Processing Job (Background)

```typescript
// lib/import-agent/process-presentation.ts

export async function processPresentationImport(job: ImportJob) {
  const { sessionId, fileUrl, projectId, userId } = job;

  try {
    // 1. Convert PDF/PPTX to images
    const images = await extractPresentationImages(fileUrl);

    await prisma.importSession.update({
      where: { id: sessionId },
      data: { totalImages: images.length },
    });

    // 2. Get existing project context if linking to existing project
    let projectContext = null;
    if (projectId) {
      projectContext = await getProjectContext(projectId);
    }

    // 3. Analyze each image with Claude
    const analyses: RoomAnalysis[] = [];
    for (const image of images) {
      const analysis = await analyzeImage(image.base64, {
        roomHint: projectContext?.rooms?.[image.index]?.name,
        projectStyle: projectContext?.style,
      });
      analyses.push(analysis);
    }

    // 4. For each detected product, search for attribution
    const pendingTags: PendingProductTag[] = [];
    for (let i = 0; i < analyses.length; i++) {
      const analysis = analyses[i];
      for (const product of analysis.products) {
        const attributions = await searchProductAttribution(product, {
          preferredVendors: await getDesignerPreferredVendors(userId),
        });

        pendingTags.push({
          importSessionId: sessionId,
          tempImageUrl: images[i].url,
          x: product.position.x,
          y: product.position.y,
          description: product.description,
          category: product.category,
          searchQuery: product.searchQuery,
          suggestions: attributions,
          topSuggestion: attributions[0] || null,
          detectionConfidence: product.confidence,
          attributionConfidence: attributions[0]?.confidence || null,
          status: 'UNREVIEWED',
        });
      }
    }

    // 5. Batch insert pending tags
    await prisma.pendingProductTag.createMany({
      data: pendingTags,
    });

    // 6. Update session status
    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: 'READY_FOR_REVIEW',
        totalProducts: pendingTags.length,
      },
    });

    // 7. Notify designer
    await notifyDesigner(userId, {
      type: 'IMPORT_READY',
      sessionId,
      totalProducts: pendingTags.length,
    });

  } catch (error) {
    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
      },
    });
  }
}
```

### Verification Endpoints

```typescript
// app/api/import/[sessionId]/pending-tags/route.ts

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'UNREVIEWED';
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  const pendingTags = await prisma.pendingProductTag.findMany({
    where: {
      importSessionId: params.sessionId,
      importSession: { userId: session.user.id },
      status: status as PendingTagStatus,
    },
    include: {
      projectImage: true,
      confirmedProduct: true,
    },
    take: limit,
    skip: offset,
    orderBy: [
      { attributionConfidence: 'desc' }, // High confidence first
      { createdAt: 'asc' },
    ],
  });

  const total = await prisma.pendingProductTag.count({
    where: {
      importSessionId: params.sessionId,
      status: status as PendingTagStatus,
    },
  });

  return json({ pendingTags, total, limit, offset });
}
```

### Tag Verification Actions

```typescript
// app/api/import/pending-tag/[tagId]/verify/route.ts

export async function POST(
  req: Request,
  { params }: { params: { tagId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { action, productId, correctionNote } = await req.json();
  // action: 'confirm' | 'correct' | 'dismiss'

  const pendingTag = await prisma.pendingProductTag.findUnique({
    where: { id: params.tagId },
    include: { importSession: true },
  });

  if (!pendingTag || pendingTag.importSession.userId !== session.user.id) {
    return notFound();
  }

  if (action === 'dismiss') {
    await prisma.pendingProductTag.update({
      where: { id: params.tagId },
      data: {
        status: 'DISMISSED',
        reviewedAt: new Date(),
      },
    });
    return json({ status: 'dismissed' });
  }

  // For confirm or correct, we need a product
  let product: Product;

  if (action === 'confirm' && pendingTag.topSuggestion) {
    // Use the suggested product - create if doesn't exist
    product = await getOrCreateProduct(pendingTag.topSuggestion);
  } else if (action === 'correct' && productId) {
    // Designer selected a different product
    product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return badRequest('Product not found');
  } else {
    return badRequest('Invalid verification action');
  }

  // Create the actual ProductTag
  const productTag = await prisma.productTag.create({
    data: {
      projectImageId: pendingTag.projectImageId,
      productId: product.id,
      x: pendingTag.x,
      y: pendingTag.y,
      createdById: session.user.id,
      source: 'IMPORT_AGENT',
    },
  });

  // Update pending tag
  await prisma.pendingProductTag.update({
    where: { id: params.tagId },
    data: {
      status: action === 'confirm' ? 'CONFIRMED' : 'CORRECTED',
      confirmedProductId: product.id,
      correctionNote: correctionNote || null,
      resultingTagId: productTag.id,
      reviewedAt: new Date(),
    },
  });

  // Update session metrics
  await prisma.importSession.update({
    where: { id: pendingTag.importSessionId },
    data: {
      verifiedTags: { increment: 1 },
    },
  });

  // Capture Atelier signal
  await captureAtelierSignal({
    userId: session.user.id,
    action: action === 'confirm' ? 'IMPORT_TAG_CONFIRMED' : 'IMPORT_TAG_CORRECTED',
    productId: product.id,
    meta: {
      originalSuggestion: pendingTag.topSuggestion,
      confidence: pendingTag.attributionConfidence,
      corrected: action === 'correct',
    },
  });

  return json({
    status: 'verified',
    productTag,
    completenessBoost: calculateCompletenessBoost(pendingTag.importSession),
  });
}
```

### Batch Verification

```typescript
// app/api/import/[sessionId]/batch-verify/route.ts

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return unauthorized();

  const { action, tagIds, minConfidence } = await req.json();
  // action: 'confirm_all_high_confidence' | 'dismiss_all_low_confidence' | 'confirm_selected'

  let tagsToProcess: PendingProductTag[];

  if (action === 'confirm_all_high_confidence') {
    tagsToProcess = await prisma.pendingProductTag.findMany({
      where: {
        importSessionId: params.sessionId,
        status: 'UNREVIEWED',
        attributionConfidence: 'high',
      },
    });
  } else if (action === 'dismiss_all_low_confidence') {
    tagsToProcess = await prisma.pendingProductTag.findMany({
      where: {
        importSessionId: params.sessionId,
        status: 'UNREVIEWED',
        attributionConfidence: 'low',
      },
    });
  } else if (action === 'confirm_selected') {
    tagsToProcess = await prisma.pendingProductTag.findMany({
      where: {
        id: { in: tagIds },
        importSessionId: params.sessionId,
        status: 'UNREVIEWED',
      },
    });
  }

  // Process in transaction
  const results = await prisma.$transaction(async (tx) => {
    const processed = [];
    for (const tag of tagsToProcess) {
      if (action.startsWith('dismiss')) {
        await tx.pendingProductTag.update({
          where: { id: tag.id },
          data: { status: 'DISMISSED', reviewedAt: new Date() },
        });
        processed.push({ tagId: tag.id, status: 'dismissed' });
      } else {
        // Confirm with top suggestion
        if (tag.topSuggestion) {
          const product = await getOrCreateProduct(tag.topSuggestion, tx);
          const productTag = await tx.productTag.create({
            data: {
              projectImageId: tag.projectImageId,
              productId: product.id,
              x: tag.x,
              y: tag.y,
              createdById: session.user.id,
              source: 'IMPORT_AGENT',
            },
          });
          await tx.pendingProductTag.update({
            where: { id: tag.id },
            data: {
              status: 'CONFIRMED',
              confirmedProductId: product.id,
              resultingTagId: productTag.id,
              reviewedAt: new Date(),
            },
          });
          processed.push({ tagId: tag.id, status: 'confirmed', productTag });
        }
      }
    }
    return processed;
  });

  // Update session metrics
  const confirmedCount = results.filter(r => r.status === 'confirmed').length;
  await prisma.importSession.update({
    where: { id: params.sessionId },
    data: {
      verifiedTags: { increment: confirmedCount },
    },
  });

  return json({
    processed: results.length,
    confirmed: confirmedCount,
    dismissed: results.length - confirmedCount,
  });
}
```

### Finish Schedule: Targeted Locate

```
POST /api/import/locate-from-schedule

Body:
  sessionId        string   (FINISH_SCHEDULE ImportSession)
  roomId           string
  projectImageIds  string[] (the room's photos)
  products         { tempId, description, vendor?, sku? }[]

Returns:
  located:    { tempId, projectImageId, x, y, confidence }[]
  unlocated:  { tempId, reason }[]
```

This route is the one net-new vision *surface* in the finish-schedule flow. Per the audit
(`AUDIT_autotag_vision_findings.md`), the existing analysis call **does** support a targeted
mode: `estimateProductCoordinates(imageUrl, productNames)` matches detections against a
supplied product list and returns coordinates only for matches. So this route **wraps the
existing targeted call** (over each `projectImageId`, with the room's product descriptions as
`productNames`) rather than introducing a new prompt. `located` rows set `x/y` and
`isLocated = true`; `unlocated` rows set `x/y = null`, `isLocated = false`, and surface in the
per-photo list with a place-manually prompt.

---

## UI Components

### Import Wizard

```tsx
// components/import/ImportWizard.tsx

export function ImportWizard({ projectId }: { projectId?: string }) {
  const [step, setStep] = useState<'source' | 'upload' | 'processing' | 'review'>('source');
  const [sourceType, setSourceType] = useState<ImportSourceType | null>(null);
  const [session, setSession] = useState<ImportSession | null>(null);

  return (
    <GlassModal open onClose={onClose}>
      <div className="p-8 max-w-3xl mx-auto">
        {/* Progress indicator */}
        <ImportProgress step={step} />

        {step === 'source' && (
          <SourceSelection
            onSelect={(type) => {
              setSourceType(type);
              setStep('upload');
            }}
          />
        )}

        {step === 'upload' && sourceType && (
          <UploadStep
            sourceType={sourceType}
            projectId={projectId}
            onSessionCreated={(session) => {
              setSession(session);
              setStep('processing');
            }}
          />
        )}

        {step === 'processing' && session && (
          <ProcessingStep
            sessionId={session.id}
            onComplete={() => setStep('review')}
          />
        )}

        {step === 'review' && session && (
          <ReviewStep sessionId={session.id} />
        )}
      </div>
    </GlassModal>
  );
}
```

### Verification Queue

```tsx
// components/import/VerificationQueue.tsx

export function VerificationQueue({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery(
    ['pending-tags', sessionId],
    () => fetchPendingTags(sessionId)
  );

  const { mutate: verifyTag } = useMutation(verifyPendingTag, {
    onSuccess: () => queryClient.invalidateQueries(['pending-tags', sessionId]),
  });

  const { mutate: batchVerify } = useMutation(batchVerifyTags);

  if (isLoading) return <VerificationSkeleton />;

  const { pendingTags, total } = data;
  const highConfidence = pendingTags.filter(t => t.attributionConfidence === 'high');
  const reviewed = total - pendingTags.length;

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-serif">Verify Product Tags</h2>
          <p className="text-sm text-stone-500">
            {reviewed} of {total} verified • {pendingTags.length} remaining
          </p>
        </div>

        <CompletenessRing
          value={(reviewed / total) * 100}
          label="Completeness"
        />
      </div>

      {/* Quick actions */}
      {highConfidence.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-emerald-700">
              {highConfidence.length} high-confidence matches found
            </span>
            <Button
              variant="secondary"
              onClick={() => batchVerify({
                sessionId,
                action: 'confirm_all_high_confidence'
              })}
            >
              Confirm All High-Confidence
            </Button>
          </div>
        </div>
      )}

      {/* Tag list */}
      <div className="space-y-4">
        {pendingTags.map((tag) => (
          <PendingTagCard
            key={tag.id}
            tag={tag}
            onConfirm={() => verifyTag({ tagId: tag.id, action: 'confirm' })}
            onCorrect={(productId) => verifyTag({
              tagId: tag.id,
              action: 'correct',
              productId
            })}
            onDismiss={() => verifyTag({ tagId: tag.id, action: 'dismiss' })}
          />
        ))}
      </div>
    </div>
  );
}
```

### Pending Tag Card

```tsx
// components/import/PendingTagCard.tsx

export function PendingTagCard({
  tag,
  onConfirm,
  onCorrect,
  onDismiss
}: PendingTagCardProps) {
  const [showCorrection, setShowCorrection] = useState(false);

  const confidenceColor = {
    high: 'emerald',
    medium: 'amber',
    low: 'red',
  }[tag.attributionConfidence || 'low'];

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="flex">
        {/* Image preview with tag position indicator */}
        <div className="w-48 h-36 relative flex-shrink-0">
          <img
            src={tag.tempImageUrl || tag.projectImage?.url}
            alt=""
            className="w-full h-full object-cover"
          />
          <div
            className="absolute w-4 h-4 bg-white border-2 border-stone-900 rounded-full transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${tag.x * 100}%`,
              top: `${tag.y * 100}%`
            }}
          />
        </div>

        {/* Tag details */}
        <div className="flex-1 p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-medium">{tag.description}</p>
              <p className="text-sm text-stone-500">{tag.category}</p>
            </div>
            <ConfidenceBadge level={tag.attributionConfidence} />
          </div>

          {/* Suggested product */}
          {tag.topSuggestion && (
            <div className="flex items-center gap-3 p-2 bg-stone-50 rounded-lg mt-2">
              <div className="flex-1">
                <p className="text-sm font-medium">{tag.topSuggestion.productName}</p>
                <p className="text-xs text-stone-500">{tag.topSuggestion.vendorName}</p>
              </div>
              <a
                href={tag.topSuggestion.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                View →
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              variant="primary"
              onClick={onConfirm}
              disabled={!tag.topSuggestion}
            >
              ✓ Confirm
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowCorrection(true)}
            >
              ✏ Correct
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
            >
              ✕ Dismiss
            </Button>
          </div>
        </div>
      </div>

      {/* Correction panel */}
      {showCorrection && (
        <CorrectionPanel
          tag={tag}
          onSelect={onCorrect}
          onCancel={() => setShowCorrection(false)}
        />
      )}
    </div>
  );
}
```

---

## Completeness Scoring Integration

### Score Calculation

```typescript
// lib/completeness/calculate.ts

interface CompletenessFactors {
  hasImages: boolean;           // 20%
  hasProductTags: boolean;      // 25%
  tagDensity: number;           // 15% - tags per image
  hasRoomLabels: boolean;       // 10%
  hasDescription: boolean;      // 10%
  hasVendorAttribution: boolean;// 10%
  importVerificationRate: number;// 10% - if from import, % verified
}

export function calculateCompleteness(project: Project): number {
  const factors = getCompletenessFactors(project);

  let score = 0;

  if (factors.hasImages) score += 20;
  if (factors.hasProductTags) score += 25;
  score += factors.tagDensity * 15;  // 0-1 normalized
  if (factors.hasRoomLabels) score += 10;
  if (factors.hasDescription) score += 10;
  if (factors.hasVendorAttribution) score += 10;
  score += factors.importVerificationRate * 10;

  return Math.min(100, Math.round(score));
}

// Display completeness with import context
export function getCompletenessMessage(
  score: number,
  pendingTags: number
): string {
  if (pendingTags > 0) {
    return `Verify ${pendingTags} tags to reach ${score + estimateBoost(pendingTags)}%`;
  }

  if (score < 50) return 'Add more product tags to improve visibility';
  if (score < 75) return 'Good progress! Add room labels for better organization';
  if (score < 90) return 'Almost there! Add a project description';
  return 'Excellent completeness!';
}
```

---

## Atelier Signal Capture

### Import-Specific Signals

```typescript
// lib/atelier/import-signals.ts

export async function captureImportSignals(
  session: ImportSession,
  userId: string
) {
  const confirmedTags = await prisma.pendingProductTag.findMany({
    where: {
      importSessionId: session.id,
      status: { in: ['CONFIRMED', 'CORRECTED'] },
    },
    include: {
      confirmedProduct: true,
    },
  });

  for (const tag of confirmedTags) {
    await prisma.atelierSignal.create({
      data: {
        fingerprintId: await getOrCreateFingerprint(userId),
        action: tag.status === 'CONFIRMED'
          ? 'IMPORT_PRODUCT_CONFIRMED'
          : 'IMPORT_PRODUCT_CORRECTED',
        tags: [tag.category, tag.confirmedProduct?.vendorName].filter(Boolean),
        meta: {
          productId: tag.confirmedProductId,
          importSessionId: session.id,
          originalConfidence: tag.attributionConfidence,
          wasCorrection: tag.status === 'CORRECTED',
          correctionNote: tag.correctionNote,
        },
      },
    });
  }

  // Capture session-level signal
  await prisma.atelierSignal.create({
    data: {
      fingerprintId: await getOrCreateFingerprint(userId),
      action: 'IMPORT_SESSION_COMPLETED',
      meta: {
        sessionId: session.id,
        sourceType: session.sourceType,
        totalProducts: session.totalProducts,
        verifiedTags: session.verifiedTags,
        verificationRate: session.verifiedTags / session.totalProducts,
      },
    },
  });
}
```

### Fingerprint Enrichment from Imports

Imports provide high-signal data for designer fingerprints:

1. **Product Affinity**: Which products designers actually use in presentations
2. **Correction Patterns**: When designers correct agent suggestions, reveals precise preferences
3. **Vendor Relationships**: Consistent vendor usage across projects
4. **Style Consistency**: Agent's style detection + designer confirmation
5. **Presentation Structure**: How designers organize and present work

---

## Website Import (Phase 2)

### Crawler Implementation

```typescript
// lib/import-agent/website-crawler.ts

export async function crawlDesignerPortfolio(
  portfolioUrl: string,
  userId: string
): Promise<CrawlResult> {
  // 1. Fetch main page
  const mainPage = await fetchPage(portfolioUrl);

  // 2. Use Claude to identify project links
  const projectLinks = await identifyProjectLinks(mainPage, portfolioUrl);

  // 3. For each project page
  const projects: CrawledProject[] = [];
  for (const link of projectLinks) {
    const page = await fetchPage(link);
    const project = await extractProjectData(page, link);
    projects.push(project);
  }

  return { projects, totalImages: projects.reduce((sum, p) => sum + p.images.length, 0) };
}

async function identifyProjectLinks(
  page: PageContent,
  baseUrl: string
): Promise<string[]> {
  const response = await anthropic.messages.create({
    model: IMPORT_AGENT_CONFIG.model,
    messages: [
      {
        role: 'user',
        content: `Analyze this interior design portfolio page and identify links to individual project pages.

Page URL: ${baseUrl}
Page content:
${page.text}

Links found on page:
${page.links.join('\n')}

Return JSON:
{
  "projectLinks": ["full URL to project 1", "full URL to project 2", ...]
}

Only include links that appear to be individual project pages, not category pages or external links.`,
      },
    ],
  });

  return parseProjectLinks(response);
}
```

---

## Cost & Performance Considerations

### Claude API Usage

**Per Image Analysis:**
- Vision input: ~300 tokens per image
- Text output: ~500 tokens per analysis
- Cost: ~$0.003 per image (Sonnet pricing)

**Per Product Attribution Search:**
- Web search: ~500 tokens
- Output: ~300 tokens
- Cost: ~$0.002 per search

**Typical Presentation (20 slides, 50 products):**
- Image analysis: 20 × $0.003 = $0.06
- Product search: 50 × $0.002 = $0.10
- **Total: ~$0.16 per presentation**

### Optimization Strategies

1. **Batch Image Analysis**: Send multiple images in one request where possible
2. **Skip Obvious Non-Products**: Text slides, title slides, etc.
3. **Cache Product Searches**: Same product descriptions get cached results
4. **Parallel Processing**: Process images concurrently (with rate limiting)

---

## Deployment Phases

### Phase 1: Presentation Import (Immediate)
- PDF/PPTX upload and processing
- Single-image analysis with product detection
- Web search for product attribution
- Verification queue UI
- Completeness scoring integration

**Finish Schedule Import** ships behind the same import infrastructure. Parse stage and
targeted locate stage are separable. Parse can land first and queue unlocated rows that the
designer places by hand, with the locate stage added after.

### Phase 2: Enhanced Attribution (Month 2)
- Integration with existing Folio product catalog
- Vendor catalog matching (when vendors have uploaded SKUs)
- Designer preferred vendor weighting
- Improved confidence scoring

### Phase 3: Website Import (Month 3)
- Portfolio URL crawler
- Multi-project import
- Existing credit/tag extraction
- Bulk verification workflows

### Phase 4: Intelligence Layer (Month 4+)
- Learning from corrections to improve suggestions
- Designer fingerprint-aware product recommendations
- Cross-project product consistency detection
- Proactive suggestions for untagged content

---

## Success Metrics

### Designer Adoption
- Import sessions initiated per week
- Completion rate (started → verified)
- Time saved vs. manual tagging (measure via UX research)
- NPS for import feature

### Data Quality
- Verification rate (confirmed vs. dismissed)
- Correction rate (how often designers correct agent)
- Confidence calibration (high confidence should have high confirm rate)
- Product catalog growth from imports

### Atelier Impact
- Fingerprint enrichment from import signals
- Product relationship graph expansion
- Vendor pre-discovery (products tagged before vendor joins)

---

## Appendix: Example Agent Conversation

```
USER: [Uploads 15-page PDF presentation for "Marin County Residence"]

AGENT: I'll analyze your presentation for the Marin County Residence project.

Processing 15 pages...
- Found 12 interior images
- Skipped 3 text/title slides

Analyzing images...
✓ Living Room (3 images): 8 products detected
✓ Primary Bedroom (2 images): 5 products detected
✓ Kitchen (3 images): 12 products detected
✓ Bathroom (2 images): 6 products detected
✓ Outdoor Terrace (2 images): 4 products detected

Total: 35 products detected across 5 rooms

Searching for product attribution...
- 18 high-confidence matches found
- 12 medium-confidence matches
- 5 low-confidence (may need manual identification)

Ready for your review. Would you like to:
1. Review all 35 products one-by-one
2. Confirm 18 high-confidence matches, then review the rest
3. Review by room

USER: Confirm all high-confidence, then show me medium

AGENT: ✓ Confirmed 18 products with high-confidence matches:
- RH Modena Sectional (Living Room)
- Apparatus Studio Alto Chandelier (Living Room)
- Clé Tile Zellige in Weathered White (Kitchen)
- [... 15 more ...]

Now reviewing 12 medium-confidence matches:

1. Living Room - Image 2 (position marked)
   Detected: "Brass floor lamp with marble base, mid-century style"
   Suggested: Arteriors Pelham Floor Lamp
   Confidence: Medium (visual match is good, exact model uncertain)

   [Confirm] [Correct] [Dismiss]
```

---

## Summary

The Folio Import Agent transforms project onboarding from manual data entry into intelligent verification. By leveraging Claude's vision and web search capabilities through your existing API keys, designers can import entire presentations and get AI-suggested product tags that just need confirmation.

**Key Benefits:**
1. **For Designers**: 10x faster project setup
2. **For Your Data Moat**: Rich product relationships captured passively
3. **For Vendors**: Discovery before they even join
4. **For Atelier**: High-signal verification data

The system is designed to scale from Phase 1 (presentation import) through to full portfolio migration, while maintaining the core principle from your AI Role document: AI suggests, designer confirms.

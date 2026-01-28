# Image Generation System Audit

**Date:** 2026-01-28
**Scope:** Prompt building, product data flow, image generation, storage, and tagging

---

## 1. PROMPT BUILDING SYSTEM

### 1.1 `buildBasePrompt()` Function

**File:** `/home/user/folio-mvp/src/lib/boards/prompt.ts`
**Lines:** 33-139

**Input Parameters:**
```typescript
{
  projectId: string;
  roomId: string;
}
```

**Output Format:**
```typescript
{
  base: string;           // The complete prompt text
  context: {
    roomId: string;
    roomName: string | null;
    roomType: string | null;
    selections: Array<{
      id: string;
      role: string;        // Normalized slotKey
      line: string;        // Formatted product line
      imageUrl: string;    // Product photo URL
      styleTags: string[]; // Product tags
    }>;
  };
  selectionIds: string[]; // Array of selection IDs
}
```

**Process:**
1. Fetches room data (id, name, type)
2. Fetches all selections for the room ordered by `slotKey` then `createdAt`
3. Formats each selection as a single line (see Current Prompt Template below)
4. Aggregates style tags from all selections (max 8)
5. Constructs structured prompt with sections

### 1.2 `mergeModifiers()` Function

**File:** `/home/user/folio-mvp/src/lib/boards/prompt.ts`
**Lines:** 142-146

**Input:**
- `base: string` - The base prompt from `buildBasePrompt()`
- `modifiers: string` - User-entered art direction text

**Output:**
- If no modifiers: returns `base` unchanged
- If modifiers present: returns `{base}\n\nAdditional art direction: {deduplicated modifiers}`

**Deduplication:** Uses `uniqWords()` to remove duplicate words (case-insensitive)

---

## 2. CURRENT PROMPT TEMPLATE

```
Create a single editorial interior render for the "{roomName}".

Style & mood: {roomType} {roomName} {derivedTags (max 8, from product tags)}.

Must include these exact products with faithful geometry, materials, finishes, colors, and relative scale:
- {slotKey}: {vendorName} {productName}, {colorFinish} ({width}" × {depth}" × {height}")
- ...

References:
Reference image for {slotKey}: {photo URL}
...

Constraints:
- Preserve product proportions and materials; do not substitute lookalikes.
- Keep camera at human eye level; soft natural light; avoid harsh HDR.
- Keep palette cohesive and warm; no extra furniture unless minimal décor is needed.
- Avoid text or logos unless present in references.
- If an attribute is missing, choose the closest plausible option but keep the composition simple.

Output: photorealistic, single image.

Additional art direction: {user modifiers}
```

---

## 3. PRODUCT DATA FLOW

### 3.1 Selection Model (Database Schema)

**File:** `/home/user/folio-mvp/prisma/schema.prisma`
**Lines:** 499-532

| Field | Type | Used in Prompt | Notes |
|-------|------|----------------|-------|
| `id` | String | Yes | For linking |
| `slotKey` | String? | **Yes** | Becomes "role" (e.g., "sofa", "coffee table") |
| `productName` | String? | **Yes** | Product display name |
| `vendorName` | String? | **Yes** | Brand/vendor name |
| `colorFinish` | String? | **Yes** | Material/finish (e.g., "bouclé fabric") |
| `photo` | String? | **Yes** | Reference image URL |
| `tags` | String[] | **Yes** | Style tags aggregated |
| `uiMeta` | Json? | **Partial** | Only `dimensions` sub-field used |
| `notes` | String? | **No** | Designer notes - IGNORED |
| `phaseOfUse` | String? | **No** | Phase tracking - IGNORED |
| `unitPrice` | Decimal? | **No** | Pricing - IGNORED |
| `specSheetUrl` | String? | **No** | Spec sheet - IGNORED |
| `productUrl` | String? | **No** | Product link - IGNORED |
| `quantity` | Int? | **No** | Quantity - IGNORED |

### 3.2 Product Model (Database Schema)

**File:** `/home/user/folio-mvp/prisma/schema.prisma`
**Lines:** 384-414

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | Product name |
| `description` | String? | **Not used in prompts** |
| `price` | Float? | **Not used in prompts** |
| `imageUrl` | String? | Product image |
| `cutoutImageUrl` | String? | Cutout image - **Not used** |
| `category` | String? | Product category |
| `brand` | String? | Brand name |

### 3.3 Room Model (Database Schema)

**File:** `/home/user/folio-mvp/prisma/schema.prisma`
**Lines:** 484-497

| Field | Type | Used in Prompt |
|-------|------|----------------|
| `name` | String | **Yes** - Room name |
| `type` | String? | **Yes** - Room type (KITCHEN, BATH, etc.) |

### 3.4 Data Fetching Query

**Location:** `buildBasePrompt()` in `/src/lib/boards/prompt.ts:52-65`

```typescript
const selections = await prisma.selection.findMany({
  where: { projectId, roomId },
  orderBy: [{ slotKey: "asc" }, { createdAt: "asc" }],
  select: {
    id: true,
    slotKey: true,
    productName: true,
    vendorName: true,
    colorFinish: true,
    photo: true,
    tags: true,
    uiMeta: true,  // Only dimensions extracted
  },
});
```

**What's NOT fetched:**
- `notes` - Designer notes
- `phaseOfUse` - Phase tracking
- `unitPrice` - Pricing info
- `specSheetUrl` - Spec sheets
- `productUrl` - Product links
- `quantity` - Quantities
- Related `Product` record fields (description, cutoutImageUrl, category)

### 3.5 Product Line Formatting

**Location:** `/src/lib/boards/prompt.ts:68-89`

```typescript
// Current format:
`- ${role}: ${vendor} ${name}, ${colorFinish}${dims}`

// Example output:
"- sofa: Article Modern Sofa, bouclé fabric (84" × 32" × 28")"
```

**Dimension formatting:** `/src/lib/boards/prompt.ts:4-11`
```typescript
// Only uses widthIn, depthIn, heightIn from uiMeta.dimensions
// Format: (W" × D" × H") or partial if some missing
```

---

## 4. GENERATE DIALOG COMPONENT

**File:** `/home/user/folio-mvp/src/components/boards/GenerateDialog.tsx`

### 4.1 Props Interface

```typescript
interface GenerateDialogProps {
  projectId: string;
  roomId: string;
  roomName: string;
  selectionsCount: number;
  selectionsPreview: Array<{ name: string; category?: string }>;  // First 6 items
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: (assets: Array<{ id: string; url: string; width: number; height: number }>) => void;
}
```

### 4.2 UI Controls

| Control | State Variable | Default | Validation |
|---------|---------------|---------|------------|
| Style Modifiers | `modifiers` | `""` | None (optional) |
| Number of Images | `count` | `2` | 1-4 |
| Width | `width` | `1024` | 256-2048 |
| Height | `height` | `1024` | 256-2048 |
| Seed | `seed` | `""` | Optional |

### 4.3 Size Presets

```typescript
[
  { label: 'Square (1024×1024)', width: 1024, height: 1024 },
  { label: 'Portrait (1024×1792)', width: 1024, height: 1792 },
  { label: 'Landscape (1792×1024)', width: 1792, height: 1024 }
]
```

### 4.4 API Call

```typescript
POST /api/projects/${projectId}/rooms/${roomId}/gen-image
Body: {
  modifiers: string,  // Trimmed
  n: number,          // 1-4
  width: number,
  height: number,
  seed?: string
}
```

---

## 5. GEN-IMAGE API ENDPOINT

**File:** `/home/user/folio-mvp/src/app/api/projects/[id]/rooms/[roomId]/gen-image/route.ts`

### 5.1 Request Schema

```typescript
{
  modifiers?: string;  // Default: ""
  n?: number;          // Default: 2, Range: 1-4
  width?: number;      // Default: 1024, Range: 256-2048
  height?: number;     // Default: 1024, Range: 256-2048
  seed?: number;       // Optional
}
```

### 5.2 Processing Flow

1. **Authentication:** Verify session exists
2. **Authorization:** `assertProjectAccess()` with project/user/role
3. **Rate Limiting:** Max 10 images/hour per user (configurable via `IMAGE_GEN_MAX_PER_HOUR`)
4. **Input Validation:** Check n (1-4), dimensions (256-2048)
5. **Prompt Building:** `buildBasePrompt()` → `mergeModifiers()`
6. **Image Generation:** `getImageGenProvider().generate()`
7. **Retry Logic:** One retry if no images returned
8. **Storage:** Save to Supabase + create DB records
9. **Analytics:** Log `boards.image.generated` event

### 5.3 Provider Selection

**File:** `/home/user/folio-mvp/src/lib/ai/imageGen.ts:172-205`

```typescript
switch (process.env.IMAGE_GEN_PROVIDER?.toLowerCase()) {
  case 'openai':   → OpenAIProvider (gpt-image-1)
  case 'stability': → StabilityProvider (stable-image-ultra)
  case 'fake':     → FakeProvider (placeholder)
  default:         → OpenAIProvider
}
```

### 5.4 OpenAI Provider Details

**File:** `/home/user/folio-mvp/src/lib/ai/imageGen.ts:85-127`

- Model: `gpt-image-1` (configurable via `OPENAI_IMAGE_MODEL`)
- Supported sizes: 1024×1024, 1536×1024, 1024×1536
- Output: Base64 PNG images

### 5.5 Response Schema

```typescript
{
  ok: true,
  assets: Array<{
    id: string,           // DB record ID or storage path
    url: string,          // Public Supabase URL
    width: number,
    height: number,
    provider: string,     // "openai" | "stability" | "fake"
    metadata: {
      context: {
        roomId: string,
        roomName: string,
        roomType: string,
        selections: Array<...>
      }
    }
  }>
}
```

---

## 6. IMAGE STORAGE & METADATA

### 6.1 Storage Path

**Pattern:** `project-assets/{projectId}/{roomId}/generated/{filename}`

**Function:** `saveBufferToProjectStorage()` in `/src/lib/storage.ts`

### 6.2 Database Model

**Table:** `projectImage` (via Prisma `ProjectImage`)

```typescript
{
  url: string,          // Supabase public URL
  name: string,         // JSON-encoded metadata (see below)
  room: string,         // roomId
  projectId: string
}
```

### 6.3 Metadata Structure (stored in `name` field as JSON)

```typescript
{
  type: 'GENERATED',
  provider: string,           // "openai" | "stability" | "fake"
  promptBase: string,         // Base prompt (without modifiers)
  promptModifiers: string,    // User's art direction
  promptFull: string,         // Complete merged prompt
  selectionIds: string[],     // Linked selection IDs
  contextJSON: {
    roomId: string,
    roomName: string,
    roomType: string,
    selections: Array<{
      id: string,
      role: string,
      line: string,
      imageUrl: string,
      styleTags: string[]
    }>
  },
  width: number,
  height: number,
  seed: number | null,
  generatedBy: string,        // userId
  generatedAt: string         // ISO timestamp
}
```

---

## 7. PRODUCT TAGGING FLOW

**File:** `/home/user/folio-mvp/src/app/api/tag-product-to-image/route.ts`

### 7.1 POST Request Schema

```typescript
{
  x: number,                      // Normalized X coordinate (0-1)
  y: number,                      // Normalized Y coordinate (0-1)
  productId: string,              // Required
  imageId: string,                // Required
  projectId?: string,
  // Optional decision capture:
  decisionReasoning?: string,
  alternativesConsidered?: string[],
  tradeoffs?: string,
  convictionLevel?: number
}
```

### 7.2 ProductTag Model

**File:** `/home/user/folio-mvp/prisma/schema.prisma:416-429`

```prisma
model ProductTag {
  id        String       @id @default(uuid())
  x         Float
  y         Float
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  productId String
  imageId   String
  image     ProjectImage @relation(...)
  product   Product      @relation(...)
  selection Selection?   // Optional back-link
}
```

### 7.3 Atelier Signals Recorded

| Signal Key | Value | Weight | Trigger |
|------------|-------|--------|---------|
| `product_tagged` | productId | 1.0 | Always |
| `category:{category}` | productId | 1.0 | If product has category |
| `vendor:{vendorId}` | productId | 1.0 | If product has vendorId |
| `decision_reasoning` | text | 1.5 | If provided |
| `alternatives_considered` | JSON array | 1.2 | If provided |
| `tradeoffs` | text | 1.3 | If provided |
| `conviction_level` | number string | 1.0 | If provided |

---

## 8. GENERATE BUTTON VISIBILITY

**File:** `/home/user/folio-mvp/src/app/project/[id]/DesignerBoard.tsx:249-258`

```tsx
{/* Generate Images Button */}
{selectedRoomId && (
  <button onClick={handleGenerateImages} className="accent-btn ...">
    <FaImage className="w-4 h-4" />
    Generate Images
  </button>
)}
```

**Visibility Condition:** Button only appears when `selectedRoomId` is set (a room must be filtered/selected).

---

## 9. DATA GAPS ANALYSIS

### 9.1 Selection Fields NOT Used in Prompts

| Field | Potential Value | Why Not Used |
|-------|----------------|--------------|
| `notes` | Designer intent, reasoning | Could provide context for AI |
| `quantity` | Multiple items | Could adjust scene composition |
| `unitPrice` | Budget tier | Could inform quality expectation |
| `specSheetUrl` | Detailed specs | Could provide exact dimensions |
| `productUrl` | Product page | Reference for appearance |

### 9.2 Product Fields NOT Used in Prompts

| Field | Potential Value | Why Not Used |
|-------|----------------|--------------|
| `description` | Detailed product info | Could enrich prompt |
| `cutoutImageUrl` | Clean product image | Better reference than photo |
| `category` | Product type | Could improve composition |

### 9.3 Missing Data Points

| Data | Where It Could Come From | Impact |
|------|-------------------------|--------|
| Material details | Product.description, spec sheets | More accurate rendering |
| Exact dimensions | SkeletonItem from PDF import | Better proportions |
| Color hex values | Could be extracted/stored | More accurate colors |
| Style keywords | Product.tags, Selection.tags | Better mood matching |

---

## 10. ENVIRONMENT VARIABLES

```bash
# Image Generation
IMAGE_GEN_PROVIDER=openai|stability|fake   # Default: openai
IMAGE_GEN_MAX_PER_HOUR=10                  # Rate limit per user
FAKE_PROVIDER=0|1                          # Override to fake

# OpenAI
OPENAI_API_KEY=<key>                       # Required for OpenAI provider
OPENAI_IMAGE_MODEL=gpt-image-1             # Default model

# Stability AI
STABILITY_API_KEY=<key>                    # Required for Stability provider
STABILITY_ENGINE=stable-image-ultra        # Default engine
```

---

## 11. KEY FILES INDEX

| Component | File | Lines |
|-----------|------|-------|
| Prompt Builder | `/src/lib/boards/prompt.ts` | 1-146 |
| Image Gen Providers | `/src/lib/ai/imageGen.ts` | 1-206 |
| Gen-Image API | `/src/app/api/projects/[id]/rooms/[roomId]/gen-image/route.ts` | 1-161 |
| Generate Dialog | `/src/components/boards/GenerateDialog.tsx` | 1-297 |
| Designer Board | `/src/app/project/[id]/DesignerBoard.tsx` | 1-327 |
| Tag Product API | `/src/app/api/tag-product-to-image/route.ts` | 1-334 |
| Selection Schema | `/prisma/schema.prisma` | 499-532 |
| Product Schema | `/prisma/schema.prisma` | 384-414 |
| ProductTag Schema | `/prisma/schema.prisma` | 416-429 |
| Room Schema | `/prisma/schema.prisma` | 484-497 |

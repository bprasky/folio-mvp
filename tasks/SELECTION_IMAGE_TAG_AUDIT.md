# Audit: Selection ↔ Image Tag Data Flow

## Executive Summary

Selection (design board) and ProductTag (image annotation) **are already linked** via a one-to-one FK (`Selection.productTagId → ProductTag.id`), but this link is optional and rarely populated. The two systems evolved independently: designers curate selections on the design board, and separately tag products on images. There is **no automation** bridging them — no auto-tagging from selections, no backfill from tags to the board.

---

## 1. Schema Relationships

### Selection Model
```
Selection
├── projectId: String (required FK → Project)
├── roomId: String? (optional FK → Room)
├── productTagId: String? @unique (optional FK → ProductTag, onDelete: SetNull)
├── productName, vendorName, colorFinish, notes, photo, unitPrice, quantity
├── slotKey: String? (room template slot, e.g., "countertop")
├── source: String (default: "upload")
└── uiMeta: Json? (displaySize, featured, etc.)
```

### ProductTag Model
```
ProductTag
├── x: Float (percentage-based, 0-100)
├── y: Float (percentage-based, 0-100)
├── productId: String (required FK → Product)
├── imageId: String (required FK → ProjectImage)
└── selection: Selection? (inverse of Selection.productTagId)
```

### Key Relationships
| From | To | Type | Link |
|------|-----|------|------|
| Selection → ProductTag | One-to-One | `productTagId` (optional, unique) |
| Selection → Room | Many-to-One | `roomId` (optional) |
| Selection → Project | Many-to-One | `projectId` (required) |
| ProductTag → Product | Many-to-One | `productId` (required) |
| ProductTag → ProjectImage | Many-to-One | `imageId` (required) |
| ProjectImage → Project | Many-to-One | `projectId` (required) |

### The Gap
- **Selection references products by text fields** (`productName`, `vendorName`) — not by FK to `Product`.
- **ProductTag references products by FK** (`productId → Product`).
- There is no `Selection.productId` FK. The only programmatic bridge is `Selection.productTagId`.
- `ProjectImage.room` is a **denormalized string**, not a FK to `Room`. It cannot be reliably joined to `Selection.roomId`.

---

## 2. Current Tagging Flow (`POST /api/tag-product-to-image`)

**File:** `src/app/api/tag-product-to-image/route.ts`

### Required Input
```typescript
{ x: number, y: number, productId: string, imageId: string, projectId: string }
```

### Validation Chain
1. Auth check (session required)
2. Project ownership (owner OR designer)
3. Image belongs to project
4. Product exists

### What It Creates
- `ProductTag { x, y, productId, imageId }` — no room info, no selection link
- Optionally creates `ShopProduct` (if `addToShop: true`)
- Records Atelier signals (category/vendor preference, decision reasoning)

### What It Does NOT Do
- Does not create or link a Selection
- Does not check if a matching Selection exists on the design board
- Does not use room context from `ProjectImage.room`
- Does not suggest products based on room/project selections

### Related Endpoints
- `GET /api/tag-product-to-image?imageId=X` — fetch tags for an image
- `DELETE /api/tag-product-to-image?id=X` — remove a tag
- `GET /api/products?search=X` — product catalog for tag picker

---

## 3. Interview Initialization (`POST /api/posting/project/[projectId]/init`)

**File:** `src/app/api/posting/project/[projectId]/init/route.ts`

### What It Does
- Creates a DRAFT `ProjectPost` with a generated slug
- Checks: auth, project view access, no duplicate post (409)

### Pre-Check System (Context Assessment)
**File:** `src/lib/interview/contextLevel.ts`

Before questions are generated, `assessProjectContext()` evaluates data richness:

| Level | Criteria | Question Style |
|-------|----------|---------------|
| 0 | No context | Generic fallback |
| 1 | Has photos | Room-based, visual |
| 2 | + Material schedule | Product-specific |
| 3 | + Concept presentation | Aesthetic choices |
| 4 | + Floor plan | Spatial flow |
| 5 | + Progress presentations | Decision journey |

### Where a Diagnostic Would Slot In
The context assessment in `assessProjectContext()` already queries rooms, selections, and images. A "tag readiness" diagnostic could:
1. **Extend `assessProjectContext()`** to check for untagged images with matching selections
2. **Add a new endpoint** `GET /api/posting/project/[id]/diagnostic` that returns readiness data
3. **Hook into the interview GET** (`/api/posting/project/[id]/interview`) which already calls `assessProjectContext()` before returning questions

The natural insertion point is **between init and the first GET of interview questions**, since the context assessment already runs there.

---

## 4. Design Board Queries

### How Selections Are Fetched
```
Project page → prisma.project.findUnique({
  include: { rooms: { include: { selections: true } } }
})
```

### API Endpoints
- `GET /api/projects/[id]/rooms/[roomId]/selections` — room-scoped
- `GET /api/projects/[id]` — full project with nested rooms/selections
- `POST /api/selections` — create (with optional `roomId`)
- `PATCH /api/selections/[id]` — update

### Room ↔ Image Mapping
- `Selection.roomId` → FK to `Room.id` (proper relationship)
- `ProjectImage.room` → plain string field (NOT a FK)
- `ensureRoomsForProject()` creates `Room` records from `ProjectImage.room` strings
- **No reliable join exists** between `ProjectImage` and `Room` beyond string matching on `ProjectImage.room == Room.name`

---

## 5. Gap Analysis

### Gap 1: No Auto-Tag from Selections
**Current:** Designer manually tags each image with products from the catalog.
**Missing:** When a room has selections AND images, we could auto-place tags on images belonging to that room.
**Blocker:** `ProjectImage.room` is a string, not a FK. Matching requires `ProjectImage.room == Room.name` (fuzzy).

### Gap 2: No Backfill from Tags to Design Board
**Current:** Tagging a product on an image creates only a `ProductTag`. No `Selection` is created.
**Missing:** `POST /api/tag-product-to-image` should optionally create a `Selection` in the appropriate room, linking via `productTagId`.
**Available:** The `Selection.productTagId` FK already exists and is unused in most flows.

### Gap 3: No Product FK on Selection
**Current:** Selections store `productName`/`vendorName` as text. There's no `Selection.productId` FK.
**Impact:** Matching selections to `Product` records (needed for auto-tagging) requires text matching or the `cachedProductLinks` pivot table.
**Workaround:** `SelectionCachedProduct` model exists as a many-to-many bridge, but its population is unclear.

### Gap 4: No Room FK on ProjectImage
**Current:** `ProjectImage.room` is a string. `Selection.roomId` is a proper FK.
**Impact:** Cannot reliably JOIN images to rooms/selections without string matching.
**Fix:** Either add `ProjectImage.roomId` FK, or build a resolver function that matches `ProjectImage.room` to `Room.name`.

### Gap 5: No Diagnostic Endpoint
**Current:** `assessProjectContext()` checks data richness but doesn't surface tag-readiness.
**Missing:** A diagnostic that says "Room X has 5 selections but 0 of 3 images are tagged."

### Gap 6: Render Manifest Not Linked
**Current:** Folio-generated renders presumably have a product manifest, but it's not stored/linked.
**Missing:** When a render is generated, its product manifest should be persisted so auto-tagging can use exact coordinates.

---

## 6. Recommended Implementation Path

### Phase 1: Diagnostic Endpoint
```
GET /api/posting/project/[id]/tag-diagnostic
Returns: {
  rooms: [{
    roomId, roomName,
    selectionCount,
    imageCount,
    taggedImageCount,
    unmatchedSelections: Selection[],  // selections with no ProductTag
    untaggedImages: ProjectImage[],    // images with no ProductTags
    autoTaggable: boolean              // true if selections + images exist
  }],
  summary: { totalGaps: number, autoTaggableRooms: number }
}
```

### Phase 2: Auto-Tag Engine
```
POST /api/project/[id]/auto-tag
Body: { roomId?: string, dryRun?: boolean }
Flow:
  1. Match ProjectImage.room → Room.name
  2. For each untagged image in a room with selections:
     a. Find Product records matching selection text (via cachedProductLinks or fuzzy match)
     b. Create ProductTag with default coordinates (center or grid layout)
     c. Link Selection.productTagId → new ProductTag.id
  3. Return created tags + any failures
```

### Phase 3: Backfill on Manual Tag
```
Extend POST /api/tag-product-to-image:
  - After creating ProductTag, check if a Selection exists for this product in this room
  - If yes: link Selection.productTagId → tag.id
  - If no: optionally create a new Selection in the room
```

### Phase 4: Room FK on ProjectImage (Schema Change)
```prisma
model ProjectImage {
  roomId String? // new FK
  roomRef Room? @relation(fields: [roomId], references: [id])
}
```
This would replace the string-based `room` field and enable reliable joins.

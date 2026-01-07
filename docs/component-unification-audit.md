# Component Unification Audit: Room Creation + Skeletons + Search

**Date:** 2025-01-27  
**Audit Type:** READ-ONLY Architectural Assessment  
**Objective:** Map existing component systems to identify unification opportunities for AI classification, room creation, tagging, search, and progressive enrichment

---

## Executive Summary

Folio has **disconnected component systems** that operate independently:

- ✅ **Component models exist** (ProjectImage, ProductTag, SkeletonItem, Room)
- ⚠️ **Partial addressability** (URL params exist but highlighting incomplete)
- ❌ **No unified component reference** (each system uses different ID patterns)
- ⚠️ **Room backfill reads ProjectImage.room** (string field) but **doesn't read SkeletonItem.roomName**
- ❌ **Component-level search missing** (only project/product-level exists)

**Key Finding:** `SkeletonItem.roomName` is **populated from `ProjectImage.room`** during creation, but room backfill logic **doesn't read it back**. This creates a one-way flow that prevents skeletons from informing room creation.

---

## 1️⃣ Inventory: Existing Component Primitives

### Project Image Rendering & Highlighting

#### **File:** `src/app/project/[id]/MediaSection.tsx`
- **Responsibilities:**
  - Renders image grid with tags overlay
  - Handles `highlightImageId` and `highlightTagId` props
  - Scrolls to highlighted image (`useEffect` lines 156-175)
  - Shows tag overlays when image is highlighted or selected
  - Tag highlighting with pulse animation (lines 456-497)

**Evidence:**
```155:175:src/app/project/[id]/MediaSection.tsx
  // Handle highlight from query params
  useEffect(() => {
    if (highlightImageId && highlightTagId) {
      const image = images.find(img => img.id === highlightImageId);
      if (image) {
        setSelectedImageForView(image);
        setHighlightedTagId(highlightTagId);
        // Scroll to image after a brief delay
        setTimeout(() => {
          const element = document.getElementById(`image-${highlightImageId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
        // Clear highlight after 2 seconds
        setTimeout(() => {
          setHighlightedTagId(null);
        }, 2000);
      }
    }
  }, [highlightImageId, highlightTagId, images]);
```

**Gap:** Scroll-to logic exists but only triggers when **both** `highlightImageId` and `highlightTagId` are present. Missing: skeleton highlighting, room highlighting.

### ProductTag Creation/Rendering/Highlighting

#### **File:** `src/components/AdvancedTagProducts.tsx`
- **Responsibilities:**
  - Click-to-tag interface (lines 95-155)
  - Tag rendering with coordinates (`x`, `y` as percentages)
  - Tag deletion (lines 158-174)
  - Visual tag dots with hover tooltips

#### **File:** `src/app/api/tag-product-to-image/route.ts`
- **Responsibilities:**
  - Creates `ProductTag` records with `x`, `y` coordinates
  - Links to `ProjectImage` and `Product`
  - Writes `ContextSignal` for sourcing memory (lines 299-334)

**Evidence:**
```354:367:prisma/schema.prisma
model ProductTag {
  id                String             @id @default(uuid())
  x                 Float
  y                 Float
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @default(updatedAt)
  productId         String
  imageId           String
  image             ProjectImage       @relation(fields: [imageId], references: [id], onDelete: Cascade)
  product           Product            @relation(fields: [productId], references: [id], onDelete: Cascade)
  pendingRepInvites PendingRepInvite[]

  @@map("product_tags")
}
```

**Gap:** Tags are addressable via `?tag={id}` but highlighting only works in `MediaSection`, not in other views.

### SkeletonItem Creation/Rendering/Confirm/Dismiss

#### **File:** `src/lib/living/skeleton.ts`
- **Responsibilities:**
  - Generates skeleton items for images (`ensureSkeletonItemsForImage`)
  - Reads `ProjectImage.room` (string) and stores in `SkeletonItem.roomName` (line 147)
  - Filters by `UNCONFIRMED`/`CONFIRMED` status

**Evidence:**
```144:153:src/lib/living/skeleton.ts
    const items = bboxes.map((bbox) => ({
      projectId: image.projectId,
      projectImageId: image.id,
      roomName: image.room || null,
      bbox: bbox,
      label: 'unconfirmed',
      confidence: 0.35 + rng() * 0.3, // 0.35-0.65
      status: 'UNCONFIRMED' as const,
      createdBy: 'AI' as const,
    }));
```

#### **File:** `src/components/living/SkeletonOverlay.tsx`
- **Responsibilities:**
  - Renders skeleton bounding boxes on images
  - Handles click events to open confirmation panel
  - Highlights skeleton when `highlightSkeletonId` prop is set

**Evidence:**
```85:104:src/components/living/SkeletonOverlay.tsx
        return (
          <div
            key={skeleton.id}
            className={`absolute border-2 rounded-sm transition-all pointer-events-auto cursor-pointer ${
              isHighlighted
                ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/50'
                : 'border-gray-400/40 bg-gray-400/5 hover:border-gray-500/60 hover:bg-gray-500/10'
            }`}
            style={{
              left,
              top,
              width,
              height,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (onSkeletonClick) {
                onSkeletonClick(skeleton.id);
              }
            }}
```

#### **File:** `src/app/project/[id]/DesignerBoardRoom.tsx`
- **Responsibilities:**
  - Integrates `SkeletonOverlay` component (line 12)
  - Handles skeleton click events (lines 186-200)
  - Opens confirmation panel (`SkeletonSidePanel`)
  - Inbox component for unconfirmed skeletons (`RoomSkeletonInbox`)

**Gap:** Skeleton highlighting exists but **no URL param support** (`?skeleton={id}`).

### Room Creation/Backfills & Room Assignment Storage

#### **Room Assignment: Two Storage Patterns**

**Pattern 1: `ProjectImage.room` (String Field)**
- **File:** `prisma/schema.prisma:260-276`
- **Field:** `room: String?` (not a relation)
- **Used by:**
  - Image filtering (`src/lib/magazine/getMagazineData.ts:30`)
  - Room backfill logic (`src/lib/living/rooms.ts:49-52`)
  - Skeleton creation (`src/lib/living/skeleton.ts:147`)

**Pattern 2: `Room` Model (Relation)**
- **File:** `prisma/schema.prisma:422-434`
- **Model:** `Room` with `id`, `name`, `type`, `projectId`
- **Used by:**
  - Selections (`Selection.roomId` → `Room.id`)
  - Room templates (`src/app/project/[id]/roomTemplates.ts`)
  - Designer boards (`DesignerBoardRoom.tsx`)

**Evidence:**
```260:276:prisma/schema.prisma
model ProjectImage {
  id            String              @id @default(uuid())
  url           String
  name          String?
  room          String?  // ⚠️ String field, not relation
  displayOrder  Int?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @default(updatedAt)
  projectId     String
  tags          ProductTag[]
  projectTags   ProjectProductTag[]
  project       Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  threeDAssets  ThreeDAsset[]
  skeletonItems SkeletonItem[]
  @@map("project_images")
}
```

**Gap:** **Dual storage** creates inconsistency:
- `ProjectImage.room` is a **string** (e.g., "Kitchen")
- `Room` is a **relation** with `id` and `name`
- No automatic sync between them

#### **Room Backfill Logic**

#### **File:** `src/lib/living/rooms.ts:11-85`
- **Responsibilities:**
  - Reads `ProjectImage.room` (string field) from all images
  - Creates `Room` records for distinct room names
  - Only runs for `PAST` projects with `livingEnabled=true`

**Evidence:**
```47:53:src/lib/living/rooms.ts
    // Collect distinct room names from images (non-null, non-empty)
    const imageRoomNames = new Set<string>();
    project.images.forEach((img) => {
      if (img.room && img.room.trim()) {
        imageRoomNames.add(img.room.trim());
      }
    });
```

**Critical Gap:** Room backfill **does NOT read `SkeletonItem.roomName`**. It only reads `ProjectImage.room` (string field).

**Flow:**
1. Image uploaded → `ProjectImage.room` set (string)
2. Skeleton created → `SkeletonItem.roomName` copied from `ProjectImage.room`
3. Room backfill → Reads `ProjectImage.room` only, **ignores `SkeletonItem.roomName`**

**Missing:** If skeletons detect rooms that images don't have, those rooms won't be created.

---

## 2️⃣ Current Addressability & Gaps

### SearchParams Parsing

#### **File:** `src/app/project/[id]/page.tsx:24`
- **Parsed:** `image`, `tag`, `room` (as strings)
- **Passed to:** `MediaSection` component as props

**Evidence:**
```24:24:src/app/project/[id]/page.tsx
  searchParams: { view?: string; image?: string; tag?: string; room?: string };
```

```229:231:src/app/project/[id]/page.tsx
            highlightImageId={searchParams.image}
            highlightTagId={searchParams.tag}
```

**Gap:** `room` param is parsed but **not used** for highlighting or scrolling.

### Image Highlighting

#### **Status:** ✅ **Partially Implemented**
- **File:** `src/app/project/[id]/MediaSection.tsx:155-175`
- **Works:** Scrolls to image, highlights tag
- **Missing:** Skeleton highlighting, room highlighting

### Tag Highlighting

#### **Status:** ✅ **Partially Implemented**
- **File:** `src/app/project/[id]/MediaSection.tsx:456-497`
- **Works:** Pulse animation, tooltip on highlighted tag
- **Missing:** Works only in `MediaSection`, not in other views (e.g., `DesignerBoardRoom`)

### Skeleton Highlighting

#### **Status:** ⚠️ **Component-Level Only**
- **File:** `src/components/living/SkeletonOverlay.tsx:77-92`
- **Works:** Highlights skeleton when `highlightSkeletonId` prop is set
- **Missing:** No URL param support (`?skeleton={id}`), no scroll-to logic

**Evidence:**
```210:226:src/app/project/[id]/DesignerBoardRoom.tsx
  const handleInboxSkeletonClick = (skeletonId: string, imageId: string) => {
    setHighlightSkeletonId(skeletonId);
    setSelectedSkeleton(skeletonId);
    setSkeletonPanelOpen(true);
    // Scroll to image (would need refs in real implementation)
    // For now, just open the panel
    fetch(`/api/living/skeleton?projectId=${projectId}`)
      .then(res => res.json())
      .then(data => {
        const items = data.items || [];
        const skeleton = items.find((s: any) => s.id === skeletonId);
        if (skeleton) {
          setSkeletonToConfirm(skeleton);
        }
      })
      .catch(err => console.error('Failed to fetch skeleton:', err));
  };
```

**Gap:** Comment says "would need refs in real implementation" — scroll-to not implemented.

### Room Highlighting

#### **Status:** ❌ **Not Implemented**
- **Missing:** No component to highlight a room
- **Missing:** No URL param handling for `?room={id}` or `?room={name}`

### Scroll-to / Focus Logic Requirements

**Where it needs to live:**

1. **Image:** ✅ `MediaSection.tsx:164-167` (exists)
2. **Tag:** ✅ `MediaSection.tsx:164-167` (exists, but only in MediaSection)
3. **Skeleton:** ❌ Missing (comment in `DesignerBoardRoom.tsx:214` says "would need refs")
4. **Room:** ❌ Missing (no component to scroll to)

**Required additions:**
- `DesignerBoardRoom.tsx`: Add refs for images, implement scroll-to for skeletons
- `MediaSection.tsx`: Add skeleton highlighting support
- `ProjectPage`: Add room highlighting/scroll-to logic

---

## 3️⃣ Shared ComponentRef Contract (No Schema Changes)

### Existing Patterns

#### **Pattern 1: Selection Slot Keys**
- **File:** `src/app/project/[id]/roomTemplates.ts:114-158`
- **Format:** `slotKey: string` (e.g., "sofa", "countertop", "accent-chairs")
- **Used by:** Room templates, selection inference

**Evidence:**
```41:41:src/app/project/[id]/DesignerBoardRoom.tsx
  slotKey?: string | null; // Optional slot key for room template tracking
```

#### **Pattern 2: Tag IDs**
- **Format:** `ProductTag.id` (UUID)
- **Used by:** URL params (`?tag={id}`), highlighting

#### **Pattern 3: Skeleton IDs**
- **Format:** `SkeletonItem.id` (cuid)
- **Used by:** Component state (`highlightSkeletonId`), but **not URL params**

#### **Pattern 4: Image IDs**
- **Format:** `ProjectImage.id` (UUID)
- **Used by:** URL params (`?image={id}`), highlighting

#### **Pattern 5: Room IDs/Names**
- **Format:** `Room.id` (UUID) or `Room.name` (string)
- **Used by:** Selections (`Selection.roomId`), but **not URL params**

### Proposed ComponentRef Contract

**TypeScript Interface (No Schema Changes):**
```typescript
type ComponentType = 'image' | 'tag' | 'skeleton' | 'room' | 'selection';

interface ComponentRef {
  type: ComponentType;
  id: string;
  // Optional context for disambiguation
  projectId?: string;
  imageId?: string; // For tags/skeletons
  roomId?: string; // For selections
}

// Serialized format for URLs/telemetry
type ComponentRefString = `${ComponentType}:${string}` | 
  `${ComponentType}:${string}@project:${string}` |
  `${ComponentType}:${string}@image:${string}`;
```

**Usage Patterns:**

1. **Search Results:**
   ```typescript
   {
     component: { type: 'image', id: 'img-123', projectId: 'proj-456' },
     project: { id: 'proj-456', title: '...' },
     // ... other fields
   }
   ```

2. **Deep Links:**
   ```
   /project/{projectId}?component=image:img-123
   /project/{projectId}?component=tag:tag-789@image:img-123
   /project/{projectId}?component=skeleton:skel-456@image:img-123
   /project/{projectId}?component=room:room-123
   ```

3. **Telemetry (ContextSignal.meta):**
   ```typescript
   {
     componentRef: 'tag:tag-789@image:img-123@project:proj-456',
     // ... other meta
   }
   ```

4. **Nudges / Inbox Items:**
   ```typescript
   {
     type: 'confirm_skeleton',
     componentRef: 'skeleton:skel-456@image:img-123',
     action: { type: 'confirm', url: '/project/...?component=...' }
   }
   ```

**Existing Similar Patterns:**
- ✅ `Selection.slotKey` — similar to component type
- ✅ `ProductTag.id` — already used in URLs
- ✅ `SkeletonItem.id` — used in component state
- ❌ No unified format across all components

---

## 4️⃣ Room Backfill Logic & Skeleton Integration

### Current Room Backfill Implementation

#### **File:** `src/lib/living/rooms.ts:11-85`
- **Reads:** `ProjectImage.room` (string field) from all images
- **Writes:** `Room` records (creates missing rooms)
- **Does NOT read:** `SkeletonItem.roomName`

**Evidence:**
```47:61:src/lib/living/rooms.ts
    // Collect distinct room names from images (non-null, non-empty)
    const imageRoomNames = new Set<string>();
    project.images.forEach((img) => {
      if (img.room && img.room.trim()) {
        imageRoomNames.add(img.room.trim());
      }
    });

    // Get existing room names
    const existingRoomNames = new Set(project.rooms.map((r) => r.name));

    // Find rooms that need to be created
    const roomsToCreate = Array.from(imageRoomNames).filter(
      (name) => !existingRoomNames.has(name)
    );
```

### Skeleton Room Name Population

#### **File:** `src/lib/living/skeleton.ts:147`
- **Reads:** `ProjectImage.room` (string field)
- **Writes:** `SkeletonItem.roomName` (copies from image)

**Evidence:**
```144:153:src/lib/living/skeleton.ts
    const items = bboxes.map((bbox) => ({
      projectId: image.projectId,
      projectImageId: image.id,
      roomName: image.room || null,
      bbox: bbox,
      label: 'unconfirmed',
      confidence: 0.35 + rng() * 0.3, // 0.35-0.65
      status: 'UNCONFIRMED' as const,
      createdBy: 'AI' as const,
    }));
```

### Gap: One-Way Flow

**Current Flow:**
```
Image.room (string) → SkeletonItem.roomName (copied)
                     ↓
                  Room backfill reads Image.room only
```

**Missing Flow:**
```
SkeletonItem.roomName → Room backfill (should read this too)
```

**Impact:** If AI detects a room in a skeleton that the image doesn't have, that room won't be created.

### Conflict Handling

#### **Status:** ❌ **No Conflict Handling**
- **Scenario:** Image has `room="Kitchen"`, skeleton has `roomName="Living Room"`
- **Current behavior:** Room backfill creates "Kitchen" only (from image)
- **Missing:** No logic to detect or resolve conflicts

**Where conflicts could occur:**
- AI detects room type from image content (skeleton)
- Designer manually sets image room name
- Multiple skeletons on same image have different room names

---

## 5️⃣ Search Readiness

### Existing Search Routes

#### **Project Search**
- **File:** `src/app/api/projects/route.ts:17-68`
- **Models:** `Project` only
- **Indexes:** None (ordered by `updatedAt DESC`)
- **Joins:** Includes `designer`, `images.tags.product`

**Evidence:**
```35:58:src/app/api/projects/route.ts
    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        images: {
          include: {
            tags: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
```

#### **Product Search**
- **File:** `src/app/api/products/search/route.ts:7-67`
- **Models:** `Product` only
- **Indexes:** None (ordered by `name ASC`)
- **Joins:** Includes `vendor`

#### **User Search**
- **File:** `src/app/api/users/search/route.ts:6-44`
- **Models:** `User` only
- **Indexes:** None (ordered by `name ASC`)

### Component-Level Search Requirements

**Minimal Joins Needed:**

1. **Image Search:**
   ```typescript
   ProjectImage.findMany({
     where: { /* search criteria */ },
     include: {
       project: { select: { id, title, designer } },
       tags: { include: { product: true } },
       skeletonItems: { where: { status: 'UNCONFIRMED' } }
     }
   })
   ```

2. **Tag Search:**
   ```typescript
   ProductTag.findMany({
     where: { /* search criteria */ },
     include: {
       image: { include: { project: { select: { id, title, designer } } } },
       product: true
     }
   })
   ```

3. **Skeleton Search:**
   ```typescript
   SkeletonItem.findMany({
     where: { /* search criteria */ },
     include: {
       projectImage: { include: { project: { select: { id, title, designer } } } },
       product: true // if confirmed
     }
   })
   ```

4. **Room Search:**
   ```typescript
   Room.findMany({
     where: { /* search criteria */ },
     include: {
       project: { select: { id, title, designer } },
       selections: { take: 5 },
       // Would need to join ProjectImage.room (string) for images
     }
   })
   ```

### Indexing Requirements

**Current Indexes:**
- `ProjectImage`: `@@index([projectId])` (implicit)
- `ProductTag`: None (implicit `imageId`, `productId` via relations)
- `SkeletonItem`: `@@index([projectId, projectImageId, status])`
- `Room`: None (implicit `projectId` via relation)

**Missing for Component Search:**
- `ProjectImage.room` (string field) — no index for room filtering
- `SkeletonItem.roomName` — no index for room filtering
- Full-text search on `ProjectImage.name`, `ProductTag` coordinates (for spatial search)

### Attribution Requirements

**All component results must include:**
- `project.id`, `project.title`, `project.designer.name`
- `project.isPublic` (for access control)
- Component-specific fields (e.g., `image.url`, `tag.x/y`, `skeleton.bbox`)

---

## 📦 Required Output Format

### Component Graph Map

```
Project
├── ProjectImage (room: string)
│   ├── ProductTag (x, y)
│   │   └── Product
│   └── SkeletonItem (roomName: string, bbox)
│       └── Product? (if confirmed)
├── Room (id, name, type)
│   └── Selection (roomId → Room.id)
│       └── Product? (via vendorProductId)
└── ProjectProductTag
    └── Product
```

**Key Relationships:**
- `ProjectImage.room` (string) ↔ `Room.name` (manual sync via backfill)
- `ProjectImage.room` (string) → `SkeletonItem.roomName` (copied on creation)
- `SkeletonItem.roomName` (string) → **NOT READ BY ROOM BACKFILL** ❌
- `Selection.roomId` → `Room.id` (relation)

### Shared Addressability Plan

**URL Format:**
```
/project/{projectId}?component={type}:{id}
/project/{projectId}?component={type}:{id}@image:{imageId}  // For tags/skeletons
/project/{projectId}?component={type}:{id}@room:{roomId}  // For selections
```

**Implementation:**
1. Parse `component` param in `ProjectPage` (`src/app/project/[id]/page.tsx`)
2. Extract type and ID(s)
3. Pass to appropriate view component (`MediaSection`, `DesignerBoardRoom`)
4. Component scrolls to and highlights target

**Files to Modify:**
- `src/app/project/[id]/page.tsx` — parse `component` param
- `src/app/project/[id]/MediaSection.tsx` — handle image/tag/skeleton highlighting
- `src/app/project/[id]/DesignerBoardRoom.tsx` — handle skeleton/room highlighting
- `src/components/living/SkeletonOverlay.tsx` — accept `highlightSkeletonId` from URL

### "Talk-to-Each-Other" Plan

#### **Room Inference ↔ Skeletons**

**Current:** One-way (Image.room → SkeletonItem.roomName)

**Proposed:**
1. **Skeleton creation:** Copy `ProjectImage.room` → `SkeletonItem.roomName` ✅ (exists)
2. **Room backfill:** Read **both** `ProjectImage.room` AND `SkeletonItem.roomName` ❌ (missing)
3. **Conflict resolution:** If skeleton room differs from image room, prefer skeleton (AI-detected) or prompt designer

**Files to Modify:**
- `src/lib/living/rooms.ts:47-61` — add `SkeletonItem.roomName` reading

#### **Skeletons ↔ Search**

**Current:** No skeleton search

**Proposed:**
1. Search endpoint returns skeleton items with project context
2. Search results include `ComponentRef` for deep-linking
3. Skeleton results show confidence, status, room name

**Files to Create:**
- `src/app/api/search/components/route.ts` — new component search endpoint

#### **Search ↔ Enrichment**

**Current:** No component-level engagement tracking

**Proposed:**
1. `ContextSignal` includes `componentRef` in `meta` JSON
2. Aggregate signals by component to detect demand
3. Generate nudges when component engagement exceeds threshold

**Files to Modify:**
- `src/lib/telemetry/context-signal.ts` — add `componentRef` helper
- `src/app/api/analytics/track/route.ts` — include component context

#### **Enrichment ↔ Room Creation**

**Current:** Room backfill is manual (triggered on project load)

**Proposed:**
1. When skeleton engagement high → suggest room creation
2. When image has no room but skeletons detect one → auto-create room
3. Nudge designer to confirm room assignment

**Files to Create:**
- `src/lib/enrichment/demand-detection.ts` — aggregate component signals
- `src/lib/enrichment/nudge-generation.ts` — create pending actions

---

## Minimal Implementation Order (1-5)

### **1. Unify Room Storage** (Foundation)
**Goal:** Make `ProjectImage.room` and `Room` model consistent

**Files:**
- `src/lib/living/rooms.ts` — update backfill to read `SkeletonItem.roomName`
- `src/lib/living/skeleton.ts` — ensure `roomName` is always set
- Migration: Consider `ProjectImage.roomId` (relation) vs `room` (string) — **defer schema change**

**Effort:** Low (read-only audit, but implementation would be medium)

### **2. ComponentRef Contract** (Shared Format)
**Goal:** Define unified reference format for all components

**Files:**
- `src/lib/components/ref.ts` — new file with `ComponentRef` types
- `src/app/project/[id]/page.tsx` — parse `component` param
- `src/app/project/[id]/MediaSection.tsx` — use `ComponentRef` for highlighting
- `src/app/project/[id]/DesignerBoardRoom.tsx` — use `ComponentRef` for skeletons

**Effort:** Medium (type definitions + URL parsing)

### **3. Deep-Linking Implementation** (Addressability)
**Goal:** Complete scroll-to and highlight logic for all components

**Files:**
- `src/app/project/[id]/MediaSection.tsx` — add skeleton highlighting
- `src/app/project/[id]/DesignerBoardRoom.tsx` — implement scroll-to for skeletons
- `src/components/living/SkeletonOverlay.tsx` — accept URL-driven highlight
- New: Room highlighting component

**Effort:** Medium (UI logic, refs, scroll behavior)

### **4. Component-Level Search** (Discovery)
**Goal:** Search endpoint that returns images/tags/skeletons/rooms with attribution

**Files:**
- `src/app/api/search/components/route.ts` — new search endpoint
- `src/lib/search/component-query.ts` — query builders for each component type
- `src/components/search/ComponentResults.tsx` — UI for component results

**Effort:** High (new endpoint + UI)

### **5. Progressive Enrichment** (Demand-Driven)
**Goal:** Detect component demand and generate nudges

**Files:**
- `src/lib/enrichment/demand-detection.ts` — aggregate `ContextSignal` by component
- `src/lib/enrichment/nudge-generation.ts` — create pending actions
- `src/components/DesignerInbox.tsx` — extend beyond handoffs
- `src/app/api/enrichment/nudges/route.ts` — nudge API

**Effort:** High (signal aggregation + UX)

---

## Risk Flags

### **1. Dual Room Storage**
- **Risk:** `ProjectImage.room` (string) and `Room` (relation) can drift out of sync
- **Mitigation:** Room backfill should be the single source of truth, or migrate to `ProjectImage.roomId` (relation)

### **2. Skeleton Room Name Not Used**
- **Risk:** AI-detected rooms in skeletons are ignored by room backfill
- **Mitigation:** Update `ensureRoomsForProject` to read `SkeletonItem.roomName`

### **3. ComponentRef Complexity**
- **Risk:** Over-engineering the reference format
- **Mitigation:** Start simple (`type:id`), add context only when needed

### **4. Search Performance**
- **Risk:** Component search with joins could be slow
- **Mitigation:** Add indexes, paginate results, cache frequent queries

### **5. Enrichment Spam**
- **Risk:** Too many nudges overwhelm designers
- **Mitigation:** Threshold-based, grouped by component type, dismissible

---

**End of Audit Report**









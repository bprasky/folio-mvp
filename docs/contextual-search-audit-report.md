# Folio — Contextual Search & Editorial Lenses: Architectural Audit Report

**Date:** 2025-01-27  
**Audit Type:** READ-ONLY Architectural Assessment  
**Objective:** Map existing systems and identify leverage points for contextual, component-level search and discovery

---

## Executive Summary

Folio has **strong foundational primitives** for contextual search, but several key gaps prevent component-level discovery. The system already supports:

- ✅ **Component models** (images, tags, rooms, skeleton items)
- ✅ **Engagement tracking** (ContextSignal system)
- ✅ **AI detection** (SkeletonItem with UNCONFIRMED/CONFIRMED states)
- ✅ **Editorial infrastructure** (EditorialCategory, EditorialAssignment)
- ⚠️ **Partial deep-linking** (URL params exist but not fully utilized)
- ❌ **Component-level search** (only project-level exists)
- ❌ **Progressive enrichment** (no demand-driven nudges)
- ❌ **Editorial lenses** (static pages, not dynamic projections)

**Readiness Scores:**
- Contextual search: **40%** (models exist, search missing)
- AI component detection: **70%** (SkeletonItem system ready)
- Progressive enrichment: **20%** (signals exist, UX missing)
- Editorial lenses: **50%** (infrastructure exists, needs reframing)

---

## 1️⃣ Core Content & Component Model Audit

### Existing Component Models

#### **Project** (`prisma/schema.prisma:201-258`)
- **File:** `prisma/schema.prisma`
- **Fields:** `id`, `title`, `description`, `isPublic`, `publishedAt`, `views`, `saves`, `shares`
- **Relations:** `images[]`, `rooms[]`, `selections[]`, `skeletonItems[]`, `productTags[]`
- **Rendered in:** `src/app/project/[id]/page.tsx`
- **Addressable:** ✅ Yes — `/project/{id}`

#### **ProjectImage** (`prisma/schema.prisma:260-276`)
- **File:** `prisma/schema.prisma`
- **Fields:** `id`, `url`, `name`, `room` (string), `displayOrder`
- **Relations:** `project`, `tags[]` (ProductTag), `projectTags[]` (ProjectProductTag), `skeletonItems[]`
- **Rendered in:** `src/components/AdvancedTagProducts.tsx`, `src/app/project/[id]/page.tsx`
- **Addressable:** ⚠️ Partial — URL params `?image={id}` exist but not fully implemented

**Evidence:**
```24:24:src/app/project/[id]/page.tsx
  searchParams: { view?: string; image?: string; tag?: string; room?: string };
```

```229:231:src/app/project/[id]/page.tsx
            highlightImageId={searchParams.image}
            highlightTagId={searchParams.tag}
```

#### **Room** (`prisma/schema.prisma:422-434`)
- **File:** `prisma/schema.prisma`
- **Fields:** `id`, `name`, `type` (optional: KITCHEN, BATH, LIVING, etc.)
- **Relations:** `project`, `selections[]`, `quotes[]`
- **Rendered in:** `src/app/project/[id]/DesignerBoardRoom.tsx`
- **Addressable:** ⚠️ Partial — `?room={name}` param exists but not consistently used

**Room Inference:**
- Rooms are **explicitly created** by designers (not auto-inferred)
- `ProjectImage.room` is a **string field** (not a relation), used for filtering
- Room templates exist (`src/app/project/[id]/roomTemplates.ts`) but are UI-only

#### **ProductTag** (`prisma/schema.prisma:354-367`)
- **File:** `prisma/schema.prisma`
- **Fields:** `id`, `x`, `y` (coordinates), `productId`, `imageId`
- **Relations:** `image` (ProjectImage), `product`
- **Rendered in:** `src/components/AdvancedTagProducts.tsx`
- **Addressable:** ⚠️ Partial — `?tag={id}` param exists but highlighting not fully wired

**Tagging Flow:**
- Click-to-tag interface exists (`src/components/AdvancedTagProducts.tsx:95-155`)
- Tags stored with percentage-based coordinates (`x`, `y`)
- Visual tags displayed as blue dots with hover tooltips

#### **SkeletonItem** (`prisma/schema.prisma:278-299`) — **AI-Detected Components**
- **File:** `prisma/schema.prisma`
- **Fields:** `id`, `projectId`, `projectImageId`, `bbox` (JSON: `{x, y, w, h}`), `label`, `confidence`, `status` (UNCONFIRMED/CONFIRMED/DISMISSED), `createdBy` (AI/HUMAN)
- **Relations:** `project`, `projectImage`, `product?` (when confirmed)
- **Rendered in:** `src/app/project/[id]/DesignerBoardRoom.tsx:169-226`
- **Addressable:** ❌ No — no deep-linking to skeleton items

**Status:** This is the **closest existing primitive** to "AI-detected but unconfirmed components"

**Evidence:**
```278:299:prisma/schema.prisma
model SkeletonItem {
  id                 String            @id @default(cuid())
  projectId          String
  projectImageId     String
  roomName           String?
  bbox               Json // Normalized {x, y, w, h}
  label              String
  confidence         Float             @default(0)
  status             SkeletonStatus    @default(UNCONFIRMED)
  createdBy          SkeletonCreatedBy @default(AI)
  confirmedProductId String?
  confirmedLabel     String?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  project      Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectImage ProjectImage @relation(fields: [projectImageId], references: [id], onDelete: Cascade)
  product      Product?     @relation("SkeletonItemProduct", fields: [confirmedProductId], references: [id], onDelete: SetNull)

  @@index([projectId, projectImageId, status])
  @@map("skeleton_items")
}
```

#### **Selection** (`prisma/schema.prisma:436-467`)
- **File:** `prisma/schema.prisma`
- **Fields:** `id`, `productName`, `vendorName`, `roomId`, `projectId`, `slotKey`, `uiMeta` (JSON)
- **Relations:** `project`, `room?`, `vendorRep?`
- **Rendered in:** `src/app/project/[id]/DesignerBoardRoom.tsx`
- **Addressable:** ❌ No

#### **ProjectProductTag** (`prisma/schema.prisma:1237-1258`)
- **File:** `prisma/schema.prisma`
- **Fields:** `id`, `projectId`, `projectImageId?`, `productId`, `x?`, `y?`, `roomName?`, `notes?`
- **Relations:** `project`, `projectImage?`, `product`
- **Rendered in:** Magazine/product rails
- **Addressable:** ❌ No

### Designer Notes & Annotations

#### **MeetingNote** (`prisma/schema.prisma:1993-2009`)
- **File:** `prisma/schema.prisma`
- **Fields:** `id`, `projectId`, `title`, `rawText`, `transcriptUrl`, `metadata` (JSON)
- **Relations:** `project`
- **Rendered in:** `src/app/project/[id]/page.tsx:238-240` (MeetingNotesTab)
- **Addressable:** ❌ No

#### **ProjectIntent** (`prisma/schema.prisma:2011-2030`)
- **File:** `prisma/schema.prisma`
- **Fields:** `id`, `projectId`, `summary`, `moodKeywords[]`, `styleTags[]`, `budgetLevel`, `keyObjectives` (JSON)
- **Relations:** `project`
- **Rendered in:** Not directly rendered (used for AI prompts)
- **Addressable:** ❌ No

### Context Storage

**Where context lives today:**
- **Project-level:** `Project.description`, `ProjectIntent`, `MeetingNote`
- **Image-level:** `ProjectImage.name`, `ProjectImage.room` (string)
- **Tag-level:** `ProductTag.x`, `ProductTag.y` (coordinates only)
- **Room-level:** `Room.name`, `Room.type`, `RoomIntent`

**Gap:** No unified "context" field that captures designer notes, AI insights, or user annotations at the component level.

---

## 2️⃣ Search & Discovery Surface Audit

### Existing Search Systems

#### **Global Search** — ❌ **Does Not Exist**
- No unified search endpoint
- No search bar in navigation

#### **Project Search** — ✅ **Exists (Project-Level Only)**
- **File:** `src/app/api/projects/route.ts:17-68`
- **Query Logic:** Prisma `findMany` with text search on `title`, `description`, `category`
- **Ranking:** None (ordered by `createdAt DESC`)
- **UI:** `src/app/projects/page.tsx` (designer dashboard)

**Evidence:**
```17:68:src/app/api/projects/route.ts
export async function GET(request: NextRequest) {
  // ... filters by search, category, status
  // Returns projects only, not components
}
```

#### **Product/Vendor Search** — ✅ **Exists**
- **File:** `src/app/api/products/search/route.ts:7-67`
- **Query Logic:** Prisma `findMany` with `name.contains(query, mode: 'insensitive')`
- **Ranking:** Alphabetical (`orderBy: { name: 'asc' }`)
- **UI:** `src/components/selection/CatalogPicker.tsx:37-54`

**Evidence:**
```19:42:src/app/api/products/search/route.ts
      const products = await prisma.product.findMany({
        where: {
          name: {
            contains: query,
            mode: 'insensitive' as any,
          },
        },
        take: limit,
        // ... returns products only
      });
```

#### **User Search** — ✅ **Exists**
- **File:** `src/app/api/users/search/route.ts:6-44`
- **Query Logic:** Prisma `findMany` with `name.contains` or `email.contains`
- **Ranking:** Alphabetical
- **UI:** Not directly exposed (used internally)

### Feed & Discovery Logic

#### **Magazine/Editorial Feed** — ✅ **Exists (Static)**
- **File:** `src/app/magazine/page.tsx`, `src/lib/magazine/getMagazineData.ts`
- **Query Logic:** Fetches `ProjectPost` with `status: "PUBLISHED"`, ordered by `publishedAt DESC`
- **Ranking:** Heuristic (prefers "Meru" project for demo)
- **UI:** `src/components/magazine/MagazinePage.tsx`

**Evidence:**
```67:157:src/lib/magazine/getMagazineData.ts
  const posts = await prisma.projectPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 40,
    // ... includes project.images, project.productTags
  });
```

#### **Event Feed** — ✅ **Exists**
- **File:** `src/components/EventFeed.tsx:98-467`
- **Query Logic:** Client-side filtering and sorting
- **Ranking:** Multiple modes: `default` (Fibonacci), `chronological`, `trending`, `recently-listed`
- **UI:** `src/components/EventFeed.tsx`

**Evidence:**
```133:168:src/components/EventFeed.tsx
    switch (sortBy) {
      case 'default':
        const tiles = arrangeEventsForFibonacci(filtered);
        break;
      case 'trending':
        filtered.sort((a, b) => {
          // ... trending logic
        });
        break;
    }
```

### Component-Level Search — ❌ **Does Not Exist**

**Gap:** Search only returns:
- Projects (as whole entities)
- Products (as catalog items)
- Users

**Missing:** Search that returns:
- Images within projects
- Tags on specific images
- Rooms within projects
- Skeleton items (AI-detected components)

**Where to inject:** Search results could be enhanced to include:
- `ProjectImage` results with `project` context
- `ProductTag` results with `image` and `product` context
- `Room` results with `project` context

---

## 3️⃣ Engagement & Signal Audit (Demand Detection)

### Existing Signal Systems

#### **ContextSignal** — ✅ **Comprehensive System**
- **File:** `prisma/schema.prisma:1098-1123`, `src/lib/telemetry/context-signal.ts`
- **Fields:** `userId`, `vendorId`, `productId`, `projectId`, `eventId`, `action`, `tags[]`, `meta` (JSON), `valueUsd`, `verified`
- **Actions Tracked:** `"view"`, `"save"`, `"add_to_project"`, `"rsvp"`, `"feature_click"`, `"search"`, `"click"`

**Evidence:**
```1098:1123:prisma/schema.prisma
model ContextSignal {
  id         String   @id @default(cuid())
  userId     String?
  vendorId   String?
  productId  String?
  materialId String?
  projectId  String?
  eventId    String?
  action     String // "view" | "save" | "add_to_project" | "rsvp" | "feature_click" | "search"
  tags       String[] // ["brass","emerald","mid-century",...]
  meta       Json?
  createdAt  DateTime @default(now())
  // ... spend attribution fields
}
```

**Where Signals Are Fired:**
- Product views: `src/app/api/products/[productId]/route.ts:56`
- Product saves: `src/app/api/products/[productId]/save-to-project/route.ts:84-93`
- Tag creation: `src/app/api/tag-product-to-image/route.ts:299-334`
- Event engagement: `src/app/api/analytics/track/route.ts:26-38`

#### **EngagementEvent** — ✅ **Event-Scoped Signals**
- **File:** `prisma/schema.prisma:536-549`
- **Fields:** `userId`, `eventId`, `productId?`, `verb`, `meta` (JSON)
- **Actions:** `"VIEW_EVENT"`, `"VIEW_PRODUCT"`, `"SAVE_PRODUCT"`, `"RSVP"`, etc.
- **Scope:** Event-specific (not project-component level)

#### **Project-Level Metrics** — ✅ **Aggregated**
- **File:** `prisma/schema.prisma:201-258`
- **Fields:** `views`, `saves`, `shares` (integers)
- **Updated:** Manually incremented (not automatically tracked)

### Component-Level Signals — ⚠️ **Partial**

**What exists:**
- `ContextSignal` can attach to `productId` and `projectId`
- No direct attachment to `imageId`, `tagId`, `roomId`, or `skeletonItemId`

**Gap:** Cannot tell which **specific part** of a project people care about:
- Which image gets the most views?
- Which tag gets the most clicks?
- Which room generates the most saves?

**Lowest-Friction Signal for Enrichment:**
- ✅ **`ContextSignal.action === "click"`** on a product tag → trigger enrichment
- ✅ **`ContextSignal.action === "view"`** on a project image → track interest
- ❌ **Missing:** Signals on skeleton items (AI-detected components)

---

## 4️⃣ AI / Automation Hooks Audit

### Existing AI Systems

#### **SkeletonItem Detection** — ✅ **Fully Implemented**
- **File:** `prisma/schema.prisma:278-299`, `src/app/project/[id]/DesignerBoardRoom.tsx:169-226`
- **Where it runs:** Background job (referenced in `src/app/api/living/skeleton`)
- **Output:** `SkeletonItem` records with `status: UNCONFIRMED`
- **Storage:** Persistent in database
- **Status Flow:** `UNCONFIRMED` → `CONFIRMED` (when designer links to product) or `DISMISSED`

**Evidence:**
```278:299:prisma/schema.prisma
model SkeletonItem {
  // ... AI-detected component with bbox, label, confidence
  status             SkeletonStatus    @default(UNCONFIRMED)
  createdBy          SkeletonCreatedBy @default(AI)
  confirmedProductId String?
  // ... can be confirmed by linking to Product
}
```

**UI Integration:**
- Skeleton items displayed as overlays on images (`DesignerBoardRoom.tsx:186-226`)
- Inbox-style panel for reviewing unconfirmed items
- Click to confirm or dismiss

#### **Image Generation** — ✅ **Exists**
- **File:** `src/app/api/projects/[id]/rooms/[roomId]/gen-image/route.ts:11-168`
- **Where it runs:** API endpoint (on-demand)
- **Output:** Generated `ProjectImage` records
- **Storage:** Persistent
- **Context:** Uses `buildBasePrompt` from room selections (`src/lib/boards/prompt.ts:33-139`)

#### **Editorial Scoring** — ✅ **AI-Assisted**
- **File:** `src/lib/editorial/curator.ts:386-406`
- **Where it runs:** On project publish/update
- **Output:** `EditorialAssignment` records with `editorialScore`
- **Storage:** Persistent
- **Logic:** Combines engagement, vendor diversity, style uniqueness, trend alignment

**Evidence:**
```386:406:src/lib/editorial/curator.ts
export async function calculateEditorialScore(projectId: string): Promise<number> {
  const [engagementRaw, vendorDiversity, styleUniqueness, trendAlignment] =
    await Promise.all([
      fetchEngagement(projectId),
      scoreVendorDiversity(projectId),
      scoreStyleUniqueness(projectId),
      scoreTrendAlignment(projectId),
    ]);
  // ... weighted combination
}
```

#### **Room Auto-Creation** — ❌ **Does Not Exist**
- Rooms are **explicitly created** by designers
- `ProjectImage.room` is a string field (not inferred)

#### **Tag Suggestions** — ❌ **Does Not Exist**
- Tags are manually placed by designers
- No AI suggestions for tag placement or product matching

### Where AI-Detected Components Live

**Current State:**
- ✅ `SkeletonItem` is the **canonical model** for AI-detected components
- ✅ Status system (`UNCONFIRMED`/`CONFIRMED`/`DISMISSED`) matches "candidate vs confirmed" pattern
- ✅ Can be linked to `Product` when confirmed

**Gap:** No similar system for:
- AI-detected room types (inferred from images)
- AI-detected style tags (inferred from project content)
- AI-detected product categories (inferred from tags)

---

## 5️⃣ Designer Workflow & Dashboard Audit

### Project Upload & Tagging

#### **Project Creation** — ✅ **Complete Workflow**
- **File:** `src/components/ProjectCreationModal.tsx:47-1448`
- **Steps:**
  1. Project details (name, description, category)
  2. Image upload (URL or file)
  3. Product tagging (click-to-tag interface)
- **UI:** Modal wizard with tabs

**Evidence:**
```110:155:src/components/AdvancedTagProducts.tsx
  const handleTagProduct = async () => {
    // ... creates ProductTag with x, y coordinates
  };
```

#### **Tag Management** — ✅ **Exists**
- **File:** `src/components/AdvancedTagProducts.tsx:158-174`
- **Actions:** Create, delete tags
- **UI:** Visual tags on images with hover tooltips

#### **Notes & Descriptions** — ⚠️ **Partial**
- **Project-level:** `Project.description`, `ProjectIntent`
- **Image-level:** `ProjectImage.name` (optional)
- **Tag-level:** `ProjectProductTag.notes` (optional, rarely used)
- **Room-level:** `RoomIntent` (mood keywords, constraints)

### Designer Dashboard

#### **Projects List** — ✅ **Exists**
- **File:** `src/app/projects/page.tsx:14-30`
- **UI:** Grid of project cards
- **Filters:** `all`, `published`, `draft`

#### **Project Detail** — ✅ **Multi-Tab Interface**
- **File:** `src/app/project/[id]/page.tsx:196-250`
- **Tabs:** `overview`, `media`, `boards`, `drafts`, `meeting-notes`, `editorial`
- **URL Params:** `?view={tab}`, `?image={id}`, `?tag={id}`, `?room={name}`

### Notifications & Inbox

#### **DesignerInbox** — ✅ **Exists (Handoffs Only)**
- **File:** `src/components/DesignerInbox.tsx:12-50`
- **Content:** Vendor handoff notifications
- **UI:** Dropdown with count badge
- **Actions:** View handoff, open visit token

**Evidence:**
```12:50:src/components/DesignerInbox.tsx
export default function DesignerInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  // ... fetches handoffs only
  return (
    <div className="relative">
      <button>Inbox {count ? <span>{count}</span> : null}</button>
      {/* ... handoff list */}
    </div>
  );
}
```

### Progressive Enrichment Nudges — ❌ **Does Not Exist**

**Gap:** No system to:
- Nudge designers to confirm AI-detected skeleton items
- Prompt designers to add tags to popular images
- Suggest room creation for untagged images
- Remind designers to add descriptions to high-engagement projects

**Where Nudges Could Live:**
- ✅ **DesignerInbox** (extend beyond handoffs)
- ✅ **Project detail page** (sidebar notifications)
- ✅ **Designer dashboard** (pending actions section)

**Existing UX Patterns for Confirm/Dismiss:**
- ✅ **SkeletonItem panel** (`DesignerBoardRoom.tsx:202-208`) — confirm/dismiss pattern exists
- ✅ **Modal confirmations** (used throughout)
- ❌ **No persistent "pending actions" list**

---

## 6️⃣ Editorial / Magazine / Feature Audit

### Existing Editorial Infrastructure

#### **EditorialCategory** — ✅ **Taxonomy System**
- **File:** `prisma/schema.prisma:1049-1060`
- **Fields:** `id`, `type` (e.g., "style", "region", "theme"), `label`, `centroid` (vector)
- **Relations:** `assignments[]` (EditorialAssignment)

**Evidence:**
```1049:1060:prisma/schema.prisma
model EditorialCategory {
  id          String                 @id @default(cuid())
  type        String
  label       String
  centroid    Unsupported("vector")?
  createdAt   DateTime               @default(now())
  assignments EditorialAssignment[]
  @@unique([type, label])
  @@index([type])
  @@map("editorial_category")
}
```

#### **EditorialAssignment** — ✅ **Project-to-Category Mapping**
- **File:** `prisma/schema.prisma:1062-1077`
- **Fields:** `projectId`, `editorialId` (ProjectPost), `categoryId`, `editorialScore`
- **Relations:** `project`, `editorial` (ProjectPost), `category`

**Evidence:**
```1062:1077:prisma/schema.prisma
model EditorialAssignment {
  id             String            @id @default(cuid())
  projectId      String
  editorialId    String
  categoryId     String
  editorialScore Float
  createdAt      DateTime          @default(now())
  project        Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  editorial      ProjectPost       @relation(fields: [editorialId], references: [id], onDelete: Cascade)
  category       EditorialCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  @@unique([projectId, categoryId])
  @@index([categoryId])
  @@index([editorialId])
  @@map("editorial_assignment")
}
```

#### **EditorialEdition** — ✅ **Curated Collections**
- **File:** `prisma/schema.prisma:1079-1092`
- **Fields:** `slug`, `title`, `intro`, `categoryIds[]`, `projectIds[]`, `metrics` (JSON)
- **Relations:** None (denormalized)

**Evidence:**
```1079:1092:prisma/schema.prisma
model EditorialEdition {
  id          String    @id @default(cuid())
  slug        String    @unique
  title       String
  intro       String
  categoryIds String[]
  projectIds  String[]
  publishedAt DateTime?
  metrics     Json
  createdAt   DateTime  @default(now())
  updatedAt   DateTime @updatedAt
  @@map("editorial_edition")
}
```

### Editorial Routes

#### **Magazine Page** — ✅ **Static Feed**
- **File:** `src/app/magazine/page.tsx:33-37`
- **Route:** `/magazine?edition={slug}`
- **Type:** Static page (fetches `ProjectPost` with `status: "PUBLISHED"`)
- **Editions:** `for-you`, `global`, `modern` (hardcoded in `src/lib/magazine/editions.ts`)

**Evidence:**
```33:37:src/app/magazine/page.tsx
export default async function Page({ searchParams }: MagazinePageProps) {
  const edition = searchParams?.edition || "for-you";
  return <MagazinePage editionSlug={edition} />;
}
```

#### **Editorial Project Layout** — Historical implementation
- The unmounted `src/components/project/editorial/EditorialProjectLayout.tsx` tree was removed in Great Folio Delete Batch 2 (2026-09-08).
- The current public path is `/p/[slug]` → `getPostBySlug` → canonical `ProjectPost` → `StoryRenderer`.
- The previously listed `/project/{id}?view=editorial` view is historical, not evidence of a current mount.

### Featured/Trending Logic

#### **Editorial Scoring** — ✅ **Automated**
- **File:** `src/lib/editorial/curator.ts:386-406`
- **Logic:** Weighted combination of engagement, vendor diversity, style uniqueness, trend alignment
- **Output:** `EditorialAssignment.editorialScore` (0-1)

#### **Hero Selection** — ⚠️ **Heuristic**
- **File:** `src/lib/magazine/getMagazineData.ts:168-186`
- **Logic:** Prefers "Meru" project for demo, otherwise first published post
- **Gap:** No dynamic ranking based on engagement or signals

### Reframing as Lenses — ⚠️ **Partially Possible**

**Current State:**
- Editorial categories are **static taxonomy** (stored in database)
- Editions are **pre-computed collections** (denormalized `projectIds[]`)
- Magazine page is **static feed** (fetches published posts)

**Could Be Reframed:**
- ✅ Editorial categories → **lens definitions** (query filters)
- ✅ Editorial assignments → **lens results** (computed on-demand)
- ❌ Editions → **still need pre-computation** (but could be cached queries)

**Gap:** No dynamic "lens" system that queries the project graph on-demand based on:
- Room type
- Product category
- Style tags
- Location

---

## 7️⃣ Gaps & Missing Primitives

### What Is Missing

#### **1. Component-Level Search**
- **Gap:** Search only returns projects/products/users, not images/tags/rooms
- **Impact:** Cannot search for "kitchen images with brass fixtures"
- **Required:** New search endpoint that returns `ProjectImage`, `ProductTag`, `Room` with project context

#### **2. Component-Level Deep-Linking**
- **Gap:** URL params exist (`?image={id}`, `?tag={id}`) but highlighting not fully implemented
- **Impact:** Cannot share direct links to specific images or tags
- **Required:** 
  - URL param parsing in project page
  - Scroll-to and highlight logic in `MediaSection`
  - Share button that generates component URLs

#### **3. Component-Level Engagement Signals**
- **Gap:** `ContextSignal` attaches to `projectId`/`productId`, not `imageId`/`tagId`/`roomId`
- **Impact:** Cannot detect which specific components drive engagement
- **Required:** 
  - Extend `ContextSignal` to include `imageId?`, `tagId?`, `roomId?`, `skeletonItemId?`
  - Update signal logging to capture component context

#### **4. Progressive Enrichment UX**
- **Gap:** No system to nudge designers when demand exists
- **Impact:** AI-detected components remain unconfirmed, high-engagement images remain untagged
- **Required:**
  - Demand detection (aggregate `ContextSignal` by component)
  - Nudge generation (create "pending actions" when threshold met)
  - Inbox extension (beyond handoffs)
  - Confirm/dismiss UI (reuse SkeletonItem pattern)

#### **5. Editorial Lenses (Dynamic Projections)**
- **Gap:** Editorial categories are static taxonomy, not dynamic queries
- **Impact:** Cannot create new "lenses" without database changes
- **Required:**
  - Lens definition system (query builders for room/product/style/location)
  - On-demand lens computation (query project graph, cache results)
  - Lens URL structure (`/lens/kitchens?style=modern&location=nyc`)

#### **6. Unified Context Field**
- **Gap:** Context scattered across `description`, `name`, `notes`, `moodKeywords`
- **Impact:** Cannot search or filter by unified context
- **Required:**
  - Optional `context` (JSON) field on `ProjectImage`, `ProductTag`, `Room`
  - Or: unified `Annotation` model that can attach to any component

### What Already Exists but Is Underutilized

#### **1. SkeletonItem System**
- **Status:** Fully implemented but only used for "living projects" feature
- **Leverage:** Extend to all AI-detected components (rooms, styles, products)
- **Pattern:** `UNCONFIRMED` → `CONFIRMED`/`DISMISSED` workflow

#### **2. ContextSignal System**
- **Status:** Comprehensive but not used for component-level insights
- **Leverage:** Aggregate signals by `imageId`/`tagId` to detect demand
- **Pattern:** `logSignal()` already supports `meta` JSON for extensibility

#### **3. EditorialCategory/Assignment**
- **Status:** Infrastructure exists but categories are manually created
- **Leverage:** Auto-generate categories from project content (rooms, products, styles)
- **Pattern:** `EditorialAssignment` already links projects to categories with scores

#### **4. URL Params for Deep-Linking**
- **Status:** Params exist but highlighting not implemented
- **Leverage:** Complete the deep-linking implementation
- **Pattern:** `?image={id}&tag={id}` already parsed in project page

---

## 8️⃣ Risk Flags & Architectural Warnings

### Areas Where Implementation Could Go Wrong

#### **1. Turning Lenses into Static Taxonomy**
- **Risk:** Creating new `EditorialCategory` records for each lens (e.g., "kitchens-in-nyc")
- **Warning:** Lenses should be **computed queries**, not stored categories
- **Solution:** Use query builders (e.g., `{ roomType: "KITCHEN", city: "NYC" }`) and cache results

#### **2. Forcing Designers to Over-Annotate**
- **Risk:** Requiring tags/descriptions/rooms for all images
- **Warning:** Progressive enrichment should be **demand-driven**, not mandatory
- **Solution:** Only nudge when engagement signals exceed threshold

#### **3. Breaking Attribution or Ownership**
- **Risk:** Component-level search could surface images/tags without project context
- **Warning:** Always include `project` and `designer` in component results
- **Solution:** Enforce `isPublic` checks and include attribution in search results

#### **4. Fragmenting "One Truth" into Multiple Copies**
- **Risk:** Storing component metadata in multiple places (e.g., `ProjectImage.room` vs `Room.name`)
- **Warning:** Keep single source of truth (e.g., `Room` model, not string field)
- **Solution:** Migrate `ProjectImage.room` (string) to `ProjectImage.roomId` (relation)

#### **5. Over-Engineering the Component Model**
- **Risk:** Creating a generic "Component" model that abstracts everything
- **Warning:** Existing models (`ProjectImage`, `ProductTag`, `Room`) are sufficient
- **Solution:** Add component-level search/engagement without changing schema

---

## 📦 Required Output Format

### Current System Map

**Component Models:**
- ✅ `Project` — addressable, searchable
- ✅ `ProjectImage` — partially addressable, not searchable
- ✅ `Room` — partially addressable, not searchable
- ✅ `ProductTag` — partially addressable, not searchable
- ✅ `SkeletonItem` — not addressable, not searchable (AI-detected)
- ✅ `Selection` — not addressable, not searchable

**Search Systems:**
- ✅ Project search (project-level only)
- ✅ Product search (catalog-level only)
- ❌ Component search (does not exist)

**Engagement Systems:**
- ✅ `ContextSignal` (project/product-level)
- ⚠️ Component-level signals (partial — no `imageId`/`tagId`)

**AI Systems:**
- ✅ `SkeletonItem` (fully implemented)
- ✅ Editorial scoring (automated)
- ❌ Room inference (does not exist)
- ❌ Tag suggestions (does not exist)

**Editorial Systems:**
- ✅ `EditorialCategory` (static taxonomy)
- ✅ `EditorialAssignment` (project-to-category mapping)
- ✅ `EditorialEdition` (pre-computed collections)
- ⚠️ Magazine page (static feed, not dynamic lens)

### Leverage Points (What We Can Reuse Immediately)

1. **SkeletonItem system** — extend to all AI-detected components
2. **ContextSignal system** — add component-level fields (`imageId`, `tagId`, `roomId`)
3. **URL params** — complete deep-linking implementation
4. **EditorialCategory** — reframe as lens definitions (query builders)
5. **DesignerInbox** — extend beyond handoffs to progressive enrichment nudges

### Hard Gaps (What Truly Doesn't Exist Yet)

1. **Component-level search API** — new endpoint that returns images/tags/rooms with project context
2. **Component-level engagement tracking** — extend `ContextSignal` schema
3. **Progressive enrichment engine** — demand detection + nudge generation
4. **Dynamic lens system** — on-demand queries over project graph (not static taxonomy)
5. **Unified context field** — optional JSON field on components for annotations

### UX Sensitivities (Where Designers Could Feel Friction)

1. **Inbox overload** — too many nudges → extend `DesignerInbox` with filtering/grouping
2. **Tagging fatigue** — requiring tags for all images → only nudge on high-engagement images
3. **Context fragmentation** — notes in multiple places → unified `context` JSON field
4. **Deep-link confusion** — broken links if components deleted → graceful fallbacks
5. **Search noise** — component results without project context → always include attribution

### Readiness Scores

#### **Contextual Search: 40%**
- ✅ Component models exist
- ✅ URL params exist (partial)
- ❌ Component-level search missing
- ❌ Deep-linking not fully implemented

#### **AI Component Detection: 70%**
- ✅ `SkeletonItem` system fully implemented
- ✅ Status workflow (`UNCONFIRMED`/`CONFIRMED`/`DISMISSED`)
- ⚠️ Only used for "living projects" feature
- ❌ Not extended to rooms/styles/products

#### **Progressive Enrichment: 20%**
- ✅ `ContextSignal` system exists
- ✅ SkeletonItem confirm/dismiss pattern exists
- ❌ Demand detection missing
- ❌ Nudge generation missing
- ❌ Inbox extension missing

#### **Editorial Lenses: 50%**
- ✅ `EditorialCategory` infrastructure exists
- ✅ `EditorialAssignment` mapping exists
- ✅ Magazine page exists
- ❌ Static taxonomy (not dynamic queries)
- ❌ Pre-computed editions (not on-demand)

---

## 🧠 Framing Reminder (Preserved)

This audit confirms Folio's architecture aligns with the **"one project graph, many contextual projections"** mental model:

- ✅ **One truth:** Projects, images, tags, rooms are stored once
- ✅ **Many projections:** Editorial categories, magazine editions, search results are computed views
- ⚠️ **Gap:** Projections are currently **static** (pre-computed) rather than **dynamic** (on-demand queries)

**Next Steps (Not Implemented):**
1. Define minimum viable component (likely `ProjectImage` with tags)
2. Define how demand wakes it up (aggregate `ContextSignal` by component)
3. Define how enrichment compounds value (confirmed tags → better search → more engagement)

---

**End of Audit Report**









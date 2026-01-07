# Living Project Attachment Points Audit

**Date**: 2025-01-27  
**Scope**: Read-only audit of Folio codebase attachment points for living/non-static editorial projects, room-level engagement gravity, skeleton tagging, and dynamic feed entry images.

---

## Canonical Objects

### Project Model
**File**: `prisma/schema.prisma` (Lines 201-254)  
**Model**: `Project`  
**Table**: `projects`

The Project model is the authoritative container for all project data. It includes:
- Public visibility: `isPublic Boolean @default(false)`, `publishedAt DateTime?`
- Engagement counters: `views Int @default(0)`, `saves Int @default(0)`, `shares Int @default(0)`
- Metadata: `title String`, `description String?`, `stage ProjectStage`, `status String`
- Relations to images, rooms, selections, and editorial content

**Key Relations**:
- `images ProjectImage[]` - All images attached to the project
- `rooms Room[]` - All rooms in the project
- `post ProjectPost?` - One-to-one editorial/post relationship
- `editorialAssignments EditorialAssignment[]` - Editorial categorization

### ProjectPost Model (Editorial)
**File**: `prisma/schema.prisma` (Lines 920-942)  
**Model**: `ProjectPost`  
**Table**: `project_posts`

The ProjectPost model represents published editorial content tied to a project. It is the canonical model for magazine/editorial pages.

**Fields**:
- `status PostStatus @default(DRAFT)` - Controls publication state (DRAFT | REVIEW | PUBLISHED | ARCHIVED)
- `variant PostVariant @default(PROJECT_FEATURE)` - Content type classification
- `slug String @unique` - URL slug for published articles
- `heroAssetId String?` - Optional reference to ProjectImage ID for hero image
- `publishedAt DateTime?` - Publication timestamp
- `expandedBlocks Json?` - Editorial content blocks (lead, body, etc.)

**Relation**:
- `project Project @relation(...) @unique` - One-to-one with Project

**Usage**: Used to render published project pages at `/project/[id]` when `status === "PUBLISHED"` and `isPublic === true`. The magazine feed (`/magazine`) queries `ProjectPost` with `status: "PUBLISHED"` to build editorial listings.

---

## Rooms

### Room Model
**File**: `prisma/schema.prisma` (Lines 393-405)  
**Model**: `Room`  
**Table**: `rooms`

Rooms are first-class database entities, not UI-only groupings.

**Fields**:
- `id String @id`
- `name String` - Room name (e.g., "Kitchen", "Living Room")
- `type String?` - Optional room type (KITCHEN, BATH, LIVING, BEDROOM, DINING, OFFICE, ENTRY)
- `projectId String` - Foreign key to Project

**Relations**:
- `project Project @relation(...)` - Parent project
- `selections Selection[]` - Products/selections assigned to this room
- `quotes Quote[]` - Quotes associated with this room

**Image Assignment**: Images are assigned to rooms via the `ProjectImage.room String?` field (line 260), which stores the room ID or room name as a string. This is a loose coupling - images reference rooms by string match, not foreign key.

**Reality**: Rooms are first-class models but optional - projects can exist without rooms. Images can reference rooms via the `room` field on ProjectImage, but this is not enforced by foreign key constraints.

---

## Images

### ProjectImage Model
**File**: `prisma/schema.prisma` (Lines 256-271)  
**Model**: `ProjectImage`  
**Table**: `project_images`

The ProjectImage model stores all uploaded photos for projects.

**Fields**:
- `id String @id`
- `url String` - Image URL (stored in Supabase Storage or external)
- `name String?` - Optional image name/description
- `room String?` - Optional room ID or name (string, not foreign key)
- `displayOrder Int?` - Optional ordering for image galleries
- `projectId String` - Foreign key to Project

**Relations**:
- `project Project @relation(...)` - Parent project
- `tags ProductTag[]` - Product tags placed on this image (legacy tagging system)
- `projectTags ProjectProductTag[]` - Project-level product tags (newer system)
- `threeDAssets ThreeDAsset[]` - Generated 3D assets from this image

**Image Selection for Feed**: Hero image selection logic is in `src/lib/magazine/getMagazineData.ts` (Lines 192-199):
1. If `ProjectPost.heroAssetId` is set, find matching ProjectImage by ID
2. Otherwise, use first ProjectImage from `project.images` array
3. Otherwise, use any ProjectImage with a valid URL

**Metadata Storage**: Image metadata (generation prompts, context) is stored in the `name` field as JSON stringified data (see `src/app/api/projects/[id]/rooms/[roomId]/gen-image/route.ts` Line 111).

---

## Product Tagging

### ProductTag Model (Legacy - Image-Based)
**File**: `prisma/schema.prisma` (Lines 325-338)  
**Model**: `ProductTag`  
**Table**: `product_tags`

Legacy tagging system that anchors tags to specific images with coordinates.

**Fields**:
- `id String @id`
- `x Float` - X coordinate on image (0-1 normalized)
- `y Float` - Y coordinate on image (0-1 normalized)
- `productId String` - Foreign key to Product
- `imageId String` - Foreign key to ProjectImage

**Relations**:
- `image ProjectImage @relation(...)` - Image where tag is placed
- `product Product @relation(...)` - Tagged product

**Tag Placement**: Tags store explicit x,y coordinates relative to image dimensions. Tags are tied to images, not rooms directly.

### ProjectProductTag Model (Newer - Project-Level)
**File**: `prisma/schema.prisma` (Lines 1161-1182)  
**Model**: `ProjectProductTag`  
**Table**: `project_product_tags`

Newer tagging system that allows project-level product associations without requiring image coordinates.

**Fields**:
- `id String @id`
- `projectId String` - Foreign key to Project
- `projectImageId String?` - Optional foreign key to ProjectImage (nullable)
- `productId String` - Foreign key to Product
- `x Float?` - Optional X coordinate
- `y Float?` - Optional Y coordinate
- `roomName String?` - Optional room name context
- `notes String?` - Optional tag notes

**Relations**:
- `project Project @relation(...)` - Parent project
- `projectImage ProjectImage? @relation(...)` - Optional image association
- `product Product @relation(...)` - Tagged product

**Reality**: Both tagging systems coexist. ProductTag is image-specific with required coordinates. ProjectProductTag is more flexible - can be project-level, image-level, or room-level via `roomName` field. Skeleton tags would likely use ProjectProductTag with `x`/`y` initially null and `projectImageId` set, then convert to confirmed tags by populating coordinates.

---

## Engagement Signals

### Project-Level Engagement Counters
**File**: `prisma/schema.prisma` (Lines 210-212)  
**Model**: `Project`  
**Fields**: `views Int @default(0)`, `saves Int @default(0)`, `shares Int @default(0)`

Aggregate counters stored directly on Project model. These are incremented via application logic (no separate tracking table for individual project interactions).

### EngagementEvent Model (Event/Product-Level)
**File**: `prisma/schema.prisma` (Lines 506-519)  
**Model**: `EngagementEvent`  
**Table**: `engagement_events`

Event-level engagement tracking for products and events, not projects directly.

**Fields**:
- `id String @id`
- `userId String` - Foreign key to User
- `eventId String` - Foreign key to Event (required)
- `productId String?` - Optional foreign key to Product
- `verb String` - Action type (e.g., "VIEW_EVENT", "SAVE_PRODUCT", "RSVP")
- `meta Json?` - Optional metadata
- `createdAt DateTime` - Timestamp

**Relations**:
- `event Event @relation(...)` - Associated event
- `product Product? @relation(...)` - Optional product
- `user User @relation(...)` - User who performed action

**Limitation**: EngagementEvent is tied to Events, not Projects. Project-level engagement is tracked via direct counters on Project model, not individual event records.

### Room-Level Engagement

**Reality**: There is no explicit room-level engagement tracking in the schema. Engagement is tracked at:
- Project level (views, saves, shares counters)
- Event/Product level (EngagementEvent table)

Room-level engagement gravity would need to be computed from:
1. Project-level counters (total engagement on project)
2. Image-level data (`ProjectImage.room` field to filter images by room)
3. Selection-level data (`Selection.roomId` to filter products by room)
4. Potential aggregation of EngagementEvent records filtered by product associations to rooms

---

## Feed Construction

### Magazine Page Route
**File**: `src/app/magazine/page.tsx`  
**Route**: `/magazine`

Main feed route that redirects from `/feed`. Fetches data via `getMagazineData()` helper.

### Data Fetching
**File**: `src/lib/magazine/getMagazineData.ts`  
**Function**: `getMagazineData(editionSlug, userId?)`

**Query Logic** (Lines 67-157):
1. Queries `ProjectPost` with `status: "PUBLISHED"`
2. Includes `project` relation with:
   - `images` (with `tags` relation for products)
   - `designer` (for author attribution)
   - `productTags` (ProjectProductTag relations)
   - `selections` (for product references)
3. Orders by `publishedAt DESC`, takes top 40

### Hero Image Selection
**File**: `src/lib/magazine/getMagazineData.ts` (Lines 192-199)

Hero image selection follows this fallback chain:
1. If `ProjectPost.heroAssetId` is set, find `ProjectImage` where `id === heroAssetId`
2. Otherwise, use `project.images[0]` (first image by creation order)
3. Otherwise, find any `ProjectImage` with non-empty `url`

**Image Ordering**: Images are fetched with `orderBy: { createdAt: "asc" }` (Line 112), so first image is oldest by creation date.

### Mosaic Grid Items
**File**: `src/lib/magazine/getMagazineData.ts` (Lines 279-299)

Mosaic items use the same image selection logic as hero - `heroAssetId` if present, otherwise first project image.

**Thumbnail Selection**: The `imageUrl` field on `MagazineMosaicItem` comes from the same hero image selection logic applied to each post/project.

### Entry Image Swapping

**Current Behavior**: Feed entry images are selected from `project.images` array based on `heroAssetId` or first image fallback.

**Attachment Point**: To swap entry images dynamically without refactoring:
1. Update `ProjectPost.heroAssetId` to point to desired `ProjectImage.id`
2. Or reorder `ProjectImage` records (requires changing `createdAt` timestamps or using `displayOrder` field, though displayOrder is not currently used in feed queries)

**Display Order Field**: `ProjectImage.displayOrder Int?` exists (Line 261) but is not used in feed image selection queries. This field could be leveraged to control feed thumbnails without changing `heroAssetId`.

---

## Summary

### Living Projects
- **Control Object**: `ProjectPost` with `status: "PUBLISHED"` and `Project.isPublic: true`
- **Update Mechanism**: Modify `ProjectPost.expandedBlocks Json?` field to update editorial content without republishing
- **Attachment Point**: `ProjectPost` relation to `Project` is one-to-one, so content updates flow through `ProjectPost` model

### Room-Level Engagement Gravity
- **Data Sources**: 
  - `Project.views`, `Project.saves`, `Project.shares` (project-level aggregates)
  - `ProjectImage.room String?` (image-to-room associations)
  - `Selection.roomId String?` (product-to-room associations)
- **Computation**: Aggregate project engagement metrics filtered by room associations from images/selections
- **Attachment Point**: No dedicated room engagement table exists - gravity would be computed from existing data

### Skeleton Tagging
- **Model**: `ProjectProductTag` (flexible tagging system)
- **Fields**: `x Float?`, `y Float?`, `projectImageId String?`, `roomName String?`
- **Conversion Path**: Create tags with `x`/`y` null → user confirms → populate coordinates
- **Attachment Point**: `ProjectProductTag` model supports nullable coordinates and optional image association

### Dynamic Feed Entry Images
- **Current Selection**: `ProjectPost.heroAssetId` or first `ProjectImage` by creation order
- **Swapping Mechanism**: 
  - Update `ProjectPost.heroAssetId` to point to different `ProjectImage.id`
  - Or leverage `ProjectImage.displayOrder` (currently unused in feed queries)
- **Attachment Point**: Feed image selection in `getMagazineData.ts` Lines 192-199 - modify fallback logic or query ordering









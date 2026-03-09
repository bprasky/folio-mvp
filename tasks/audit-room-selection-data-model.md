# Audit Part 2: Room/Selection Data Model — Is It Dead Code?

## Context

Follow-up to the `/designer/projects/[id]` page audit. The founder needs to know whether the Room/Selection data model powering that page is legacy dead code or actively used infrastructure.

---

## 1. What data model does it use?

### Room model (`prisma/schema.prisma`, lines 565–578)
```
Table: rooms
- id          String    (UUID PK)
- name        String    (required)
- type        String?   (KITCHEN, BATH, LIVING, BEDROOM, DINING, OFFICE, ENTRY)
- projectId   String    (FK → Project, onDelete: Cascade)
- createdAt   DateTime
- updatedAt   DateTime
Relations: project, selections[], quotes[], skeletonItems[]
```

### Selection model (`prisma/schema.prisma`, lines 580–620)
```
Table: selections
- id               String    (UUID PK)
- photo            String?   (image URL)
- vendorName       String?
- productName      String?
- colorFinish      String?
- notes            String?
- phaseOfUse       String?   (design, ordering, installation)
- source           String    (default: "upload")
- roomId           String?   (FK → Room, nullable, onDelete: Cascade)
- projectId        String    (FK → Project, onDelete: Cascade)
- quantity         Int?
- unitPrice        Decimal?  (10,2)
- vendorProductId  String?
- vendorRepId      String?   (FK → User)
- productUrl       String?
- specSheetUrl     String?
- specSheetFileName String?
- tags             String[]
- slotKey          String?   (room template slot: 'countertop', 'sofa')
- uiMeta           Json?
- productTagId     String?   (@unique, FK → ProductTag, onDelete: SetNull)
Relations: project, room?, vendorRep?, productTag?, quotes[], cachedProductLinks[], selectionHistory[], presentationProducts[]
```

### Key relationships
- **Project → Room[]** — one-to-many, cascade delete
- **Room → Selection[]** — one-to-many, cascade delete
- **Selection → Project** — required direct link (selections can exist without a room)
- **Selection → ProductTag?** — one-to-one optional link back to the image tag that created it

---

## 2. How does this differ from the main workspace data model?

### ProjectImage model (`prisma/schema.prisma`, lines 353–392)
```
Table: project_images
- id, url, name, displayOrder
- room          String?   ← STRING field, NOT a FK to Room model
- projectId     String    (FK → Project)
- aiTags, aiColors, aiMaterials, aiSpaces (AI classification fields)
Relations: project, tags (ProductTag[]), momentIndex?
```

### The overlap

| Concept | Room/Selection model | ProjectImage model |
|---------|---------------------|--------------------|
| Room grouping | Room table with FK | `room` string field on ProjectImage |
| Product data | Selection fields (vendorName, productName, etc.) | ProductTag → Product |
| Image storage | Selection.photo | ProjectImage.url |
| AI enrichment | None | aiTags, aiMaterials, aiSpaces, aiClassification |

**These are two parallel systems that are partially bridged:**
- `Selection.productTagId` links a Selection back to a ProductTag on a ProjectImage
- `src/lib/tagging/matchImageToRoom.ts` matches ProjectImages to Rooms by name/AI-space
- `src/lib/tagging/resolveSelectionToProduct.ts` resolves Selections → Products

**They are NOT the same data viewed differently.** They are separate tables with a thin bridge via `productTagId`. A project can have ProjectImages without Selections and vice versa.

---

## 3. Is Room/Selection data used anywhere else?

**THIS IS THE CRITICAL FINDING: Room/Selection is NOT dead code. It is deeply integrated.**

### Editorial/Interview system — HEAVY usage
- `src/lib/editorial/getInterviewQuestions.ts:281-333` — fetches project rooms, organizes interview questions by roomId/roomName/roomType
- `src/lib/editorial/processInterviewAnswers.ts:276-310` — includes room context from selections when processing answers
- `src/lib/editorial/roomPacing.ts` — room-aware budget computation for interview flow
- `src/lib/interview/spatialFlow.ts` — room-based spatial flow for interviews
- Interview questions are bucketed per-room (RoomQuestionsGroup interface)

### Board generation — uses Selections
- `src/lib/boards/prompt.ts:47-55` — fetches room + selections for AI board image generation prompts, orders by slotKey

### Product tagging — bidirectional bridge
- `src/lib/tagging/resolveSelectionToProduct.ts` — resolves Selection → vendorProductId → CachedProduct → Product
- `src/lib/tagging/ensureProductForSelection.ts` — creates Product records from Selection data
- `src/lib/tagging/matchImageToRoom.ts` — matches ProjectImages to Room records

### Spec sheet export — core data source
- `src/app/api/export-spec-sheet/route.ts:21-31` — fetches `rooms: { include: { selections } }`, groups by room

### Approvals system
- `src/lib/approvals.ts:22-29` — room readiness metrics
- `src/lib/approvals.ts:352-363` — batch room lookup

### Permissions/authorization
- `src/lib/permissions.ts:109,135,159` — vendor permission checks via Selection
- `src/lib/authz/access.ts:59` — Selection view authorization

### Main workspace (`/project/[id]`) — YES, it reads these tables
- `src/app/project/[id]/DesignerBoard.tsx` — room-based board view
- `src/app/project/[id]/DesignerBoardRoom.tsx` — individual room display
- `src/app/project/[id]/EditProductDrawer.tsx:58-137` — fetches/edits selections
- `src/app/project/[id]/SaveSelectionToProjectModal.tsx` — saves selections to room
- `src/app/project/[id]/SpecsQuotesPanel.tsx` — displays specs/quotes from selections
- `src/app/project/[id]/OverviewTab.tsx` — overview includes rooms
- `src/app/project/[id]/ExportSpecModal.tsx:77,89` — exports per-room or all-rooms

### Vendor system
- `src/app/api/vendor/projects/[id]/rooms/route.ts` — vendor room view
- `src/app/api/vendor/projects/[id]/selections/route.ts` — vendor selection endpoints

### Living/Skeleton system
- `src/lib/living/rooms.ts:102` — bulk-creates rooms during skeleton generation

### API surface (20+ endpoints)
Room CRUD: `/api/designer/projects/[id]/rooms/`, `/api/projects/[id]/rooms/`
Selection CRUD: `/api/selections/`, `/api/designer/projects/[id]/selections/`, `/api/vendor/projects/[id]/selections/`

---

## 4. Query to check data volume

```sql
-- Room count
SELECT COUNT(*) as room_count FROM rooms;

-- Selection count
SELECT COUNT(*) as selection_count FROM selections;

-- Projects with both ProjectImages AND Rooms
SELECT
  p.id,
  p.title,
  (SELECT COUNT(*) FROM rooms r WHERE r."projectId" = p.id) as room_count,
  (SELECT COUNT(*) FROM selections s WHERE s."projectId" = p.id) as selection_count,
  (SELECT COUNT(*) FROM project_images pi WHERE pi."projectId" = p.id) as image_count
FROM projects p
WHERE EXISTS (SELECT 1 FROM rooms r WHERE r."projectId" = p.id)
   OR EXISTS (SELECT 1 FROM project_images pi WHERE pi."projectId" = p.id)
ORDER BY p."createdAt" DESC
LIMIT 20;

-- Selections linked to ProductTags (bridge usage)
SELECT COUNT(*) as bridged_selections
FROM selections
WHERE "productTagId" IS NOT NULL;
```

---

## 5. What was this trying to be? — Revised assessment

### Previous audit was WRONG to call this "legacy"

The Room/Selection model is **the structured product data layer** for Folio. It is the system of record for:
- **What products are in each room** (Selection = a product choice with vendor, price, spec sheet)
- **Room organization** (Room = a named space within a project)
- **Spec sheet generation** (export grouped by room)
- **Interview context** (questions organized by room, answers enriched with selection data)
- **Board generation** (selections feed AI image prompts)
- **Vendor collaboration** (vendor endpoints read/write selections)

ProjectImage is the **visual media layer** — raw photos with AI tagging. Selection is the **structured product data layer** — vendor, product, price, spec sheet. They serve different purposes and are partially bridged.

### What the `/designer/projects/[id]` page is

It's the **room/selection management UI** — the place where designers:
1. Create rooms for a project
2. Add product selections to rooms (via camera capture or upload)
3. Manage vendor/product details per selection
4. Export spec sheets

### What's unique here (not available in main workspace)

| Feature | `/designer/projects/[id]` | `/project/[id]` |
|---------|--------------------------|-----------------|
| Add Room | Yes (action button) | No direct "add room" UI |
| Camera capture → Selection | Yes | No |
| Room template system | Yes (ROOM_TEMPLATES) | References templates but no creation UI |
| Toggle public/private | Yes | Not visible |
| Room grid with selection thumbnails | Yes | Board view shows rooms differently |

The main workspace's DesignerBoard/DesignerBoardRoom components display room data **read-only style**, but this page is the **write/management UI** for that data.

### Recommendation (revised)

**This is NOT dead code on a dead data model.** The Room/Selection model is live infrastructure used by editorial, interviews, boards, specs, vendors, and permissions.

However, the `/designer/projects/[id]` page has a **UX problem**:
1. It's a separate route from the main workspace, creating user confusion
2. Its functionality (room/selection CRUD) should arguably be accessible from within the main workspace tabs
3. The designer dashboard "Manage" button sends users here instead of to the tabbed workspace

**Options:**
1. **Merge into main workspace** — move room/selection management into a tab or panel within `/project/[id]` (e.g., the existing boards/overview tab), then redirect `/designer/projects/[id]` → `/project/[id]`
2. **Keep but clarify** — rename the link from "Manage" to "Manage Rooms & Selections" and add navigation between the two views
3. **Redirect with escape hatch** — default to `/project/[id]?view=media` but add a "Room Manager" link in the workspace that opens this page

# Component Unification Phase 1 Plan (Read-Only, Build-Ready)

**Date:** 2025-01-27  
**Audit Type:** READ-ONLY — Exact File Locations & Minimal Changes  
**Objective:** Unify component systems via ComponentRef contract and bidirectional room-skeleton flow

---

## Task A: Make Rooms Backfill Read Skeletons (Bidirectional)

### Exact Function Location

**File:** `src/lib/living/rooms.ts`  
**Function:** `ensureRoomsForProject` (lines 11-85)  
**Exact Section:** Lines 47-53 (collects `imageRoomNames`)

**Current Code:**
```47:53:src/lib/living/rooms.ts
    // Collect distinct room names from images (non-null, non-empty)
    const imageRoomNames = new Set<string>();
    project.images.forEach((img) => {
      if (img.room && img.room.trim()) {
        imageRoomNames.add(img.room.trim());
      }
    });
```

### SkeletonItem Availability

**Current Prisma Query:** Lines 17-35  
**Missing:** `skeletonItems` relation is **NOT included** in the select

**Current Select:**
```17:35:src/lib/living/rooms.ts
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        intent: true,
        livingEnabled: true,
        livingOptOut: true,
        images: {
          select: {
            room: true,
          },
        },
        rooms: {
          select: {
            name: true,
          },
        },
      },
    });
```

**Minimal Prisma Include Needed:**
```typescript
skeletonItems: {
  select: {
    roomName: true,
    status: true, // Only include UNCONFIRMED/CONFIRMED (exclude DISMISSED)
  },
  where: {
    status: { in: ['UNCONFIRMED', 'CONFIRMED'] }, // Only active skeletons
  },
}
```

**Rationale:** 
- Only need `roomName` field (not full skeleton data)
- Filter by status to exclude dismissed skeletons
- Minimal overfetch (just room names, not bboxes/labels)

### Proposed Minimal Change

**Location:** `src/lib/living/rooms.ts:17-35` (Prisma query) and `47-53` (room name collection)

**Change 1: Add skeletonItems to Prisma select**
```typescript
// After line 33 (rooms select), add:
skeletonItems: {
  select: {
    roomName: true,
  },
  where: {
    status: { in: ['UNCONFIRMED', 'CONFIRMED'] },
  },
},
```

**Change 2: Collect room names from BOTH sources**
```typescript
// Replace lines 47-53 with:
// Collect distinct room names from images (non-null, non-empty)
const imageRoomNames = new Set<string>();
project.images.forEach((img) => {
  if (img.room && img.room.trim()) {
    imageRoomNames.add(img.room.trim());
  }
});

// Collect distinct room names from skeletons (non-null, non-empty)
const skeletonRoomNames = new Set<string>();
project.skeletonItems.forEach((skeleton) => {
  if (skeleton.roomName && skeleton.roomName.trim()) {
    skeletonRoomNames.add(skeleton.roomName.trim());
  }
});

// Merge both sets (union)
const allRoomNames = new Set([...imageRoomNames, ...skeletonRoomNames]);
```

**Change 3: Update roomsToCreate calculation**
```typescript
// Replace line 59 with:
const roomsToCreate = Array.from(allRoomNames).filter(
  (name) => !existingRoomNames.has(name)
);
```

**Change 4: Update default room logic**
```typescript
// Replace line 64 with:
if (project.rooms.length === 0 && allRoomNames.size === 0) {
  roomsToCreate.push("General");
}
```

### Conflict Policy

**Scenario:** Image has `room="Kitchen"`, skeleton has `roomName="Living Room"`

**Recommended Policy: Human Wins (Safest Default)**
- **Prefer:** `ProjectImage.room` (human-assigned) over `SkeletonItem.roomName` (AI-detected)
- **Rationale:** Designer explicitly set image room; skeleton is suggestion
- **Implementation:** When merging sets, if both exist and differ, use image room name

**Where to Store AI Suggestion:**
- **Option 1:** Log to console (non-blocking)
  ```typescript
  if (imageRoomNames.has(name) && skeletonRoomNames.has(name) && imageRoomNames.has(name) !== skeletonRoomNames.has(name)) {
    console.log(`[ensureRoomsForProject] Room conflict: image="${name}" vs skeleton="${skeletonRoomNames.get(name)}" - using image`);
  }
  ```
- **Option 2:** Store in `ProjectImage` metadata (future enhancement)
  - Add optional `suggestedRoomName` field (not in schema yet)
- **Option 3:** Store in `SkeletonItem` (already has `roomName` — no change needed)
  - Skeleton keeps its suggestion; room backfill uses image preference

**Recommended:** Option 1 (console log) for Phase 1. Option 3 (skeleton keeps suggestion) is already true.

---

## Task B: ComponentRef Contract (Minimal)

### Query Param Parsing Location

**File:** `src/app/project/[id]/page.tsx`  
**Line:** 24 (searchParams type definition)  
**Line:** 113 (currentView determination)  
**Lines:** 229-230 (passed to MediaSection)

**Current Code:**
```24:24:src/app/project/[id]/page.tsx
  searchParams: { view?: string; image?: string; tag?: string; room?: string };
```

```229:231:src/app/project/[id]/page.tsx
            highlightImageId={searchParams.image}
            highlightTagId={searchParams.tag}
```

### Proposed Minimal Component Param Format

**Format:** `component={type}:{id}`

**Examples:**
- `component=image:abc-123`
- `component=tag:def-456`
- `component=skeleton:ghi-789`
- `component=room:jkl-012`

**Parsing Logic (to add after line 117):**
```typescript
// Parse component param
const componentParam = searchParams.component as string | undefined;
let componentType: 'image' | 'tag' | 'skeleton' | 'room' | null = null;
let componentId: string | null = null;

if (componentParam) {
  const [type, id] = componentParam.split(':');
  if (type && id && ['image', 'tag', 'skeleton', 'room'].includes(type)) {
    componentType = type as any;
    componentId = id;
  }
}
```

### Component Resolution Map

#### **component=image:{id}**
- **Tab/View:** `media` (force `view=media`)
- **Scroll-to:** Image container with `id="image-{id}"`
- **Highlight:** Image border (already exists in `MediaSection.tsx:433`)

**Files:**
- `src/app/project/[id]/page.tsx:113` — force view to 'media' if componentType === 'image'
- `src/app/project/[id]/MediaSection.tsx:164` — scroll-to already exists

#### **component=tag:{id}**
- **Tab/View:** `media` (force `view=media`)
- **Scroll-to:** Parent image container (need to fetch tag's imageId)
- **Highlight:** Tag dot with pulse animation (already exists in `MediaSection.tsx:456-497`)

**Files:**
- `src/app/project/[id]/page.tsx:113` — force view to 'media'
- `src/app/project/[id]/page.tsx:31-81` — need to fetch tag's imageId in Prisma query
- `src/app/project/[id]/MediaSection.tsx:157` — update to handle tag-only (not requiring imageId)

**Gap:** Currently requires both `image` and `tag` params. Need to fetch tag → image lookup.

#### **component=skeleton:{id}**
- **Tab/View:** `boards` (force `view=boards`)
- **Scroll-to:** Image container in `DesignerBoardRoom` (need ref)
- **Highlight:** Skeleton bbox via `SkeletonOverlay` (already exists, line 77)

**Files:**
- `src/app/project/[id]/page.tsx:113` — force view to 'boards'
- `src/app/project/[id]/page.tsx:244-249` — pass `highlightSkeletonId` to `DesignerBoard`
- `src/app/project/[id]/DesignerBoard.tsx:293-304` — pass to `DesignerBoardRoom`
- `src/app/project/[id]/DesignerBoardRoom.tsx:171` — state exists, need to accept prop
- `src/app/project/[id]/DesignerBoardRoom.tsx:611-631` — need image ref for scroll-to

**Gap:** No scroll-to logic, no refs on image containers.

#### **component=room:{id}**
- **Tab/View:** `boards` (force `view=boards`)
- **Scroll-to:** Room section header (need ref)
- **Highlight:** Room border/background (not implemented)

**Files:**
- `src/app/project/[id]/page.tsx:113` — force view to 'boards'
- `src/app/project/[id]/DesignerBoard.tsx:285-306` — need to pass `highlightRoomId`
- `src/app/project/[id]/DesignerBoardRoom.tsx` — need room highlighting UI

**Gap:** No room highlighting, no scroll-to logic.

---

## Task C: Skeleton Deep-Linking

### Skeleton State Management

**File:** `src/app/project/[id]/DesignerBoardRoom.tsx`  
**Lines:** 169-172 (state declarations)
- `selectedSkeleton: string | null` (line 169)
- `skeletonPanelOpen: boolean` (line 170)
- `highlightSkeletonId: string | null` (line 171)
- `skeletonToConfirm: any` (line 172)

**Current Flow:**
1. `handleSkeletonClick` (line 186) — sets `selectedSkeleton`, opens panel
2. `handleInboxSkeletonClick` (line 210) — sets `highlightSkeletonId`, opens panel
3. Comment on line 214: "Scroll to image (would need refs in real implementation)"

### Missing for Scroll-to

**1. Image Container Refs**
- **Location:** `src/app/project/[id]/DesignerBoardRoom.tsx:611-631`
- **Current:** Image containers have no `id` or `ref`
- **Need:** Add `id="image-{img.id}"` or `ref` for scroll-to

**Current Code:**
```611:631:src/app/project/[id]/DesignerBoardRoom.tsx
            {projectImages.map((img) => (
              <div
                key={img.id}
                className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group cursor-pointer"
              >
                <Image
                  src={img.url}
                  alt={img.name || 'Project image'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
                <SkeletonOverlay
                  imageId={img.id}
                  imageUrl={img.url}
                  enabled={skeletonEnabled}
                  onSkeletonClick={handleSkeletonClick}
                  highlightSkeletonId={highlightSkeletonId}
                />
              </div>
            ))}
```

**2. Scroll-to Logic**
- **Location:** `src/app/project/[id]/DesignerBoardRoom.tsx:210-226` (`handleInboxSkeletonClick`)
- **Current:** Comment says "would need refs"
- **Need:** Add `useEffect` to scroll when `highlightSkeletonId` changes

**3. Skeleton-to-Image Lookup**
- **Location:** `src/app/project/[id]/DesignerBoardRoom.tsx:190-199` (fetch skeleton details)
- **Current:** Fetches all skeletons, finds by ID
- **Need:** Extract `projectImageId` from skeleton, scroll to that image

### Proposed Minimal Ref/ID Strategy

**Strategy 1: Use `id` attribute (Simplest)**
- Add `id="image-{img.id}"` to image container div (line 612)
- Use `document.getElementById()` for scroll-to (like `MediaSection.tsx:164`)

**Strategy 2: Use React refs (More React-idiomatic)**
- Create `useRef<Map<string, HTMLDivElement>>()` to store image refs
- Map image IDs to DOM elements
- Use `ref.current.get(imageId)?.scrollIntoView()`

**Recommended:** Strategy 1 (simpler, matches existing pattern in `MediaSection.tsx`)

### Implementation Plan

**Step 1: Add image container IDs**
- **File:** `src/app/project/[id]/DesignerBoardRoom.tsx:612`
- **Change:** Add `id={`image-${img.id}`}` to div

**Step 2: Add scroll-to logic**
- **File:** `src/app/project/[id]/DesignerBoardRoom.tsx` (after line 226)
- **Add:** `useEffect` hook:
```typescript
useEffect(() => {
  if (highlightSkeletonId) {
    // Fetch skeleton to get imageId
    fetch(`/api/living/skeleton?projectId=${projectId}`)
      .then(res => res.json())
      .then(data => {
        const items = data.items || [];
        const skeleton = items.find((s: any) => s.id === highlightSkeletonId);
        if (skeleton?.projectImageId) {
          setTimeout(() => {
            const element = document.getElementById(`image-${skeleton.projectImageId}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 300);
        }
      })
      .catch(err => console.error('Failed to fetch skeleton for scroll:', err));
  }
}, [highlightSkeletonId, projectId]);
```

**Step 3: Accept highlightSkeletonId prop**
- **File:** `src/app/project/[id]/DesignerBoardRoom.tsx:90-100` (props interface)
- **Add:** `highlightSkeletonId?: string | null` to `DesignerBoardRoomProps`
- **File:** `src/app/project/[id]/DesignerBoardRoom.tsx:154-164` (function signature)
- **Add:** `highlightSkeletonId` to destructured props
- **Change:** Use prop value instead of state (or merge with state)

**Step 4: Pass from DesignerBoard**
- **File:** `src/app/project/[id]/DesignerBoard.tsx:78-84` (props interface)
- **Add:** `highlightSkeletonId?: string | null` to `DesignerBoardProps`
- **File:** `src/app/project/[id]/DesignerBoard.tsx:293-304` (DesignerBoardRoom usage)
- **Add:** `highlightSkeletonId={highlightSkeletonId}` prop

**Step 5: Pass from ProjectPage**
- **File:** `src/app/project/[id]/page.tsx:244-249` (DesignerBoard usage)
- **Add:** Extract skeleton ID from `component` param, pass as prop

---

## Task D: Output Required

### Exact Files + Line Ranges Involved

#### **Task A: Room Backfill**
1. `src/lib/living/rooms.ts:17-35` — Prisma query (add skeletonItems)
2. `src/lib/living/rooms.ts:47-53` — Room name collection (merge image + skeleton)
3. `src/lib/living/rooms.ts:59` — roomsToCreate calculation (use merged set)
4. `src/lib/living/rooms.ts:64` — Default room logic (use merged set)

#### **Task B: ComponentRef Contract**
1. `src/app/project/[id]/page.tsx:24` — searchParams type (add `component?: string`)
2. `src/app/project/[id]/page.tsx:113-117` — view determination (force view based on component type)
3. `src/app/project/[id]/page.tsx:117` (after) — component parsing logic (new)
4. `src/app/project/[id]/page.tsx:229-230` — MediaSection props (add component props)
5. `src/app/project/[id]/page.tsx:244-249` — DesignerBoard props (add component props)
6. `src/app/project/[id]/MediaSection.tsx:155-175` — highlight handling (update for component param)
7. `src/app/project/[id]/DesignerBoard.tsx:78-84` — props interface (add highlightSkeletonId)
8. `src/app/project/[id]/DesignerBoard.tsx:293-304` — DesignerBoardRoom usage (pass highlightSkeletonId)

#### **Task C: Skeleton Deep-Linking**
1. `src/app/project/[id]/DesignerBoardRoom.tsx:90-100` — props interface (add highlightSkeletonId prop)
2. `src/app/project/[id]/DesignerBoardRoom.tsx:154-164` — function signature (accept prop)
3. `src/app/project/[id]/DesignerBoardRoom.tsx:171` — state (use prop or merge with state)
4. `src/app/project/[id]/DesignerBoardRoom.tsx:612` — image container (add `id` attribute)
5. `src/app/project/[id]/DesignerBoardRoom.tsx:226` (after) — scroll-to useEffect (new)

### Minimal Change List (No Code Yet, But Precise)

#### **Change Set A: Room Backfill Bidirectional**
1. **Add skeletonItems to Prisma query** (`rooms.ts:17-35`)
   - Add `skeletonItems` select with `roomName` only, filtered by status
2. **Merge room name collection** (`rooms.ts:47-53`)
   - Create `skeletonRoomNames` set
   - Merge with `imageRoomNames` into `allRoomNames`
3. **Update roomsToCreate** (`rooms.ts:59`)
   - Use `allRoomNames` instead of `imageRoomNames`
4. **Update default room logic** (`rooms.ts:64`)
   - Use `allRoomNames.size` instead of `imageRoomNames.size`

#### **Change Set B: ComponentRef Parsing**
1. **Add component param to searchParams type** (`page.tsx:24`)
   - Add `component?: string` to type definition
2. **Parse component param** (`page.tsx:117` after)
   - Extract `type` and `id` from `component={type}:{id}`
   - Validate type is one of: `image`, `tag`, `skeleton`, `room`
3. **Force view based on component type** (`page.tsx:113-117`)
   - If `componentType === 'image' || 'tag'` → force `view='media'`
   - If `componentType === 'skeleton' || 'room'` → force `view='boards'`
4. **Pass component props to views** (`page.tsx:229-230`, `244-249`)
   - Extract IDs from component param
   - Pass as `highlightImageId`, `highlightTagId`, `highlightSkeletonId`, `highlightRoomId`

#### **Change Set C: Skeleton Scroll-to**
1. **Add image container IDs** (`DesignerBoardRoom.tsx:612`)
   - Add `id={`image-${img.id}`}` to image container div
2. **Add scroll-to useEffect** (`DesignerBoardRoom.tsx:226` after)
   - Watch `highlightSkeletonId` prop/state
   - Fetch skeleton to get `projectImageId`
   - Scroll to image container using `document.getElementById`
3. **Accept highlightSkeletonId prop** (`DesignerBoardRoom.tsx:90-100`, `154-164`)
   - Add to props interface
   - Accept in function signature
   - Use prop value (or merge with existing state)
4. **Pass prop through DesignerBoard** (`DesignerBoard.tsx:78-84`, `293-304`)
   - Add to props interface
   - Pass to DesignerBoardRoom

### Recommended Implementation Order (3-5 Steps Max)

#### **Step 1: Room Backfill Bidirectional** (Foundation)
- **Files:** `src/lib/living/rooms.ts`
- **Changes:** Add skeletonItems to query, merge room name collection
- **Risk:** Low (read-only addition, backward compatible)
- **Test:** Verify rooms created from skeletons when images don't have room names

#### **Step 2: ComponentRef Parsing** (Contract)
- **Files:** `src/app/project/[id]/page.tsx`
- **Changes:** Parse `component` param, force view, extract IDs
- **Risk:** Low (additive, doesn't break existing `?image=` and `?tag=` params)
- **Test:** Verify `?component=image:abc` works, `?component=skeleton:def` forces boards view

#### **Step 3: Skeleton Deep-Linking** (Scroll-to)
- **Files:** `src/app/project/[id]/DesignerBoardRoom.tsx`, `DesignerBoard.tsx`
- **Changes:** Add image IDs, scroll-to logic, prop passing
- **Risk:** Medium (requires prop threading through 3 components)
- **Test:** Verify `?component=skeleton:abc` scrolls to image and highlights skeleton

**Optional Step 4: Tag Deep-Linking Enhancement**
- **Files:** `src/app/project/[id]/page.tsx`, `MediaSection.tsx`
- **Changes:** Fetch tag's imageId when only tag ID provided
- **Risk:** Low (enhances existing tag highlighting)
- **Test:** Verify `?component=tag:abc` works without requiring `?image=xyz`

**Optional Step 5: Room Deep-Linking**
- **Files:** `src/app/project/[id]/DesignerBoard.tsx`, `DesignerBoardRoom.tsx`
- **Changes:** Add room highlighting, scroll-to room section
- **Risk:** Low (new feature, doesn't affect existing)
- **Test:** Verify `?component=room:abc` highlights and scrolls to room

### Risks and "Don't Do This Yet" Warnings

#### **⚠️ Schema Migrations — DON'T DO YET**
- **Risk:** Changing `ProjectImage.room` from string to relation (`roomId`)
- **Warning:** Requires migration, data migration script, and updates to all code that reads/writes `room`
- **Defer:** Phase 2 or later — current dual storage (string + relation) works for Phase 1

#### **⚠️ Lens System — DON'T DO YET**
- **Risk:** Building dynamic lens queries before ComponentRef is stable
- **Warning:** Lenses should use ComponentRef format, but wait until contract is proven
- **Defer:** Phase 2 — focus on deep-linking first

#### **⚠️ Component Search Endpoint — DON'T DO YET**
- **Risk:** Building search before ComponentRef contract is finalized
- **Warning:** Search results should return ComponentRef format, but contract may evolve
- **Defer:** Phase 2 — get deep-linking working first

#### **⚠️ Progressive Enrichment — DON'T DO YET**
- **Risk:** Building nudge system before demand detection is proven
- **Warning:** Enrichment should use ComponentRef in telemetry, but wait for signal aggregation
- **Defer:** Phase 2 — focus on bidirectional flow first

#### **✅ Safe to Do Now**
- Room backfill reading skeletons (read-only addition)
- ComponentRef parsing (additive, doesn't break existing)
- Skeleton scroll-to (UI enhancement, no schema changes)
- Tag/image deep-linking enhancement (extends existing)

#### **⚠️ Edge Cases to Handle**
1. **Skeleton deleted before scroll-to:** Check skeleton exists before scrolling
2. **Image deleted but skeleton exists:** Graceful fallback (don't scroll, show error)
3. **Component param malformed:** Validate format, ignore if invalid
4. **Room name conflicts:** Use human preference (image.room) over AI (skeleton.roomName)
5. **Multiple skeletons on same image:** Scroll to image, highlight all (or first matching)

---

## Summary

**Total Files to Modify:** 5
- `src/lib/living/rooms.ts` (Task A)
- `src/app/project/[id]/page.tsx` (Task B, C)
- `src/app/project/[id]/DesignerBoard.tsx` (Task C)
- `src/app/project/[id]/DesignerBoardRoom.tsx` (Task C)
- `src/app/project/[id]/MediaSection.tsx` (Task B — optional enhancement)

**Total Lines Changed:** ~50-70 lines (additions + modifications)

**Implementation Time Estimate:** 2-4 hours (with testing)

**Risk Level:** Low (all changes are additive, backward compatible)

**Dependencies:** None (no schema changes, no new packages)

---

**End of Phase 1 Plan**









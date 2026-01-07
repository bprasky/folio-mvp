# Living Project System - Implementation Status

**Date**: 2025-01-27  
**Status**: Core Scaffold Complete ✅ (8/9 deliverables)

---

## ✅ Completed Deliverables

### 1. Schema Updates (Prisma) ✅
- **Status**: Complete
- **Files Modified**: `prisma/schema.prisma`
- **Changes**:
  - ✅ Added `ProjectTimeline` enum (PAST, ACTIVE, FUTURE)
  - ✅ Added `SkeletonStatus` enum (UNCONFIRMED, CONFIRMED, DISMISSED)
  - ✅ Added `SkeletonCreatedBy` enum (AI, HUMAN)
  - ✅ Added fields to `Project`: `intent`, `livingEnabled`, `livingOptOut`
  - ✅ Created `SkeletonItem` model with full relations
  - ✅ Added `dynamicHeroUpdatedAt` to `ProjectPost`
- **Migration**: SQL migration files created and applied
- **Prisma Client**: Regenerated successfully

### 2. Documentation ✅
- **Status**: Complete
- **Files Created**:
  - ✅ `docs/living-project-scaffold.md` - Full implementation documentation
  - ✅ `docs/living-project-audit.md` - Existing codebase audit
  - ✅ `docs/living-project-migration.sql` - Database migration SQL
  - ✅ `docs/living-project-mark-migration-complete.sql` - Migration tracking SQL

### 3. Project Intent UI ✅
- **Status**: Complete
- **Files Modified**:
  - ✅ `src/components/ProjectCreationModal.tsx` - Added intent selector (Past/Active/Future)
  - ✅ `src/app/api/projects/normalizeCreatePayload.ts` - Added intent field validation
  - ✅ `src/app/api/projects/route.ts` - Added intent field to project creation
- **UI**: Professional selector added to project creation flow with clear labels

### 4. Skeleton Generation Pipeline ✅
- **Status**: Complete
- **Files Created**:
  - ✅ `src/lib/living/skeleton.ts` - Core skeleton generation logic
- **Features**:
  - ✅ Deterministic stub generator (seeded RNG)
  - ✅ Creates 3-8 skeleton items per image
  - ✅ Feature flag gated (`NEXT_PUBLIC_FOLIO_SKELETON_TAGS`)
  - ✅ Only generates for PAST projects
  - ✅ Non-blocking (wrapped in try-catch)
- **Integration**: Hooked into image upload routes:
  - ✅ `src/app/api/projects/[id]/images/route.ts`
  - ✅ `src/app/api/projects/[id]/rooms/[roomId]/gen-image/route.ts`

### 5. Skeleton Overlay UI ⚠️
- **Status**: Pending (Not Started)
- **Reason**: Requires integration with existing image tagging UI patterns
- **Backend APIs**: ✅ Ready (see #8)
- **Next Steps**: Build UI component showing skeleton boxes with confirmation modal

### 6. Room Gravity Computation ✅
- **Status**: Complete
- **Files Created**:
  - ✅ `src/lib/living/gravity.ts` - Room gravity scoring system
- **Features**:
  - ✅ v1 scoring algorithm: `imageCount * 1.0 + confirmedTagCount * 2.0`
  - ✅ `computeProjectRoomGravity()` - Returns scored room list
  - ✅ `pickFeatureRoomForProjectPost()` - Selects highest-score room
  - ✅ Feature flag gated (`NEXT_PUBLIC_FOLIO_ROOM_GRAVITY`)
  - ✅ Respects project-level toggles

### 7. Dynamic Hero Asset Updater ✅
- **Status**: Complete
- **Files Created**:
  - ✅ `src/lib/living/applyDynamicHero.ts` - Hero asset update logic
- **Features**:
  - ✅ Updates `ProjectPost.heroAssetId` based on room gravity
  - ✅ 7-day guardrail (prevents too-frequent updates)
  - ✅ Writes to `expandedBlocks.living` metadata
  - ✅ Feature flag gated (`NEXT_PUBLIC_FOLIO_DYNAMIC_FEED_ENTRY`)
  - ✅ Only updates PUBLISHED posts

### 8. API Routes ✅
- **Status**: Complete
- **Files Created**:
  - ✅ `src/app/api/living/skeleton/route.ts` - GET skeletons for image/project
  - ✅ `src/app/api/living/skeleton/confirm/route.ts` - Confirm skeleton as product/label
  - ✅ `src/app/api/living/skeleton/dismiss/route.ts` - Dismiss skeleton
  - ✅ `src/app/api/admin/living/apply-dynamic-hero/route.ts` - Admin dynamic hero update
- **Security**: ✅ All routes enforce project ownership/admin access
- **Features**:
  - ✅ Skeleton confirmation creates `ProjectProductTag`
  - ✅ Auto-triggers dynamic hero update on confirmation
  - ✅ Proper error handling and validation

### 9. Safety Checks & Feature Flags ✅
- **Status**: Complete
- **Implemented**:
  - ✅ All skeleton operations wrapped in try-catch (non-blocking)
  - ✅ API routes enforce authorization
  - ✅ Feature flags checked in all relevant places
  - ✅ Skeleton queries only in authenticated contexts
- **Feature Flags** (all default OFF):
  - ✅ `NEXT_PUBLIC_FOLIO_LIVING_PROJECTS`
  - ✅ `NEXT_PUBLIC_FOLIO_SKELETON_TAGS`
  - ✅ `NEXT_PUBLIC_FOLIO_ROOM_GRAVITY`
  - ✅ `NEXT_PUBLIC_FOLIO_DYNAMIC_FEED_ENTRY`

---

## 📋 Implementation Summary

### Files Created (8)
1. `src/lib/living/skeleton.ts`
2. `src/lib/living/gravity.ts`
3. `src/lib/living/applyDynamicHero.ts`
4. `src/app/api/living/skeleton/route.ts`
5. `src/app/api/living/skeleton/confirm/route.ts`
6. `src/app/api/living/skeleton/dismiss/route.ts`
7. `src/app/api/admin/living/apply-dynamic-hero/route.ts`
8. `docs/living-project-scaffold.md`

### Files Modified (5)
1. `prisma/schema.prisma` - Schema additions
2. `src/components/ProjectCreationModal.tsx` - Intent selector
3. `src/app/api/projects/route.ts` - Intent field
4. `src/app/api/projects/normalizeCreatePayload.ts` - Intent validation
5. `src/app/api/projects/[id]/images/route.ts` - Skeleton generation hook
6. `src/app/api/projects/[id]/rooms/[roomId]/gen-image/route.ts` - Skeleton generation hook

### Database Changes
- ✅ 3 new enum types
- ✅ 3 new columns on `projects` table
- ✅ 1 new `skeleton_items` table
- ✅ 1 new column on `project_posts` table
- ✅ All foreign keys and indexes created

---

## ⏭️ Next Steps

### Immediate
1. ✅ Database migration - **COMPLETE**
2. ✅ Prisma client regeneration - **COMPLETE**
3. ⏳ Set feature flags in `.env` (when ready to test)
4. ⏳ Test skeleton generation on image upload

### Remaining Work
1. **Skeleton Overlay UI** (Deliverable 5)
   - Design overlay component showing skeleton boxes
   - Create confirmation modal/side panel
   - Integrate with existing image tagging UI
   - Wire up to existing API routes

2. **Testing & Validation**
   - Test skeleton generation with PAST projects
   - Test skeleton confirmation flow
   - Test room gravity computation
   - Test dynamic hero updates
   - Verify feature flags work correctly

3. **Future Enhancements** (Post-scaffold)
   - Replace stub skeleton generator with real CV/SAM integration
   - Enhance room gravity algorithm with engagement signals
   - Add A/B testing for dynamic hero selection
   - Implement living content refresh workflows

---

## 🔒 Safety Guarantees

All safety requirements met:
- ✅ No breaking changes (all additive)
- ✅ Public pages never expose skeletons
- ✅ Feature flags default to OFF
- ✅ Skeleton generation failures don't block uploads
- ✅ All API routes protected with authorization
- ✅ Backwards compatible with existing projects

---

## 📊 Completion Status

**Overall: 8/9 deliverables complete (89%)**

- ✅ Schema & Migration
- ✅ Documentation  
- ✅ Project Intent UI
- ✅ Skeleton Generation (backend)
- ⚠️ Skeleton Overlay UI (pending)
- ✅ Room Gravity
- ✅ Dynamic Hero Updates
- ✅ API Routes
- ✅ Safety Checks

**Core plumbing: 100% complete**  
**UI integration: Pending (backend ready)**









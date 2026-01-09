# Folio Codebase Audit Summary
**Date**: January 9, 2026
**Purpose**: Pre-implementation audit for Vendor Tiers, Collaboration Stories, Features, Magazine Page, and Editions

---

## 1. Schema Findings

### Enums

| Enum Name | Values |
|-----------|--------|
| Role | ADMIN, VENDOR, DESIGNER, HOMEOWNER, GUEST |
| AccountStatus | PENDING, APPROVED, REJECTED |
| OrgType | VENDOR, DESIGN_FIRM, MANUFACTURER, SHOWROOM, CONTRACTOR |
| OrgUserRole | OWNER, ADMIN, MANAGER, MEMBER, VIEWER |
| EventType | PANEL, PRODUCT_REVEAL, HAPPY_HOUR, LUNCH_AND_LEARN, INSTALLATION, EXHIBITION, BOOTH, PARTY, MEAL, TOUR, AWARDS, WORKSHOP, KEYNOTE, OTHER, FESTIVAL, LAUNCH, CEU, LUNCH_LEARN, PRODUCT_KNOWLEDGE |
| ProjectType | UNSPECIFIED, RESIDENTIAL, COMMERCIAL, HOSPITALITY, HEALTHCARE, EDUCATION, OFFICE, RETAIL, INDUSTRIAL, OTHER |
| BudgetBand | UNSPECIFIED, LOW, MID, HIGH, LUXURY |
| BookingStatus | REQUESTED, CONFIRMED, DECLINED, CANCELLED |
| EventStatus | DRAFT, PUBLISHED, ARCHIVED |
| EventWeight | ANCHOR, FLEX, BACKFILL |
| SponsorshipTier | FREE, SPONSORED, PREMIUM |
| ProjectStage | concept, schematic, design_development, cd_pre_spec, spec_locked, in_procurement, install |
| ClientType | RESIDENTIAL, COMMERCIAL |
| QuoteStatus | DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED |
| ParticipantSide | DESIGNER, VENDOR |
| ParticipantRole | OWNER, EDITOR, VIEWER |
| PostStatus | DRAFT, REVIEW, PUBLISHED, ARCHIVED |
| PostVariant | PROJECT_FEATURE, MATERIAL_STUDY, METHOD, DESIGNER_PROFILE, EVENT_ESSAY |
| ProjectModuleType | ARTICLE, STORY, SHORT_VIDEO, LONG_VIDEO, GALLERY, BOARD, TIMELINE |
| EditorialInterviewStatus | IN_PROGRESS, COMPLETED, PUBLISHED |
| AtelierOwnerType | DESIGNER, VENDOR |
| AtelierNodeType | STYLE, ROOM_TYPE, MATERIAL, VENDOR, PRODUCT_CATEGORY, COLOR_CLUSTER, BEHAVIOR |
| AtelierRelationType | PROJECT_ROOM_FOCUS, FREQUENT_VENDOR, PREFERS, STYLE_MATERIAL, STYLE_COLOR |
| AtelierSignalSourceType | PROJECT, SELECTION, SAVE, TAG, INTERVIEW, BEHAVIOR |
| ImportSourceType | PRESENTATION, WEBSITE, BULK_IMAGES |
| ImportSessionStatus | PROCESSING, ANALYZED, READY_FOR_REVIEW, COMPLETED, FAILED |
| PendingTagStatus | UNREVIEWED, CONFIRMED, CORRECTED, DISMISSED |
| WaitlistType | VENDOR, INDIVIDUAL |

### Organization Model
- **Existing fields**: id, name, type (OrgType), description, website, logo, createdAt, updatedAt
- **Relations**: users, designerProjects, vendorProjects, projectParticipants
- **Tier-related fields**: **NONE**
- **Gaps for vendor tiers**: Need to add `tier`, `subscriptionStatus`, `subscriptionStartDate`, `subscriptionEndDate`, `features` (JSON for tier-specific capabilities)

### Event Model
- **Full structure**: id, title, description, location, city, state, country, startDate, endDate, isPublic, isApproved, requiresApproval, rejectionNotes, createdById, parentFestivalId, imageUrl, allowChat, allowReshare, capacity, eventTypes[], designStyles[], eventTags[], isSponsored, promotionTier, isFestival, etc.
- **Can derive Features from**: Yes - Events have enough metadata (eventTypes, isSponsored, promotionTier) but would need editorial curation layer for "Features" content

### Editorial Models

**EditorialEdition** (schema line 937-950):
```
id, slug (unique), title, intro, categoryIds[], projectIds[],
publishedAt, metrics (Json), createdAt, updatedAt
```
- Simple flat structure
- **No "above the fold" concept**
- **No hierarchy (e.g., week/season editions)**

**ProjectPost** (schema line 846-868):
```
id, projectId (unique), status (PostStatus), variant (PostVariant),
slug (unique), heroAssetId, excerpt, keywords[],
expandedBlocks (Json), provenance (Json), credits (Json),
publishedAt, createdAt, updatedAt
```
- Has editorialAssignments relation

**EditorialAssignment** (schema line 920-935):
```
id, projectId, editorialId, categoryId, editorialScore, createdAt
```
- Links projects to categories with scores

**EditorialCategory** (schema line 907-918):
```
id, type, label, centroid (vector), createdAt
```
- Types: style, region, theme

### Interview System

**EditorialInterview** exists (schema line 958-973):
```
id, projectId (unique), status (EditorialInterviewStatus),
selectedQuestionIds[], createdAt, updatedAt, answers[]
```

**EditorialInterviewAnswer** (schema line 975-1008):
```
id, interviewId, questionId, isFollowUp, parentAnswerId,
answerText, audioUrl, inputModality,
confidenceScore, inferredPriorities[], softConstraints[],
linkedImageId, linkedProductId, questionSource, aiClassificationAttribute
```
- **Can extend for Collaboration Stories**: Partially - current model is project-bound. Would need new model for standalone collaboration interviews or modification to make projectId optional.

### Missing for Implementation

**Models needed**:
- `VendorTier` or tier fields on Organization
- `VendorSubscription` for subscription tracking
- `CollaborationStory` (if standalone from projects)
- `Feature` model (if Events aren't sufficient)
- `EditorialDraft` (referenced in code but **missing from schema!**)

**Enums needed**:
- `VendorTierLevel` (e.g., FREE, STARTER, PRO, ENTERPRISE)
- `CollaborationStoryStatus`

**Fields to add**:
- Organization: tier, subscriptionStatus, featureAccess
- EditorialEdition: aboveFoldProjectIds[], hierarchy fields

### ⚠️ Critical Schema/Code Drift

`src/lib/editorial/getOrCreateEditorialDraft.ts` (line 45) references `prisma.editorialDraft` but **EditorialDraft model does not exist in schema**. This will cause runtime errors.

---

## 2. Authorization Findings

### File Structure
- Single file: `src/lib/authz/access.ts`

### Current Patterns
- **Permission check style**: Function-based with async project lookup
- **Key functions**:
  - `getProjectAccess(userId, projectId)` - Returns role/side or null
  - `assertProjectView(userId, projectId)` - Throws if no access
  - `assertProjectEdit(userId, projectId)` - Checks OWNER/EDITOR role
  - `assertSelectionView/Edit` - Selection-level access

**Example usage**:
```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
await assertProjectView(session.user.id, projectId);
```

### Vendor Permissions
- **Currently implemented**: Partial - via ParticipantSide.VENDOR check
- **How checked**: Project participant lookup, side comparison
- **Tier checks**: **NONE** - No tier-based authorization exists

### Recommended Pattern for New Features
- Follow existing `assert*` function pattern
- Add `assertVendorTier(userId, requiredTier)` helper
- Add `getVendorTier(orgId)` lookup function
- Use middleware pattern for route-level tier gates

---

## 3. Editorial System Findings

### Scheduler (`src/lib/editorial/scheduler.ts`)
- **Current jobs**: `runEditorialEditionScheduler()`, `runDailyEditorialScheduler()`
- **Cadence**: On-demand (no cron setup visible)
- **Edition generation logic**:
  1. Finds unpublished edition drafts
  2. Gathers qualifying projects per category
  3. Requires minimum projects (schedulerMinimum: 3)
  4. Generates AI title/intro via GPT-4o-mini
  5. Publishes when average score ≥ 0.75

### Constants (`src/lib/editorial/constants.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| EDITORIAL_SCORE_WEIGHTS.engagement | 0.4 | Weight for engagement score |
| EDITORIAL_SCORE_WEIGHTS.vendorDiversity | 0.2 | Weight for vendor variety |
| EDITORIAL_SCORE_WEIGHTS.styleUniqueness | 0.2 | Weight for style uniqueness |
| EDITORIAL_SCORE_WEIGHTS.trendAlignment | 0.2 | Weight for trend matching |
| EDITORIAL_CURATOR_THRESHOLDS.highScore | 0.75 | Threshold for high-quality |
| EDITORIAL_CURATOR_THRESHOLDS.clusterMinimum | 5 | Min projects for edition |
| EDITORIAL_CURATOR_THRESHOLDS.schedulerMinimum | 3 | Min for auto-publish |
| EDITORIAL_CURATOR_THRESHOLDS.editionPublishScore | 0.75 | Min score to publish |

### Curation Logic (`src/lib/editorial/curator.ts`)
- **editorialScore calculation**:
  - Engagement (40%): views, likes, saves with log scaling
  - Vendor Diversity (20%): unique vendors/products
  - Style Uniqueness (20%): vector distance from style centroids
  - Trend Alignment (20%): market signal momentum

- **Thresholds for elevation**: editorialScore ≥ 0.75 for high quality
- **Edition population**: Category-based grouping with style/region matching

### Above the Fold
- **Currently implemented**: NO
- Magazine page has hero section but no distinct "above fold" data structure

### Gaps for Implementation
- **Features**: No Feature model - would need to extend Events or create new
- **Magazine page**: Exists at `/magazine` with hero + mosaic zones, needs "above fold" separation
- **Edition hierarchy**: No season/week concept in current model

---

## 4. Interview System Findings

### Current Implementation
- **Location**: `src/lib/editorial/` (no separate interviews directory)
- **Models used**: EditorialInterview, EditorialInterviewAnswer
- **Question structure**: Static BASE_QUESTIONS + AI-generated contextual questions

### Question Generation (`src/lib/editorial/getInterviewQuestions.ts`)
- 5 base questions (brief, process, highlight, aesthetic, emotion)
- Contextual questions from `generateContextualQuestions.ts`
- AI classification-based questions on colors, materials, styles, mood, elements
- Questions interleaved: base, contextual, base, contextual...

### AI Generation (`src/lib/editorial/generateContextualQuestions.ts`)
- **Follow-up questions generated**: Yes
- **How**: Template-based with AI classification data from project images
- Uses templates like "What drew you to {value} for this space?"

### Applicability to Collaboration Stories
- **Can reuse**:
  - Question templates and generation logic
  - Answer processing and verification system
  - Voice profile analysis
- **Need to build new**:
  - Multi-party interview coordination
  - Vendor/designer pairing model
  - Story compilation from dual perspectives
- **Recommended approach**: Create `CollaborationInterview` model linking designer + vendor, reuse answer processing

---

## 5. Feed System Findings

### Current Implementation
- **Main query file**: `src/lib/feed/getPublishedProjectPosts.ts`
- **Sorting**: `publishedAt desc` (chronological)
- **Filtering**: `status: "PUBLISHED"` only
- **Weighting**: None in query - mosaic weighting in components

### Feed Files
- `getPublishedProjectPosts.ts` - Main editorial posts
- `getTrendingProjects.ts` - Top 3 recent posts
- `getAISuggestions.ts` - AI recommendations
- `getUpdatesCarousel.ts` - Updates/news
- `getRecentProjectModules.ts` - Project modules

### Magazine Page
- **Route exists**: Yes, `src/app/magazine/page.tsx`
- **Current implementation**:
  - Two-zone layout (hero + mosaic)
  - Uses `getMagazineData()` for data
  - `MagazineEditionCarousel` for edition switching
  - `MagazineMosaicGrid` for content grid

### Gaps for Implementation
- **Mosaic weighting**: Done in `FlowMosaic.tsx` component, not server-side
- **Above fold separation**: Not implemented - hero is just first item
- **Filter tabs**: Edition carousel exists, but no category/type filtering

---

## 6. API Route Findings

### Patterns Used
- **Authentication check**: `getServerSession(authOptions)` → check `session?.user?.id`
- **Authorization check**: Import and call `assertProjectView/Edit` from `@/lib/authz/access`
- **Error handling**: try/catch with specific error messages
- **Response format**: `NextResponse.json({ data })` or `NextResponse.json({ error }, { status })`
- **Validation**: Inline checks, some Zod usage

**Example pattern** (from `src/app/api/posting/project/[projectId]/route.ts`):
```typescript
export async function GET(request: NextRequest, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await assertProjectView(session.user.id, params.projectId);
    // ... business logic
    return NextResponse.json({ data });
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Vendor Routes
- **Existing routes**: `/api/vendor/projects/`, `/api/admin/vendors/`, `/api/admin/vendor-analytics/`
- **Tier checks**: **NONE** currently implemented

### Editorial Routes
- **Existing routes**: `/api/posting/project/[projectId]/` with sub-routes for interview, blocks, drafts, meta, status
- **Publish flow**: Via posting routes, status updates

### Recommended Patterns for New Routes
- Follow pattern from `src/app/api/posting/project/[projectId]/route.ts`
- Add tier checks using new `assertVendorTier()` helper
- Use `export const dynamic = 'force-dynamic'` for non-cached routes

---

## 7. Component Findings

### Editorial Components
- **Existing**: `src/components/editorial/LinkedImagePreview.tsx` only
- **Block types**: Defined in expandedBlocks JSON (lead, galleryChapters)
- **Layout patterns**: Magazine-style zones

### Feed Components
- **Card components**: EventCard, UpdatesCard
- **Grid/mosaic**: FlowMosaic (weighted), EditorialFeed (sliced)
- **Slices**: Hero, Duotile, Triptych, MosaicFour

### Magazine Components
- `MagazinePage.tsx` - Orchestrator
- `MagazineHero.tsx` - Hero section
- `MagazineMosaicGrid.tsx` - Content grid
- `MagazineEditionCarousel.tsx` - Edition tabs
- `MagazineProductRail.tsx`, `EditorialProductCutoutsRail.tsx` - Product strips

### Multi-step Flows
- **Wizard pattern used**: `src/components/vendor/add-product/Wizard.tsx`
  - Step state management with useState
  - AnimatePresence for transitions
  - Progress indicator with checkmarks
  - Back/forward navigation
- **Modal pattern used**: Various modal components in vendor/actions/

### Badge Display
- **Currently exists**: NO dedicated badge component
- **Recommended approach**: Create `VendorTierBadge` component with tier-based styling

---

## 8. Configuration Findings

### Feature Flags

| Flag | Location | Purpose |
|------|----------|---------|
| NEXT_PUBLIC_POSTING_V1 | Direct env check | Enable posting feature |
| NEXT_PUBLIC_FLAG_VENDOR_NEW_DASHBOARD | flags.ts | New vendor dashboard |
| NEXT_PUBLIC_FLAG_VENDOR_AI_INSIGHTS | flags.ts | AI insights panels |
| NEXT_PUBLIC_FLAG_VENDOR_DEMO_DATA | flags.ts | Demo data for investors |
| NEXT_PUBLIC_FEATURE_VENDOR_HANDOFF | publicFlags.ts | Vendor handoff feature |
| NEXT_PUBLIC_FEATURE_VENDOR_VISITS | publicFlags.ts | Vendor visits feature |
| NEXT_PUBLIC_FOLIO_DYNAMIC_FEED_ENTRY | living/ | Dynamic feed entry |
| NEXT_PUBLIC_FOLIO_SKELETON_TAGS | living/ | Skeleton tags |

### Payment Integration
- **Current status**: None visible in schema
- **Subscription management**: Not implemented

### Recommendations
- **Feature flags needed**:
  - `NEXT_PUBLIC_FEATURE_VENDOR_TIERS`
  - `NEXT_PUBLIC_FEATURE_COLLABORATION_STORIES`
  - `NEXT_PUBLIC_FEATURE_MAGAZINE_V2`
- **Config changes needed**: Add Stripe env vars when payment implemented

---

# Final Summary

## Ready for Implementation
- Magazine page enhancement (structure exists)
- Editorial edition improvements (model exists)
- Interview flow extensions (system exists)
- Multi-step wizard patterns (proven pattern exists)

## ⚠️ Critical Issues - Requires Immediate Fix

1. **EditorialDraft model missing**: Referenced in `src/lib/editorial/getOrCreateEditorialDraft.ts` (line 45) but not in schema. Either:
   - Add model to schema and migrate
   - Remove/refactor code that references it

## Requires Schema Migration

| Priority | Change | Reason |
|----------|--------|--------|
| P0 | Add EditorialDraft model | Code references non-existent model |
| P1 | Add tier fields to Organization | Vendor Tiers feature |
| P1 | Add VendorTierLevel enum | Tier definitions |
| P2 | Add CollaborationStory model | Collaboration Stories feature |
| P2 | Add aboveFoldProjectIds to EditorialEdition | Above-fold feature |
| P3 | Add Feature model or extend Event | Features section |

## Recommended Implementation Order

1. **Fix EditorialDraft schema drift** (blocks current posting flow)
2. **Vendor Tiers** - Foundation for monetization
   - Add Organization.tier, subscriptionStatus fields
   - Add VendorTierLevel enum
   - Add assertVendorTier() authorization helper
3. **Magazine Page V2** - Enhance existing
   - Add above-fold data structure
   - Implement category filters
   - Add Features section from Events
4. **Editions Enhancement** - Build on existing
   - Add hierarchy (weekly/seasonal)
   - Implement edition scheduling cron
5. **Collaboration Stories** - New feature
   - Create CollaborationStory model
   - Extend interview system for multi-party
   - Build story compilation logic

## Questions for Product Decision

1. **EditorialDraft**: Is this a legacy model that was removed, or should it be added? The posting flow references it.
2. **Collaboration Stories**: Should these be project-bound or standalone entities?
3. **Features**: Use enhanced Events or create separate Feature model?
4. **Vendor Tiers**: What tier levels and features per tier?
5. **Payment**: Stripe integration timeline? Affects tier implementation.

---

## Key File References

| Area | Key Files |
|------|-----------|
| Schema | `prisma/schema.prisma` |
| Authorization | `src/lib/authz/access.ts` |
| Editorial Scheduler | `src/lib/editorial/scheduler.ts` |
| Editorial Constants | `src/lib/editorial/constants.ts` |
| Editorial Curation | `src/lib/editorial/curator.ts` |
| Interview Questions | `src/lib/editorial/getInterviewQuestions.ts` |
| Contextual Questions | `src/lib/editorial/generateContextualQuestions.ts` |
| Feed Data | `src/lib/feed/getPublishedProjectPosts.ts` |
| Magazine Page | `src/app/magazine/page.tsx`, `src/components/magazine/MagazinePage.tsx` |
| Mosaic Component | `src/components/feed/FlowMosaic.tsx` |
| Wizard Pattern | `src/components/vendor/add-product/Wizard.tsx` |
| Feature Flags | `src/lib/flags.ts`, `src/lib/publicFlags.ts` |
| API Pattern Example | `src/app/api/posting/project/[projectId]/route.ts` |

## Spotlight/social workflow amendment — 9 September 2026

The [founder specification revision 1.1](Folio-Spotlight-and-Social-Publishing-Spec.md) defines the next implementation: tag attribution → optional explicit spotlight → scheduled room-specific question → exact wording approval → spotlight publication → Shop/testimonial/Studio eligibility. Unresolved spotlights must be completed or explicitly deferred before parent publication. Social Studio follows draft → review → publish the social piece to Folio → export its published version; never silently publish a private parent. Vendor invitation is a separate explicit post-publication send, with no dependency on the designer's ability to publish. Existing workflows below describe earlier behavior; the [foundation audit](SPOTLIGHT_FOUNDATION_AUDIT_2026-09-09.md) records the required changes.

> ⚠️ Canonical Notice  
> This document reflects the current implemented state of the system based on a codebase audit.  
> It does not define future direction unless explicitly stated elsewhere.

## Implementation Phases

**Current State (Phase 1): Publishing-First Workflow**

The initial Folio workflow is deliberately simplified:

1. Designer uploads completed project images
2. AI generates editorial-quality layout
3. Designer reviews/edits post
4. Designer publishes to Folio
5. Designer shares to Instagram (one-click)
6. Viewers discover project on Folio
7. Engagement signals captured (saves, likes)

**What's NOT in Phase 1:**
- Full project management workspace
- Client collaboration features
- Complex product tagging workflows
- Vendor integrations
- AI rendering of unbuilt projects

**Expansion Workflows (Phase 2+)**

The detailed workflows below represent the future state built in Phases 2-3 based on designer feedback from Phase 1.

# Workflows

## Purpose

This document describes the main user workflows and business processes implemented in the system, based on observed code and routes.

## Project Creation Workflows

### Designer Project Creation

**Currently implemented paths:**

1. **Quick Create (Publish Now)**
   - Route: `/designer/create?intent=publish_now&onboard=1`
   - Creates project with `isPublic: true`, `publishedAt: now()`, `status: 'published'`
   - Auto-redirects to `/project/{id}/setup` for media/tagging
   - Component: `ProjectCreationModal` (3-step wizard)

2. **Detailed Setup**
   - Creates project with `isPublic: false`, `publishedAt: null`, `status: 'draft'`
   - Auto-redirects to `/project/{id}/setup` for media/tagging
   - Allows publishing later via "Publish" button

**Setup Wizard Steps (ProjectCreationModal):**
- Step 1: Project Details (name, description, client, category)
- Step 2: Upload Images (URL-based, room assignment, validation)
- Step 3: Tag Products (click-to-tag, product search, affiliate URL generation)

**Project Fields Observed:**
- `stage`: ProjectStage enum (default: concept)
- `projectType`: ProjectType enum (default: UNSPECIFIED)
- `clientType`: ClientType enum (default: RESIDENTIAL)
- `budgetBand`: BudgetBand enum (default: UNSPECIFIED)
- `city`, `regionState`: String? (optional)
- `intent`: ProjectTimeline enum (default: PAST)

**ProjectStage Enum Values:**
- concept (default)
- schematic
- design_development
- cd_pre_spec
- spec_locked
- in_procurement
- install

**ProjectType Enum Values:**
- UNSPECIFIED (default)
- RESIDENTIAL
- COMMERCIAL
- HOSPITALITY
- HEALTHCARE
- EDUCATION
- OFFICE
- RETAIL
- INDUSTRIAL
- OTHER

**ClientType Enum Values:**
- RESIDENTIAL (default)
- COMMERCIAL

**BudgetBand Enum Values:**
- UNSPECIFIED (default)
- LOW
- MID
- HIGH
- LUXURY

## Publishing Workflow

**Project Publishing:**
- Action: `publishProjectAction()` in `src/app/actions/projects.ts`
- Sets: `isPublic: true`, `publishedAt: now()`, `status: 'published'`
- Projects with `isPublic: true` are visible on feed
- Projects with `isPublic: false` are drafts

**Editorial Publishing (Optional):**
- Feature flag: `NEXT_PUBLIC_POSTING_V1`
- Creates `ProjectPost` in DRAFT state
- Interview workflow via `InterviewModal`
- AI generation creates `expandedBlocks` JSON
- Preview at `/designer/projects/[id]/preview`
- Publish via `PATCH /api/posting/project/[id]/status` sets `status: 'PUBLISHED'`

## Vendor Workflows

**Vendor Project Creation:**
- Vendor Rep can create projects for designers
- Projects organized into Rooms
- Selections added to rooms (products, photos, notes, prices)
- Quotes attached at selection or room/project level
- Handoff workflow: `isHandoffReady` flag, `handoffInvitedAt`, `handoffClaimedAt`

**Vendor Product Creation:**
- Wizard-based product creation (`/vendor/products/new`)
- URL scraping capability (Browserless integration)
- Product validation and publishing
- Vendor products linked via `Product.vendorId` or `Product.vendorRecordId`

**Vendor Rep Invites:**
- `PendingRepInvite` model tracks rep invitations
- Status: PENDING, CLAIMED, CANCELLED
- Token-based onboarding flow

## Event Workflows

**Event Creation:**
- Events created by users with various types (EventType enum)
- Visibility: PUBLIC, INVITE_ONLY, PRIVATE (EventVisibilityType)
- RSVP system with status: GOING, INTERESTED, DECLINED
- Event relationships tracked via EventDesignerEdge, EventVendorEdge, EventProductEdge, EventRepEdge

**Events Engine (Observed Models):**
- EventHostProfile (host memory system)
- EventInviteList (saved invite lists)
- EventRelationshipEdge (graph relationships)
- EventTargetingProfile (premium audience targeting)
- EventWorkflowJob (post-event automation)

## Product Tagging Workflow

**Image-Based Tagging:**
- ProductTag model links products to ProjectImage via x/y coordinates
- Tags created via `POST /api/tag-product-to-image`
- Tags persist to database (ProductTag table)
- Affiliate URLs auto-generated per tag
- Tags displayed as visual markers with product info on hover

**Skeleton Items:**
- SkeletonItem model for AI-detected products in images
- Status: UNCONFIRMED, CONFIRMED, DISMISSED
- Can be confirmed and linked to Product via `confirmedProductId`

## Interview/Recording Workflow

**Interview Sessions:**
- InterviewSession model for audio/video interviews
- Status flow: DRAFT → UPLOADED → TRANSCRIBING → TRANSCRIBED → EXTRACTING → EXTRACTED → READY → PUBLISHED
- Linked to Project or Product
- VendorBoostRequest can trigger interviews
- Transcript segments and quote highlights extracted
- Use cases: EDITORIAL_PULLQUOTE, PRODUCT_PAGE_INSIGHT, SOCIAL_CLIP_HOOK

## Editorial Workflow

**Editorial Drafts:**
- EditorialDraft model stores draft editorial content
- ProjectPost model for published editorial content
- Status: DRAFT, REVIEW, PUBLISHED, ARCHIVED (PostStatus enum)
- Variants: PROJECT_FEATURE, MATERIAL_STUDY, METHOD, DESIGNER_PROFILE, EVENT_ESSAY (PostVariant enum)
- Editorial assignments link projects to categories
- EditorialEdition model for curated collections

**Editorial Scheduler:**
- Daily scheduler runs editorial edition publication
- Gathers qualifying projects by category
- Generates edition copy via AI
- Publishes when thresholds met (minimum projects, average score)

## Collaboration Workflows

**Project Participants:**
- ProjectParticipant model for project-level access control
- Side: DESIGNER | VENDOR
- Role: OWNER | EDITOR | VIEWER
- Collaboration status: PENDING, ACTIVE, PAUSED, ENDED
- Spend settings for collaboration (spendEnabled, budgetCapUsd)

**Context Signals:**
- ContextSignal model tracks user actions (view, save, add_to_project, etc.)
- Used for collaboration spend attribution
- Verified signals for authenticated users
- Immutable accounting via valueUsd field

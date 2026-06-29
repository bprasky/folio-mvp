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
- Step 3: Tag Products (inline on the room-organized media page, no separate modal). Two paths on one screen: a project-level finish book or Excel drop at the top that locates and queues every product, and manual click-to-tag per photo below. Tags for each photo render in a list beside the photo with edit and delete controls.

> Audit note (`AUDIT_autotag_vision_findings.md`): the room-organized page (`MediaSection`)
> and the auto-vs-manual chooser (`MaterialsStep`) already exist; the top-of-page locate
> drop target and the per-photo tag list are the net-new pieces. The Tags step is currently
> still mounted as `ProjectCreationModal` at `/project/[id]/setup`.

**Tags step — single review surface:** The Tags step renders the same per-photo list whether tags arrive manually or from a finish book. The list is the single review surface. The standalone import verification queue is retired for the finish-schedule source and routes its results into these per-photo lists instead.

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

The Tags step renders on the existing room-organized media page. Photos stay grouped by room. The step does not navigate to a separate route.

Why a designer tags: a tag gives the interview a concrete detail to ask about, so the generated editorial returns specific instead of generic. Shoppability is secondary. The page leads with the interview benefit.

**Two paths, one screen:**

1. **Auto path (top of page, project scope).** A single drop target accepts one finish book or Excel file. It runs the parse-then-locate pipeline (see `13_IMPORT_AGENT_SPEC.md` → Finish Schedule Import) and queues a pending tag per scheduled product on the room photo where the product is found. Located products carry coordinates. Products the model cannot place queue without coordinates and prompt manual placement.
2. **Manual path (room sections, per photo).** Clicking a photo enters an inline working state for that photo only. The photo enlarges in place, the designer clicks the photo to drop a single transient pin, then searches a product or pastes a URL. The tag persists via the existing manual write path (`POST /api/tag-product-to-image`) and appears in the photo's tag list.

**Per-photo tag list:**

- Tags render beside the photo, never on it. The only mark on photography is the transient pin during active placement. This holds the photos-are-sacred rule inside the workspace.
- Each tag row shows the product, its category, a placement indicator, and edit and delete controls.
- A manually placed tag renders confirmed. An imported tag renders in a pending-confirm state and clears with a single confirm action, reusing the existing pending-tag verify path (`POST /api/import/pending-tag/[tagId]/verify`).

Tag write paths are unchanged. Manual tags use `POST /api/tag-product-to-image` with affiliate URL generation. Imported tags flow through the import pipeline and the existing verify endpoint.

**Image-Based Tagging (implemented primitives):**
- ProductTag model links products to ProjectImage via x/y coordinates
- Tags created via `POST /api/tag-product-to-image`
- Tags persist to database (ProductTag table)
- Affiliate URLs auto-generated per tag

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



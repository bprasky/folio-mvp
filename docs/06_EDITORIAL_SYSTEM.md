> ⚠️ Canonical Notice  
> This document reflects the current implemented state of the system based on a codebase audit.  
> It does not define future direction unless explicitly stated elsewhere.

# Editorial System

## Purpose

This document describes the editorial content system, including models, workflows, and data structures for published editorial content.

## Editorial Taxonomy

### Project States

**Observed in code (`prisma/schema.prisma` - Project model):**

1. **Project (Base Entity)**
   - **Fields:**
     - `isPublic`: Boolean (default: false)
     - `publishedAt`: DateTime? (nullable)
     - `status`: String (default: "active")
     - Engagement metrics: `views`, `saves`, `shares` (Int, default: 0)
   - **Creation:** Projects are created via `createProjectAction()` or `POST /api/projects`
   - **Initial State:** Created with `isPublic: false`, `publishedAt: null`, `status: "active"`
   - **Elevation to Published Project:** Manual action via `publishProjectAction()` which sets:
     - `isPublic: true`
     - `publishedAt: now()` (idempotent - only sets if null)
     - `status: 'published'`
   - **Observed in code (`src/app/actions/projects.ts:96-197`):** Manual publish action, requires owner or designer authorization

2. **Posted Project (Project with ProjectPost)**
   - **Relationship:** One-to-one with Project (`Project.post` relation is optional)
   - **Creation:** ProjectPost is created separately via:
     - `createEditorialDraft()` action (`src/app/actions/projects.ts:212-366`)
     - `POST /api/posting/project/[projectId]/init` (`src/app/api/posting/project/[projectId]/init/route.ts`)
   - **Initial State:** ProjectPost created with `status: 'DRAFT'`, `publishedAt: null`
   - **Elevation to Published Post:** Manual action via:
     - `publishEditorial()` action (`src/app/actions/projects.ts:373-436`)
     - `PATCH /api/posting/project/[projectId]/status` with `status: 'PUBLISHED'` (`src/app/api/posting/project/[projectId]/status/route.ts:420-427`)
   - **When Published:** Sets ProjectPost `status: 'PUBLISHED'`, `publishedAt: now()`, AND updates Project `isPublic: true`, `publishedAt: now()`
   - **Observed in code:** ProjectPost publishing also publishes the underlying Project

3. **Editorial Project (Project with Editorial Assignment)**
   - **Relationship:** ProjectPost can have `EditorialAssignment[]` linking to categories
   - **Creation:** EditorialAssignments created automatically when ProjectPost is generated/updated
   - **Editorial Score:** Each assignment has `editorialScore` (Float 0-1) calculated via `calculateEditorialScore()` (`src/lib/editorial/curator.ts:386-406`)
   - **Score Components (observed in code):**
     - Engagement (40%): views, likes, saves
     - Vendor diversity (20%): unique vendors/products
     - Style uniqueness (20%): embedding distance from centroids
     - Trend alignment (20%): MarketSignal momentum
   - **Elevation:** No explicit automatic elevation of individual projects based on editorial score
   - **TODO:** Editorial scores appear to be used for EditorialEdition curation, not individual project elevation. No threshold found for elevating a single project to "editorial" status based on score alone. See `src/lib/editorial/constants.ts:10-16` for thresholds used in edition publishing.

4. **Editorial Edition Project (Project included in EditorialEdition)**
   - **Relationship:** Projects included in EditorialEdition via `projectIds` array
   - **Creation:** EditorialEdition drafts created via `ensureEditionDraft()` (`src/lib/editorial/curator.ts:291-384`)
   - **Elevation to Published Edition:** Automatic via daily scheduler (`runEditorialEditionScheduler()` in `src/lib/editorial/scheduler.ts:208-264`)
   - **Thresholds (observed in code `src/lib/editorial/constants.ts:10-16`):**
     - Minimum projects: 3 (`schedulerMinimum`)
     - Average score threshold: 0.75 (`editionPublishScore`)
   - **When Published:** EditorialEdition `publishedAt` set, projects included in `projectIds` array
   - **Note:** This elevates the edition collection, not individual projects

### State Transitions

**Project → Published Project:**
- Manual elevation via `publishProjectAction()`
- Sets `isPublic: true`, `publishedAt: now()`, `status: 'published'`
- No automatic elevation based on engagement metrics observed

**Project → Posted Project:**
- Manual creation of ProjectPost (optional, not all projects have posts)
- ProjectPost starts as DRAFT
- No automatic creation observed

**Posted Project (DRAFT) → Posted Project (PUBLISHED):**
- Manual elevation via `publishEditorial()` or status API endpoint
- Sets ProjectPost `status: 'PUBLISHED'`, `publishedAt: now()`
- Also sets Project `isPublic: true`, `publishedAt: now()`

**Posted Project → Editorial Project:**
- EditorialAssignments created automatically when ProjectPost exists
- Editorial scores calculated but no explicit threshold for "editorial" status
- Status appears to be inferred via presence of EditorialAssignment records, not a distinct state field

**Editorial Projects → Editorial Edition:**
- Automatic curation via daily scheduler
- Projects with `editorialScore >= 0.75` grouped by category
- Editions published when average score >= 0.75 and minimum 3 projects

### Feed Queries

**Observed in code (`src/lib/feed/getPublishedProjectPosts.ts:28-71`):**
- Feed queries `ProjectPost` with `status: "PUBLISHED"`
- Ordered by `publishedAt: "desc"`
- Does not filter by Project.isPublic (assumes alignment)

**Observed in code (`src/server/queries/getMyProjects.ts:64-74`):**
- Published filter uses OR: `{ isPublic: true }`, `{ publishedAt: { not: null } }`, `{ status: 'published' }`
- Does not require ProjectPost to exist

**Status appears to be inferred via:** Presence of `ProjectPost.status === "PUBLISHED"` OR Project fields (`isPublic`, `publishedAt`, `status`)

## Editorial Models

### ProjectPost Model

**Table:** `project_posts`  
**Schema (from `prisma/schema.prisma`):**

- `id`: String (cuid, primary key)
- `projectId`: String (unique, foreign key to Project)
- `status`: PostStatus enum (default: DRAFT)
- `variant`: PostVariant enum (default: PROJECT_FEATURE)
- `slug`: String (unique)
- `heroAssetId`: String? (optional)
- `excerpt`: String? (optional)
- `keywords`: String[] (array, default: [])
- `expandedBlocks`: Json? (optional, editorial content structure)
- `provenance`: Json? (optional)
- `credits`: Json? (optional)
- `publishedAt`: DateTime? (optional)
- `dynamicHeroUpdatedAt`: DateTime? (optional)
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Relations:**
- One-to-one with Project (`project`)
- One-to-many with EditorialAssignment (`editorialAssignments`)

**PostStatus Enum Values:**
- DRAFT (default)
- REVIEW
- PUBLISHED
- ARCHIVED

**PostVariant Enum Values:**
- PROJECT_FEATURE (default)
- MATERIAL_STUDY
- METHOD
- DESIGNER_PROFILE
- EVENT_ESSAY

### EditorialDraft Model

**Table:** `editorial_drafts`  
**Schema (from `prisma/schema.prisma`):**

- `id`: String (cuid, primary key)
- `projectId`: String (foreign key to Project)
- `version`: Int (default: 1)
- `status`: String (default: "draft")
- `title`: String? (optional)
- `subtitle`: String? (optional)
- `outline`: Json? (optional)
- `bodyMarkdown`: String? (optional)
- `pullQuotes`: Json? (optional)
- `suggestedCaptions`: Json? (optional)
- `suggestedAssets`: Json? (optional)
- `rawState`: Json? (optional, stores BlocksSchema)
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Relations:**
- Many-to-one with Project (`project`)

### EditorialCategory Model

**Table:** `editorial_category`  
**Schema (from `prisma/schema.prisma`):**

- `id`: String (cuid, primary key)
- `type`: String (e.g., "style", "region", "theme")
- `label`: String (category name)
- `centroid`: Vector? (optional, embedding vector for style categories)
- `createdAt`: DateTime
- `assignments`: EditorialAssignment[] (relation)

**Constraints:**
- Unique on (type, label)
- Indexed on type

### EditorialAssignment Model

**Table:** `editorial_assignment`  
**Schema (from `prisma/schema.prisma`):**

- `id`: String (cuid, primary key)
- `projectId`: String (foreign key to Project)
- `editorialId`: String (foreign key to ProjectPost)
- `categoryId`: String (foreign key to EditorialCategory)
- `editorialScore`: Float (calculated feature-worthiness score 0-1)
- `createdAt`: DateTime

**Relations:**
- Many-to-one with Project (`project`)
- Many-to-one with ProjectPost (`editorial`)
- Many-to-one with EditorialCategory (`category`)

**Constraints:**
- Unique on (projectId, categoryId)
- Indexed on categoryId and editorialId

### EditorialEdition Model

**Table:** `editorial_edition`  
**Schema (from `prisma/schema.prisma`):**

- `id`: String (cuid, primary key)
- `slug`: String (unique)
- `title`: String
- `intro`: String
- `categoryIds`: String[] (array)
- `projectIds`: String[] (array)
- `publishedAt`: DateTime? (optional)
- `metrics`: Json
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Purpose:** Curated collections of high-scoring editorials sharing similar style/region

## Editorial Workflow

### Draft Generation

**Currently implemented:**
- `getOrCreateEditorialDraft()` function in `src/lib/editorial/getOrCreateEditorialDraft.ts`
- Fetches existing draft or generates new one
- Stores draft in `EditorialDraft.rawState` as JSON (BlocksSchema)
- Can fall back to minimal blocks if generation fails

### Editorial Scheduler

**Observed in code (`src/lib/editorial/scheduler.ts`):**
- Daily scheduler (`runDailyEditorialScheduler()`)
- Gathers qualifying projects by category
- Calculates average editorial scores
- Generates edition copy via AI
- Publishes editions when thresholds met (minimum projects, average score)
- Sends notifications to stakeholders

### Editorial Routes

**Observed routes:**
- `/p/[slug]` - Published post view (uses `getPostBySlug()`)
- `/designer/projects/[id]/preview` - Preview before publish
- `/api/posting/project/[projectId]/status` - Update post status
- `/api/editorial-submissions` - Editorial submission endpoints

### Editorial Components

**Observed components:**
- `EditorialSpread` - Single unified spread container (rule-of-thirds layout)
- `EditorialCaption` - Caption component for editorial spreads
- `ImageTagDots` - Photo tag hotspots overlay
- `HeroSpreadBlock`, `SplitEditorialBlock`, `DetailBlock`, `GalleryBlock` - Editorial block types

**Note:** Tag coordinates (x, y) from ProductTag schema are required for tag overlays but may not always be passed to editorial components.

## Project Module System

**ProjectModule Model:**
- Flexible media storage (JSON field for file IDs, URLs, or embeds)
- Types: ARTICLE, STORY, SHORT_VIDEO, LONG_VIDEO, GALLERY, BOARD, TIMELINE
- Flags: `pinned`, `isPrimary`, `isAiCompiled`
- `publishedAt` field (null = draft)

**Purpose:** Store various content types attached to projects (videos, galleries, timelines, etc.)

## Alignment With Canonical Constitution

**Current Implementation Status:**

The system **partially supports** editorial-as-status through the following mechanisms:

**Fully Implemented:**
- Project publishing via `isPublic`, `publishedAt`, `status` fields (manual elevation)
- ProjectPost publishing via `status` enum (manual elevation)
- Editorial scoring system (automatic calculation)
- Editorial categorization (automatic assignment)
- Editorial edition curation (automatic with thresholds)

**Partially Implemented:**
- Editorial status is inferred via EditorialAssignment presence, not an explicit state field
- ProjectPost is optional (not all projects have editorial content)
- Project and ProjectPost have separate but related publish states
- Editorial scores exist but are used for edition curation, not individual project elevation

**Not Implemented:**
- No explicit "editorial" status field on Project or ProjectPost
- No automatic elevation of individual projects to "editorial" status based on score thresholds
- No automatic creation of ProjectPost based on engagement metrics
- No automatic promotion from Published Project to Posted Project

**Status appears to be inferred via:** Presence of `ProjectPost.status === "PUBLISHED"` combined with Project visibility fields, rather than a single authoritative editorial status field.


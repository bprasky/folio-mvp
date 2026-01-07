> ⚠️ Canonical Notice  
> This document reflects the current implemented state of the system based on a codebase audit.  
> It does not define future direction unless explicitly stated elsewhere.

# Data Philosophy

## Purpose

This document describes the data storage patterns, database structure, and data modeling approaches observed in the codebase.

## Database Technology

**Currently implemented:**
- **Provider**: PostgreSQL
- **ORM**: Prisma
- **Client Generator**: Prisma Client (prisma-client-js)
- **Connection**: Uses `DATABASE_URL` and `DIRECT_URL` environment variables

## Naming Conventions

**Table Naming:**
- Tables use snake_case via `@@map()` directive
- Examples: `users`, `projects`, `project_images`, `product_tags`, `editorial_category`

**Model Naming:**
- Prisma models use PascalCase
- Examples: `User`, `Project`, `ProjectImage`, `ProductTag`, `EditorialCategory`

**Field Naming:**
- camelCase in Prisma models
- Examples: `projectId`, `createdAt`, `isPublic`, `publishedAt`

## Primary Keys and IDs

**ID Patterns:**
- Most models use `String` with `@default(uuid())` for IDs
- Some models use `@default(cuid())` (e.g., Event, ProjectPost, EditorialCategory)
- Consistent use of `@id` directive for primary keys

**Foreign Key Naming:**
- Foreign keys follow pattern: `{modelName}Id` (e.g., `projectId`, `userId`, `imageId`)
- Optional foreign keys use `?` nullable type

## Timestamps

**Standard Pattern:**
- `createdAt`: DateTime with `@default(now())`
- `updatedAt`: DateTime with `@updatedAt` (auto-updated)
- Both present on most models

**Publication Timestamps:**
- `publishedAt`: DateTime? (optional, nullable)
- Used to track when content becomes public

## Soft Deletes and Status Fields

**Status Fields:**
- String-based status fields (e.g., `status: String @default("draft")`)
- Enum-based status fields (e.g., `PostStatus`, `SkeletonStatus`, `ActionItemStatus`)
- Boolean flags for state (e.g., `isPublic`, `isPending`, `isActive`)

**Cascade Deletes:**
- Most relations use `onDelete: Cascade`
- Some use `onDelete: SetNull` for optional relations

## Data Relationships

**One-to-Many:**
- Standard Prisma relation pattern
- Example: `Project` → `ProjectImage[]`

**Many-to-Many:**
- Junction tables (e.g., `FolderProduct`, `OrganizationUser`)
- Unique constraints on composite keys (e.g., `@@unique([folderId, productId])`)

**One-to-One:**
- Uses `@unique` on foreign key field
- Example: `ProjectPost.projectId` is unique

**Polymorphic Patterns:**
- Uses nullable foreign keys (exactly one must be set, validated in application)
- Example: `NoteAttachment` can link to `projectId`, `roomId`, or `productTagId`

## JSON Fields

**Flexible Data Storage:**
- `Json?` type used for flexible schemas
- Examples:
  - `ProjectPost.expandedBlocks` - Editorial content structure
  - `EditorialDraft.rawState` - Draft state storage
  - `Product.specsJson` - Free-form product specifications
  - `EventTargetingProfile.aiPreferences` - AI-generated preferences
  - `ProjectModule.media` - Flexible media storage

**Purpose:** Allows schema evolution without migrations for certain fields

## Array Fields

**PostgreSQL Arrays:**
- `String[]` type used for tags, keywords, IDs
- Examples:
  - `User.specialties`: String[]
  - `ProjectPost.keywords`: String[]
  - `EditorialEdition.categoryIds`: String[]
  - `EditorialEdition.projectIds`: String[]

## Indexing Strategy

**Observed Index Patterns:**
- Foreign keys typically indexed
- Composite indexes for common query patterns
- Examples:
  - `@@index([projectId, projectImageId, status])`
  - `@@index([userId, action, createdAt])`
  - `@@index([categoryId])`

**Unique Constraints:**
- Used for business logic constraints
- Examples: `@@unique([userId, organizationId])`, `@@unique([projectId, categoryId])`

## Enum Usage

**Enums Observed:**
- `Role`: User roles (ADMIN, VENDOR, DESIGNER, HOMEOWNER, GUEST, INDIVIDUAL)
- `OrgType`: Organization types (VENDOR, DESIGN_FIRM, MANUFACTURER, SHOWROOM, CONTRACTOR)
- `OrgUserRole`: Organization membership roles (OWNER, ADMIN, MANAGER, MEMBER, VIEWER)
- `ProjectStage`: Project lifecycle stages
- `ProjectType`: Project types (UNSPECIFIED, RESIDENTIAL, COMMERCIAL, etc.)
- `PostStatus`: Editorial post status (DRAFT, REVIEW, PUBLISHED, ARCHIVED)
- `PostVariant`: Editorial post variants (PROJECT_FEATURE, MATERIAL_STUDY, etc.)
- Many others for specific domains

## Idempotency Patterns

**Source of Truth Fields:**
- Fields marked as "SOURCE OF TRUTH" in comments
- Example: `Product.threeDAssetUrl` - if non-null, 3D mesh exists and will be skipped
- Used to prevent duplicate processing

**Unique Constraints for Deduplication:**
- `Product.sourceUrl` is unique (idempotency key)
- `Product.slug` is unique
- `ProjectPost.slug` is unique

## Data Validation

**Application-Level Validation:**
- Validation occurs in application code, not database constraints
- Type safety via Prisma schema and TypeScript
- Business logic validation in API routes and actions

## Graph and Relationship Data

**Graph Patterns:**
- `GraphEdge` model for generic graph relationships
- `EventRelationshipEdge`, `EventDesignerEdge`, `EventVendorEdge`, `EventProductEdge`, `EventRepEdge` for event graph
- `AtelierEdge` for design fingerprint relationships
- Edge models include: `srcType`, `srcId`, `dstType`, `dstId`, `kind`, `weight`, `decayAt`

**Signal Patterns:**
- `ContextSignal` for user action tracking
- `AtelierSignal` for design fingerprint signals
- `VendorInviteSignal` for vendor discovery signals
- Signals include: `action`, `tags`, `meta`, `createdAt`




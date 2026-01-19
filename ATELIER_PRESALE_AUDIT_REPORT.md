# Folio Codebase Audit: Atelier Infrastructure for Developer Presales

**Date:** January 19, 2026
**Auditor:** Claude Code
**Scope:** Architecture readiness for Phase 2-3 developer presale feature

---

## Executive Summary

This audit examines Folio's codebase readiness to support a presale consultation feature where real estate developers list buildings and buyers consult with a designer's Atelier for finish package guidance. The core innovation: designers earn passive income on decisions too small for traditional engagement.

**Key Findings:**

| System Area | Readiness | Notes |
|-------------|-----------|-------|
| Atelier Fingerprint | 70% | Graph built, no deployment/context injection |
| Product Tagging | 90% | Robust, needs constrained catalog concept |
| AI Integration | 85% | Multi-provider, needs conversation persistence |
| User System | 80% | Individual-first, needs lightweight buyer flow |
| Vendor Attribution | 85% | Comprehensive signals, good foundation |
| Discovery/Marketplace | 75% | Editorial-first, needs developer listings |
| Payment Infrastructure | 60% | Credit system designed, Stripe not integrated |

**Overall Assessment:** The foundation exists but requires significant new infrastructure for deployable Atelier consultations. The system is designed around designer-centric project workflows, not buyer-facing consultation flows.

---

## 1. Architecture Summary

### 1.1 Atelier System Current State

The Atelier fingerprint system is a **graph-based aesthetic profiling system** that passively aggregates designer behavioral signals into weighted knowledge graphs.

**What Exists:**
- `AtelierFingerprint` model with owner polymorphism (DESIGNER or VENDOR)
- `AtelierNode` with 5 semantic dimensions: STYLE, ROOM_TYPE, MATERIAL, VENDOR, PRODUCT_CATEGORY
- `AtelierEdge` for weighted relationships (PROJECT_ROOM_FOCUS, FREQUENT_VENDOR, PREFERS)
- `AtelierSignal` for raw behavioral signal capture
- Signal recording from product tagging (7 signal types) and interview answers
- Fingerprint aggregation algorithm with noise filtering (edges < 0.15 excluded)
- Admin recompute endpoint (`POST /api/admin/atelier/designer/{id}/recompute`)
- UI components: `FolioFingerprint.tsx`, `InfluenceMetrics.tsx`

**What's Missing:**
- **No context injection/deployment mechanism** - Fingerprints are computed but not used
- **No fingerprint query API** - Cannot retrieve computed fingerprint programmatically
- **No vendor Atelier** - Scaffolded but not implemented
- **No embeddings** - Structured graphs only, no vector representations
- **No temporal analysis** - Cannot track preference evolution
- **No "constrained reasoning"** capability - No way to bound fingerprint to subset of products

**Key Files:**
- `/src/lib/atelier/signals.ts` - Signal recording
- `/src/lib/atelier/aggregate.ts` - Fingerprint computation (217 lines)
- `/prisma/schema.prisma` lines 1459-1565 - Models

### 1.2 Product Tagging & Specification System

**What Exists:**
- `ProductTag` model with x/y percentage coordinates (0-100 scale)
- `Selection` model with comprehensive metadata: SKU, price, color/finish, spec sheets, quantity
- **Room Templates** with slot-based constraints (5-7 slots per room type)
- Category-to-slot mapping for automatic slot inference
- Vendor attribution via `Product.vendorId` and `Selection.vendorRepId`
- Specification export to XLSX/PDF via `/api/projects/[id]/export-spec`
- Import agent with `PendingProductTag` for AI-detected product verification

**Product Catalog Concept:**
- Categories are used for slot assignment but no "constrained product set" model
- No concept of "these are the only 12 products available for this selection"
- Room templates define slots but not product restrictions

**Key Files:**
- `/src/app/api/tag-product-to-image/route.ts`
- `/src/app/project/[id]/roomTemplates.ts`
- `/src/lib/rooms/merge-tagged-selections.ts`

### 1.3 Project & Context Models

**What Exists:**
- `Project` with `ProjectType` enum (RESIDENTIAL, COMMERCIAL, HOSPITALITY, etc.)
- `Room` model with type field (KITCHEN, BATH, LIVING, BEDROOM, etc.)
- `Selection` model for product choices with room assignment
- `ProjectParticipant` for multi-party collaboration (DESIGNER, VENDOR, ARCHITECT, BUILDER sides)
- Project stages: concept → schematic → design_development → cd_pre_spec → spec_locked → in_procurement → install

**Gap Analysis for Building/Development:**
- No "DEVELOPMENT" or "PRESALE" project type
- No concept of "unit types" (rooms represent spaces, not unit configurations)
- No "building context" model for developer constraints
- No "finish package" template concept
- No "preset configurations" or "option sets"

### 1.4 AI Integration & Conversation System

**What Exists:**
- **Anthropic Claude** (claude-sonnet-4-20250514): Support chat, editorial composition, image classification, import agent
- **OpenAI GPT-4o**: Collaboration story assembly, follow-up generation, vendor analytics
- **OpenAI Embeddings** (text-embedding-3-large): Semantic search
- System prompt architecture with persona-based design
- Interview workflows: 3-round collaborative interview system
- Context injection patterns: Room-based organization, tagged products, interview data

**Conversational Features:**
- Support chat with conversation history
- Vendor analytics chat with embedded analytics context
- Orb agent for system architecture Q&A
- Project interview follow-ups

**What's Missing:**
- **No Atelier consultation conversation** - No system for fingerprint-guided product recommendations
- **No persistent conversation sessions** - Client maintains history, no server-side persistence
- **No constrained product context injection** - Cannot limit AI to specific product catalog
- **No streaming in interview generation**

**Key Files:**
- `/src/app/api/support/chat/route.ts`
- `/src/lib/collaboration/narrative/assembleStory.ts`
- `/src/lib/import-agent/config.ts`

### 1.5 User System & Individual Flow

**What Exists:**
- **Individual-First Architecture**: All signups start as INDIVIDUAL with instant APPROVED status
- Role enum: ADMIN, VENDOR, DESIGNER, ARCHITECT, BUILDER, INDIVIDUAL, HOMEOWNER (deprecated), GUEST
- INDIVIDUAL capabilities: Browse, save products, follow designers, RSVP events, create boards, hire designers
- NextAuth.js with JWT session strategy
- Subscription tiers: FREE, PRO, STUDIO, ENTERPRISE

**Minimum User Record:**
- `id`, `email`, `name`, `passwordHash`, `role=INDIVIDUAL`, `accountStatus=APPROVED`

**Buyer/Consultation Flows:**
- `/api/individual/hire` - Individual can hire designers, creates project with handoff
- `/api/individual/match-designers` - Matching algorithm based on saved items
- No "consultation-only" lightweight flow exists

**What's Missing:**
- No "BUYER" role or consultation-specific user type
- No anonymous/session-based consultation (requires full account)
- No 20-minute lightweight consultation auth pattern
- No developer-as-user flow

### 1.6 Vendor & Attribution System

**What Exists:**
- `ContextSignal` model tracking: view, save, add_to_project, rsvp, feature_click, search
- Multi-level vendor attribution: `vendorRepId`, `vendorOrgId`, `vendorId`
- Vendor notification via `sendVendorProductPreviewEmail()` (email not actually sent - logged only)
- Smart invites for designer outreach based on engagement
- Vendor analytics: spec heatmap, trending products, designer influence, pipeline snapshot
- `VendorInviteCandidate` for tracking vendor outreach

**Attribution Flow:**
```
Designer tags product → ProductTag created → ContextSignal logged (vendorId) →
Selection created (vendorRepId, vendorOrgId) → Vendor sees in analytics
```

**What's Missing:**
- No presale-specific attribution (consultation → designer credit → vendor specification)
- No "developer" as attribution source
- Email service not integrated (notifications only logged)

### 1.7 Marketplace & Discovery Patterns

**What Exists:**
- **Feed**: Editorial-focused with featured projects and stories
- **Search**: Moment-centric (individual images as atomic unit), not project-centric
- **Lenses**: Editorial re-weighting filters (by room, material, space type)
- **Directory**: Merit-based ranking for designers, architects, builders, vendors
- **Designer directory**: Browse products they've tagged
- Edition generation: Real-time assembly from search results

**Key Principle:** "Search returns a curated edition, not results"

**What's Missing:**
- No "developer listings" discovery
- No "browse designers for consultation" flow
- No "building/development" search scope
- No presale marketplace patterns

### 1.8 Payment & Revenue Infrastructure

**What Exists:**
- **Designer Subscription Tiers**: FREE ($0), PRO ($49/mo), STUDIO ($199/mo), ENTERPRISE (custom)
- **Vendor Subscription Tiers**: STARTER (free, 18% affiliate), GROWTH ($349, 11%), PROFESSIONAL ($899, 6%), ENTERPRISE (custom, 3-5%)
- **Credit System**: `CreditAccount`, `CreditTransaction` models
- **Margin Split**: Default 40% Folio, 35% designer, 20% consumer discount, 5% rep
- **Order System**: Full model with attribution tracking, fulfillment methods
- **30-day credit hold period** for chargeback protection
- **Trade Account System**: Encrypted credential storage for vendor logins

**What's NOT Implemented:**
- **Stripe SDK not integrated** - Fields exist, no code
- No webhook handlers
- No payment processing
- No email notifications for billing
- No refund handling

---

## 2. Data Model Gaps

### 2.1 New Models Required

```prisma
// ============================================================
// PRESALE/DEVELOPER MODELS
// ============================================================

enum DevelopmentStatus {
  PLANNING
  PRE_CONSTRUCTION
  UNDER_CONSTRUCTION
  READY_FOR_OCCUPANCY
  SOLD_OUT
}

enum FinishPackageTier {
  STANDARD
  UPGRADE_1
  UPGRADE_2
  PREMIUM
  CUSTOM
}

// Represents a real estate development listing
model Development {
  id                   String              @id @default(cuid())
  developerOrgId       String
  developerOrg         Organization        @relation(fields: [developerOrgId], references: [id])

  name                 String
  slug                 String              @unique
  description          String?

  // Location
  address              String
  city                 String
  state                String
  country              String              @default("USA")

  // Development details
  totalUnits           Int
  unitTypes            UnitType[]
  status               DevelopmentStatus   @default(PLANNING)
  expectedCompletion   DateTime?

  // Finish package configuration
  finishPackages       FinishPackage[]
  productCatalog       DevelopmentProduct[]

  // Atelier consultations enabled
  consultationsEnabled Boolean             @default(false)
  defaultDesignerId    String?             // Default Atelier for this development
  designerPool         DevelopmentDesigner[]

  // Imagery
  heroImageUrl         String?
  galleryUrls          String[]

  // Timestamps
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt
  publishedAt          DateTime?

  @@index([status])
  @@index([city, state])
  @@map("developments")
}

// Unit type within a development (e.g., "2BR Corner", "Penthouse")
model UnitType {
  id                   String              @id @default(cuid())
  developmentId        String
  development          Development         @relation(fields: [developmentId], references: [id], onDelete: Cascade)

  name                 String              // "2BR Corner Unit"
  code                 String              // "2BR-C"
  squareFootage        Int?
  bedrooms             Int
  bathrooms            Float

  // Room configuration
  rooms                UnitTypeRoom[]

  // Base price
  basePriceCents       Int?

  // Floor plan
  floorPlanUrl         String?

  createdAt            DateTime            @default(now())

  @@unique([developmentId, code])
  @@map("unit_types")
}

// Rooms within a unit type
model UnitTypeRoom {
  id                   String              @id @default(cuid())
  unitTypeId           String
  unitType             UnitType            @relation(fields: [unitTypeId], references: [id], onDelete: Cascade)

  name                 String              // "Primary Bathroom"
  type                 String              // "BATH"

  // Finish slots available
  finishSlots          FinishSlot[]

  @@map("unit_type_rooms")
}

// Constrained product catalog for a development
model DevelopmentProduct {
  id                   String              @id @default(cuid())
  developmentId        String
  development          Development         @relation(fields: [developmentId], references: [id], onDelete: Cascade)

  productId            String
  product              Product             @relation(fields: [productId], references: [id])

  // Availability constraints
  availableInPackages  FinishPackageTier[] // Which packages include this
  isUpgrade            Boolean             @default(false)
  upgradePriceCents    Int?                // Additional cost if upgrade

  // Slot restriction
  allowedSlots         String[]            // e.g., ["countertop", "backsplash"]

  createdAt            DateTime            @default(now())

  @@unique([developmentId, productId])
  @@index([developmentId, availableInPackages])
  @@map("development_products")
}

// Finish package template
model FinishPackage {
  id                   String              @id @default(cuid())
  developmentId        String
  development          Development         @relation(fields: [developmentId], references: [id], onDelete: Cascade)

  name                 String              // "Designer Collection"
  tier                 FinishPackageTier
  description          String?

  // Price delta from base
  priceDeltaCents      Int                 @default(0)

  // Default selections for this package
  defaultSelections    FinishPackageDefault[]

  // Imagery
  heroImageUrl         String?

  createdAt            DateTime            @default(now())

  @@unique([developmentId, tier])
  @@map("finish_packages")
}

// Default product for a slot in a finish package
model FinishPackageDefault {
  id                   String              @id @default(cuid())
  finishPackageId      String
  finishPackage        FinishPackage       @relation(fields: [finishPackageId], references: [id], onDelete: Cascade)

  slotKey              String              // "countertop", "faucet"
  roomType             String              // "KITCHEN", "BATH"
  developmentProductId String
  developmentProduct   DevelopmentProduct  @relation(fields: [developmentProductId], references: [id])

  @@unique([finishPackageId, slotKey, roomType])
  @@map("finish_package_defaults")
}

// Finish slot configuration
model FinishSlot {
  id                   String              @id @default(cuid())
  unitTypeRoomId       String
  unitTypeRoom         UnitTypeRoom        @relation(fields: [unitTypeRoomId], references: [id], onDelete: Cascade)

  key                  String              // "countertop", "faucet"
  label                String              // "Kitchen Countertop"
  category             String              // Product category constraint

  // Whether buyer can customize
  isCustomizable       Boolean             @default(true)

  @@unique([unitTypeRoomId, key])
  @@map("finish_slots")
}

// Designers available for consultations on a development
model DevelopmentDesigner {
  id                   String              @id @default(cuid())
  developmentId        String
  development          Development         @relation(fields: [developmentId], references: [id], onDelete: Cascade)

  designerId           String
  designer             User                @relation(fields: [designerId], references: [id])

  // Commission structure
  consultationFeeShare Float               @default(0.7) // 70% to designer

  // Availability
  isActive             Boolean             @default(true)

  createdAt            DateTime            @default(now())

  @@unique([developmentId, designerId])
  @@map("development_designers")
}

// ============================================================
// CONSULTATION MODELS
// ============================================================

enum ConsultationStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  ABANDONED
  EXPIRED
}

// A buyer consultation session
model Consultation {
  id                   String              @id @default(cuid())

  // Context
  developmentId        String
  development          Development         @relation(fields: [developmentId], references: [id])
  unitTypeId           String?
  unitType             UnitType?           @relation(fields: [unitTypeId], references: [id])
  finishPackageId      String?             // Starting package
  finishPackage        FinishPackage?      @relation(fields: [finishPackageId], references: [id])

  // Participants
  buyerId              String              // User ID (INDIVIDUAL or lightweight)
  buyer                User                @relation("BuyerConsultations", fields: [buyerId], references: [id])
  designerId           String
  designer             User                @relation("DesignerConsultations", fields: [designerId], references: [id])
  atelierFingerprintId String?             // Fingerprint snapshot used

  // Session
  status               ConsultationStatus  @default(SCHEDULED)
  scheduledAt          DateTime?
  startedAt            DateTime?
  completedAt          DateTime?
  durationMinutes      Int?

  // Conversation
  conversationHistory  Json?               // Message array

  // Outcomes
  selections           ConsultationSelection[]
  summary              String?             // AI-generated summary
  designerNotes        String?

  // Attribution
  attributionLocked    Boolean             @default(false)

  // Pricing
  consultationFeeCents Int?
  designerEarningsCents Int?

  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt

  @@index([buyerId])
  @@index([designerId])
  @@index([developmentId, status])
  @@map("consultations")
}

// Product selection made during consultation
model ConsultationSelection {
  id                   String              @id @default(cuid())
  consultationId       String
  consultation         Consultation        @relation(fields: [consultationId], references: [id], onDelete: Cascade)

  // What was selected
  slotKey              String
  roomType             String
  developmentProductId String
  developmentProduct   DevelopmentProduct  @relation(fields: [developmentProductId], references: [id])

  // Designer reasoning (for Atelier learning)
  reasoning            String?
  alternatives         Json?               // Other options considered

  // Buyer acceptance
  buyerAccepted        Boolean             @default(true)
  buyerNote            String?

  createdAt            DateTime            @default(now())

  @@unique([consultationId, slotKey, roomType])
  @@map("consultation_selections")
}

// Lightweight buyer record (can exist without full User)
model ConsultationBuyer {
  id                   String              @id @default(cuid())

  // Contact info (may not have full account)
  email                String
  name                 String
  phone                String?

  // Optional link to User (if they create account)
  userId               String?             @unique
  user                 User?               @relation(fields: [userId], references: [id])

  // Development context
  developmentId        String
  development          Development         @relation(fields: [developmentId], references: [id])
  unitNumber           String?             // Their specific unit

  // Session token for lightweight auth
  sessionToken         String              @unique
  sessionExpiresAt     DateTime

  createdAt            DateTime            @default(now())

  @@unique([email, developmentId])
  @@index([sessionToken])
  @@map("consultation_buyers")
}

// ============================================================
// ATELIER DEPLOYMENT MODELS
// ============================================================

enum AtelierDeploymentType {
  DEVELOPMENT_CONSULTATION
  VENDOR_CONFIGURATOR
  DESIGNER_ASSISTANT
}

// Deployed Atelier instance with context constraints
model AtelierDeployment {
  id                   String              @id @default(cuid())

  fingerprintId        String
  fingerprint          AtelierFingerprint  @relation(fields: [fingerprintId], references: [id])

  deploymentType       AtelierDeploymentType

  // Context constraints
  developmentId        String?             // If DEVELOPMENT_CONSULTATION
  development          Development?        @relation(fields: [developmentId], references: [id])

  // Product catalog constraint
  constrainedCatalogId String?             // Links to DevelopmentProduct set

  // System prompt augmentation
  contextPrompt        String?             @db.Text // Additional context for AI

  // Behavior configuration
  config               Json?               // Temperature, response style, etc.

  isActive             Boolean             @default(true)

  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt

  @@index([fingerprintId, isActive])
  @@index([developmentId])
  @@map("atelier_deployments")
}
```

### 2.2 Model Extensions Required

```prisma
// Extend existing Organization model
model Organization {
  // ... existing fields ...

  // NEW: Developer organization support
  developments         Development[]       // If type = DEVELOPER
}

// Extend Role enum
enum Role {
  // ... existing ...
  DEVELOPER            // NEW - Real estate developer
}

// Extend OrgType enum
enum OrgType {
  // ... existing ...
  DEVELOPER            // NEW - Real estate development company
}

// Extend User model
model User {
  // ... existing fields ...

  // NEW: Consultation relations
  buyerConsultations     Consultation[]    @relation("BuyerConsultations")
  designerConsultations  Consultation[]    @relation("DesignerConsultations")
  developmentDesigners   DevelopmentDesigner[]
  consultationBuyer      ConsultationBuyer?
}

// Extend Product model
model Product {
  // ... existing fields ...

  // NEW: Development catalog relation
  developmentProducts    DevelopmentProduct[]
}

// Extend AtelierFingerprint model
model AtelierFingerprint {
  // ... existing fields ...

  // NEW: Deployment relation
  deployments            AtelierDeployment[]
}
```

### 2.3 New Enums Required

```prisma
enum DevelopmentStatus {
  PLANNING
  PRE_CONSTRUCTION
  UNDER_CONSTRUCTION
  READY_FOR_OCCUPANCY
  SOLD_OUT
}

enum FinishPackageTier {
  STANDARD
  UPGRADE_1
  UPGRADE_2
  PREMIUM
  CUSTOM
}

enum ConsultationStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  ABANDONED
  EXPIRED
}

enum AtelierDeploymentType {
  DEVELOPMENT_CONSULTATION
  VENDOR_CONFIGURATOR
  DESIGNER_ASSISTANT
}
```

---

## 3. API Gaps

### 3.1 New Endpoints Required

#### Development Management (Developer Portal)
```
POST   /api/developments                     - Create development listing
GET    /api/developments                     - List developer's developments
GET    /api/developments/[id]                - Get development details
PATCH  /api/developments/[id]                - Update development
DELETE /api/developments/[id]                - Archive development

POST   /api/developments/[id]/unit-types     - Add unit type
PATCH  /api/developments/[id]/unit-types/[unitId] - Update unit type
DELETE /api/developments/[id]/unit-types/[unitId] - Remove unit type

POST   /api/developments/[id]/products       - Add product to catalog
DELETE /api/developments/[id]/products/[productId] - Remove from catalog
PATCH  /api/developments/[id]/products/[productId] - Update availability

POST   /api/developments/[id]/finish-packages - Create finish package
PATCH  /api/developments/[id]/finish-packages/[packageId] - Update package
POST   /api/developments/[id]/finish-packages/[packageId]/defaults - Set defaults

POST   /api/developments/[id]/designers      - Add designer to pool
DELETE /api/developments/[id]/designers/[designerId] - Remove designer
```

#### Consultation System
```
POST   /api/consultations                    - Create/schedule consultation
GET    /api/consultations/[id]               - Get consultation details
PATCH  /api/consultations/[id]               - Update consultation status
POST   /api/consultations/[id]/start         - Start consultation session
POST   /api/consultations/[id]/complete      - Complete consultation

POST   /api/consultations/[id]/message       - Send message in consultation
GET    /api/consultations/[id]/history       - Get conversation history

POST   /api/consultations/[id]/selections    - Record selection
PATCH  /api/consultations/[id]/selections/[selectionId] - Update selection
DELETE /api/consultations/[id]/selections/[selectionId] - Remove selection

GET    /api/consultations/[id]/summary       - Generate/get consultation summary
```

#### Atelier Deployment
```
POST   /api/atelier/deployments              - Create deployment
GET    /api/atelier/deployments/[id]         - Get deployment config
PATCH  /api/atelier/deployments/[id]         - Update deployment
DELETE /api/atelier/deployments/[id]         - Deactivate deployment

GET    /api/atelier/fingerprints/[id]        - Get computed fingerprint (NEW!)
POST   /api/atelier/fingerprints/[id]/query  - Query fingerprint for recommendations
```

#### Buyer Portal
```
POST   /api/buyer/register                   - Lightweight buyer registration
POST   /api/buyer/auth                       - Session-based auth
GET    /api/buyer/developments/[id]          - View development (buyer context)
GET    /api/buyer/developments/[id]/designers - Browse available designers
POST   /api/buyer/consultations              - Request consultation
GET    /api/buyer/consultations              - List buyer's consultations
```

#### Discovery Extensions
```
GET    /api/developments                     - Public development listings
GET    /api/developments/[slug]              - Public development detail
GET    /api/developments/[id]/designers      - Designers consulting for development
GET    /api/search/developments              - Search developments
```

### 3.2 Endpoint Modifications Required

```
# Extend existing endpoints:

GET /api/directory/designers
  + Add filter: consultationsEnabled=true
  + Add filter: developmentId=X (designers available for development)

POST /api/atelier/signals
  + Add consultation context fields
  + Add development context fields

GET /api/users/[id]/profile
  + Add consultation stats for designers
  + Add earnings from consultations
```

---

## 4. AI Architecture Gaps

### 4.1 Atelier Consultation Conversation System

**Required Components:**

#### 1. Conversation Persistence Layer
```typescript
// New: Server-side conversation storage
interface ConsultationConversation {
  consultationId: string;
  messages: ConversationMessage[];
  contextSnapshot: {
    fingerprint: AtelierFingerprintSummary;
    development: DevelopmentContext;
    unitType: UnitTypeContext;
    productCatalog: ConstrainedProduct[];
    currentSelections: Map<string, ProductSelection>;
  };
  lastActivityAt: Date;
}

interface ConversationMessage {
  id: string;
  role: 'buyer' | 'atelier' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    productSuggestions?: ProductSuggestion[];
    slotRecommendation?: string;
    reasoning?: string;
  };
}
```

#### 2. Context Injection System
```typescript
// New: Constrained context builder
function buildAtelierConsultationContext(
  deployment: AtelierDeployment,
  consultation: Consultation
): AtelierContext {
  return {
    // Designer fingerprint (reasoning patterns)
    fingerprint: {
      stylePreferences: extractStyleNodes(deployment.fingerprint),
      materialAffinities: extractMaterialNodes(deployment.fingerprint),
      vendorRelationships: extractVendorNodes(deployment.fingerprint),
      roomExpertise: extractRoomNodes(deployment.fingerprint),
    },

    // Constrained product set
    availableProducts: getConstrainedCatalog(
      consultation.developmentId,
      consultation.finishPackageId
    ),

    // Current unit context
    unitContext: {
      unitType: consultation.unitType,
      rooms: consultation.unitType.rooms,
      finishSlots: extractFinishSlots(consultation.unitType),
    },

    // Selection state
    currentSelections: consultation.selections,
    remainingSlots: calculateRemainingSlots(consultation),

    // Budget context
    budgetContext: {
      basePackagePrice: consultation.finishPackage.priceDeltaCents,
      currentUpgradeCost: calculateUpgradeCost(consultation.selections),
    },
  };
}
```

#### 3. System Prompt Architecture
```typescript
// New: Atelier consultation system prompt
const ATELIER_CONSULTATION_PROMPT = `
You are an Atelier assistant representing {designerName}'s design sensibility.

## Your Design DNA
{fingerprint.stylePreferences}
{fingerprint.materialAffinities}
{fingerprint.reasoningPatterns}

## Context
- Development: {development.name}
- Unit Type: {unitType.name} ({unitType.squareFootage} sq ft)
- Finish Package: {finishPackage.name}

## Available Products
You may ONLY recommend products from this catalog:
{constrainedCatalog}

## Current Selections
{currentSelections}

## Remaining Decisions
{remainingSlots}

## Guidelines
1. Guide the buyer through finish selections room-by-room
2. Explain your recommendations using {designerName}'s reasoning style
3. Consider budget impact when suggesting upgrades
4. When the buyer asks about a product not in the catalog, acknowledge the preference but redirect to available options
5. Capture the reasoning behind each selection for {designerName}'s learning

## Voice
{voiceProfile.formalityLevel}
{voiceProfile.enthusiasmLevel}
{voiceProfile.signaturePhrases}
`;
```

#### 4. Recommendation Engine
```typescript
// New: Fingerprint-driven recommendation
interface ProductRecommendation {
  developmentProductId: string;
  product: Product;
  score: number;
  reasoning: string;
  fingerprintMatch: {
    styleAlignment: number;
    materialMatch: number;
    vendorAffinity: number;
  };
}

function getAtelierRecommendations(
  slotKey: string,
  roomType: string,
  context: AtelierContext
): ProductRecommendation[] {
  const eligibleProducts = context.availableProducts
    .filter(p => p.allowedSlots.includes(slotKey));

  return eligibleProducts
    .map(p => scoreProductAgainstFingerprint(p, context.fingerprint))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
```

### 4.2 Missing AI Infrastructure

| Component | Current State | Required |
|-----------|---------------|----------|
| Conversation persistence | Client-side only | Server-side with Redis/DB |
| Fingerprint query API | None | GET endpoint + recommendation engine |
| Constrained catalog injection | None | Context builder |
| Voice profile in prompts | Stored but unused | Prompt injection |
| Selection reasoning capture | Manual only | Auto-capture from conversation |
| Session management | JWT only | Consultation session tokens |

---

## 5. Prioritized Build List

### Phase 0: Foundation Work (Needed Regardless)

These items improve the platform independent of presale feature:

| Priority | Item | Effort | Notes |
|----------|------|--------|-------|
| P0.1 | **Stripe Integration** | 2-3 weeks | Critical for any monetization |
| P0.2 | **Fingerprint Query API** | 1 week | Expose computed fingerprints |
| P0.3 | **Email Service Integration** | 1 week | Required for notifications |
| P0.4 | **Conversation Persistence** | 1-2 weeks | Redis + DB hybrid |

### Phase 1: Core Presale Infrastructure

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| P1.1 | **Development Model & API** | 2 weeks | - |
| P1.2 | **Unit Type & Finish Slot Models** | 1 week | P1.1 |
| P1.3 | **Constrained Product Catalog** | 1 week | P1.1 |
| P1.4 | **Finish Package System** | 1 week | P1.2, P1.3 |
| P1.5 | **Developer Portal UI** | 2-3 weeks | P1.1-P1.4 |

### Phase 2: Atelier Deployment

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| P2.1 | **AtelierDeployment Model** | 1 week | P1.1 |
| P2.2 | **Context Injection System** | 2 weeks | P2.1, P0.2 |
| P2.3 | **Constrained Prompt Builder** | 1 week | P2.2 |
| P2.4 | **Recommendation Engine** | 2 weeks | P2.2 |
| P2.5 | **Voice Profile Integration** | 1 week | P2.3 |

### Phase 3: Consultation System

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| P3.1 | **Consultation Model & API** | 2 weeks | P2.1 |
| P3.2 | **Lightweight Buyer Auth** | 1 week | - |
| P3.3 | **Consultation Conversation Flow** | 2-3 weeks | P3.1, P0.4 |
| P3.4 | **Selection Recording** | 1 week | P3.1 |
| P3.5 | **Consultation Summary Generation** | 1 week | P3.3 |
| P3.6 | **Buyer Portal UI** | 2-3 weeks | P3.1-P3.5 |

### Phase 4: Attribution & Revenue

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| P4.1 | **Consultation Attribution Model** | 1 week | P3.1 |
| P4.2 | **Designer Earnings from Consultations** | 1-2 weeks | P4.1, P0.1 |
| P4.3 | **Developer Billing** | 1-2 weeks | P0.1 |
| P4.4 | **Vendor Specification Analytics** | 1 week | P3.4 |

### Phase 5: Discovery & Marketplace

| Priority | Item | Effort | Dependencies |
|----------|------|--------|--------------|
| P5.1 | **Development Discovery Page** | 1-2 weeks | P1.5 |
| P5.2 | **Designer Browse for Consultation** | 1 week | P2.1 |
| P5.3 | **Development Search** | 1 week | P5.1 |

### Nice-to-Have Extensions

| Item | Effort | Notes |
|------|--------|-------|
| Consultation scheduling with calendar | 2 weeks | Integration with Calendly/Cal.com |
| Video consultation support | 3-4 weeks | WebRTC or third-party |
| Atelier A/B testing | 2 weeks | Compare fingerprint variations |
| Developer analytics dashboard | 2 weeks | Conversion, timing, popular selections |
| Multi-language support | 3-4 weeks | i18n for buyer portal |

---

## 6. Phase 1 Implications

### 6.1 Architect Now, Build Later

These decisions should be made now even if implementation is deferred:

#### 1. **Fingerprint Versioning**
The current fingerprint model has no versioning. When a designer's fingerprint changes, there's no way to know which version was used for a consultation.

**Recommendation:** Add `version` field to `AtelierFingerprint` and `fingerprintVersion` to `Consultation` now.

#### 2. **Organization Type Extensibility**
Adding DEVELOPER to `OrgType` affects routing, permissions, and UI throughout the app.

**Recommendation:** Add DEVELOPER to enum now, gate features behind feature flags.

#### 3. **Product Catalog Constraints**
The current `Product` model has no concept of availability constraints or catalog membership.

**Recommendation:** Design the `DevelopmentProduct` junction table now, even if not implemented.

#### 4. **Consultation Session vs User Session**
Buyers may need lightweight, time-limited sessions separate from full user accounts.

**Recommendation:** Design `ConsultationBuyer` model with session token pattern now.

### 6.2 Schema Migrations to Prepare

```sql
-- Add now, populate later
ALTER TABLE "atelier_fingerprints" ADD COLUMN "version" INTEGER DEFAULT 1;
ALTER TABLE "atelier_fingerprints" ADD COLUMN "snapshot" JSONB;

-- Add enum value
ALTER TYPE "OrgType" ADD VALUE 'DEVELOPER';
ALTER TYPE "Role" ADD VALUE 'DEVELOPER';

-- Index for future queries
CREATE INDEX "idx_users_consultation_availability"
  ON "users" ("role", "subscription_tier")
  WHERE "role" = 'DESIGNER';
```

### 6.3 API Versioning

The consultation APIs will be significantly different from existing project-centric APIs. Consider:

**Recommendation:** Implement API versioning (`/api/v2/`) for consultation endpoints to allow independent evolution.

### 6.4 Feature Flags

```typescript
// Feature flags to add now
const FEATURE_FLAGS = {
  DEVELOPER_LISTINGS: false,
  ATELIER_DEPLOYMENTS: false,
  CONSULTATION_FLOW: false,
  BUYER_PORTAL: false,
  CONSULTATION_REVENUE: false,
};
```

---

## 7. Technical Debt Blockers

### 7.1 Critical Blockers

| Issue | Impact | Remediation |
|-------|--------|-------------|
| **No Stripe integration** | Cannot charge for consultations | Implement Stripe SDK |
| **No fingerprint query API** | Cannot use fingerprints for recommendations | Build GET endpoint |
| **Email service not integrated** | Cannot notify buyers/designers | Integrate SendGrid/Resend |
| **Client-side conversation state** | No persistent consultation history | Implement server-side storage |

### 7.2 Important Debt

| Issue | Impact | Remediation |
|-------|--------|-------------|
| Voice profile unused | Consultations won't capture designer voice | Integrate into prompts |
| Vendor Atelier not built | No vendor fingerprints for product matching | Implement vendor aggregation |
| No temporal fingerprint analysis | Can't show fingerprint evolution | Add time-series analysis |
| Room templates hardcoded | Can't customize for developments | Make configurable |

### 7.3 Minor Debt

| Issue | Impact | Remediation |
|-------|--------|-------------|
| Skeleton items mock-only | No real CV integration | Integrate vision API |
| Interview streaming missing | Slower UX for long generations | Add streaming support |
| No A/B testing framework | Can't optimize Atelier recommendations | Build experimentation system |

---

## 8. Summary

### What's Strong
- Atelier fingerprint graph structure is well-designed for this use case
- Product tagging system captures rich metadata for attribution
- AI integration patterns are sophisticated with good prompt architecture
- Credit system designed for revenue sharing
- Room template concept provides foundation for finish slots

### What's Missing
- Deployment/context injection for fingerprints (the critical gap)
- Developer/building data models
- Consultation conversation system
- Lightweight buyer authentication
- Stripe payment integration
- Constrained product catalog concept

### Estimated Total Effort

| Phase | Weeks | Notes |
|-------|-------|-------|
| Phase 0 (Foundation) | 5-7 | Should do regardless |
| Phase 1 (Development Models) | 6-8 | Core data layer |
| Phase 2 (Atelier Deployment) | 6-8 | The innovation |
| Phase 3 (Consultation System) | 8-10 | Main feature |
| Phase 4 (Attribution/Revenue) | 3-5 | Monetization |
| Phase 5 (Discovery) | 3-4 | Distribution |
| **Total** | **31-42 weeks** | With parallelization |

### Key Recommendation

The Atelier fingerprint system is 70% complete but the critical 30% (deployment and context injection) is the entire value proposition for presale consultations. **Prioritize P2.1-P2.4 (Atelier Deployment)** as this is the technical moat.

---

*Report generated by Claude Code audit on January 19, 2026*

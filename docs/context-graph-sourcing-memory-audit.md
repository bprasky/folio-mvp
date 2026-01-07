# Context Graph + Sourcing Memory - Integration Audit

**Mode:** Audit-only. No functional changes. No refactors. No migrations.

**Date:** 2025-01-27

**Goal:** Map existing architecture and identify lowest-risk integration points for:
- Tagging → vendor resolution (existing vs missing vendor)
- Relationship logging (designer↔vendor edges)
- Designer "directory/dashboard" recall queries ("what project did I use the blue rug in?")

---

## A) Tagging Pipeline

### Entry Point
**File:** `src/app/api/tag-product-to-image/route.ts`  
**Function:** `POST(request: NextRequest)`

### Payload Shape
```typescript
{
  x: number,              // Tag coordinate (0-100)
  y: number,              // Tag coordinate (0-100)
  productId: string,      // Required: existing Product.id
  projectId: string,      // Required: project context
  imageId: string,        // Required: ProjectImage.id
  repEmail?: string       // Optional: vendor rep email for auto-follow
}
```

### DB Writes Performed
1. **ProductTag** (primary write)
   - Model: `ProductTag` (prisma/schema.prisma:354-367)
   - Fields written: `x`, `y`, `productId`, `imageId`
   - Relations: `ProductTag → Product`, `ProductTag → ProjectImage`

2. **PendingRepInvite** (conditional, if repEmail provided)
   - Model: `PendingRepInvite` (prisma/schema.prisma:658-690)
   - Fields: `email`, `vendorOrganizationId`, `designerId`, `projectId`, `projectTagId`, `token`
   - Status: `PENDING`

3. **Follow** (conditional, if rep exists)
   - Model: `Follow` (prisma/schema.prisma:692-705)
   - Creates: `followerId: rep.id → followingId: designer.id`

4. **AtelierSignal** (downstream effect)
   - Model: `AtelierSignal` (prisma/schema.prisma:1376-1400)
   - Records: vendor name, product category, room type
   - Source: `AtelierSignalSourceType.PRODUCT_TAG`

### Downstream Triggers
1. **Atelier Signal Recording** (lines 170-210)
   - Records vendor signal: `vendor:{vendorName}`
   - Records category: `productCategory:{category}`
   - Records room: `room:{roomName}` (if available)

2. **Rep Auto-Follow** (lines 109-129)
   - If rep exists, creates Follow relationship
   - Auto-follows designer when rep creates account

3. **Pending Rep Invite** (lines 133-166)
   - Creates invite token if rep doesn't exist
   - Links to vendor organization if product has vendor org

### Client-Side Entry Point
**File:** `src/components/AdvancedTagProducts.tsx`  
**Function:** `handleTagProduct()` (lines 111-155)

- Calls: `POST /api/tag-product-to-image`
- Payload: `{ x, y, imageId, projectId, productId }`
- Updates local state after success

### Related Models
- **ProductTag** (schema.prisma:354-367)
  - `id`, `x`, `y`, `productId`, `imageId`, `createdAt`, `updatedAt`
  - Relations: `product`, `image`, `pendingRepInvites[]`

- **Product** (schema.prisma:301-352)
  - `id`, `name`, `vendorId` (nullable), `vendorRecordId` (nullable)
  - Relations: `vendor` (User), `vendorRecord` (Vendor), `tags[]`

- **ProjectImage** (schema.prisma:260-276)
  - `id`, `url`, `room` (String?), `projectId`
  - Relations: `tags[]`, `project`

### Existing Vendor Lookup Logic
**Location:** `src/app/api/tag-product-to-image/route.ts` (lines 72-84)

```typescript
// Tag creation includes vendor lookup
include: {
  product: {
    include: {
      vendor: {  // User with role='VENDOR'
        include: {
          organizationUsers: {
            include: { organization: true }
          }
        }
      }
    }
  }
}
```

**Current behavior:**
- Product may have `vendorId` (User.id) OR `vendorRecordId` (Vendor.id)
- Vendor is looked up via `product.vendor` (User relation) or `product.vendorRecord` (Vendor relation)
- If product has vendor org, it's used for `PendingRepInvite.vendorOrganizationId`

---

## B) Vendor Identity + "Vendor Not on Folio" Behavior

### Current Vendor Data Models

#### 1. Vendor Model (Prisma)
**File:** `prisma/schema.prisma` (lines 1180-1206)

```prisma
model Vendor {
  id          String   @id @default(cuid())
  name        String
  website     String?
  logoUrl     String?
  primaryEmail String? @unique
  country     String?
  city        String?
  userId      String?  // Optional: links to User if vendor has account
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  products      Product[]
  previewTokens VendorPreviewToken[]
  atelierFingerprints AtelierFingerprint[]
  atelierSignals      AtelierSignal[]
  eventVendorEdges    EventVendorEdge[]
}
```

**Key Fields:**
- `name`: Vendor name (required)
- `primaryEmail`: Unique email (nullable, but unique if set)
- `userId`: Optional link to User account (nullable)
- `website`, `logoUrl`, `country`, `city`: Optional metadata

#### 2. User Model (Vendor Role)
**File:** `prisma/schema.prisma` (lines 11-87)

- Users with `role: 'VENDOR'` can be vendors
- `isVendorRep: Boolean` flag
- `vendorOrganizationId: String?` links to Organization
- Products can have `vendorId: String?` pointing to User.id

#### 3. Organization Model (Vendor Type)
**File:** `prisma/schema.prisma` (lines 482-499)

- Organizations with `type: 'VENDOR'` represent vendor companies
- Linked via `OrganizationUser` junction table
- Projects can have `vendorOrgId: String?`

### Vendor Creation Paths

#### Path 1: Designer Creates Product with Vendor Name
**File:** `src/app/api/designer/products/route.ts` (lines 6-37)

```typescript
// Creates lightweight vendor User for attribution
const normalizedVendor = (vendorName?.trim() || 'External Vendor').slice(0, 80);
const vendorEmail = `vendor+${normalizedVendor.toLowerCase().replace(/\s+/g, '-')}${Math.floor(Math.random() * 1e6)}@folio.local`;

const vendor = await prisma.user.create({
  data: { 
    email: vendorEmail, 
    name: normalizedVendor, 
    role: 'VENDOR', 
    passwordHash: 'external' 
  },
});
```

**Behavior:**
- Creates User with `role: 'VENDOR'`
- Email is synthetic: `vendor+{name}@{random}@folio.local`
- No Vendor record created
- Product gets `vendorId: vendor.id` (User.id)

#### Path 2: Admin Creates Vendor (JSON File)
**File:** `src/app/api/admin/vendors/route.ts` (lines 25-82)

```typescript
// Writes to src/data/vendors.json (NOT database)
const vendorsPath = join(process.cwd(), 'src', 'data', 'vendors.json');
// Creates vendor object with generated ID
const vendorId = `vendor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

**Behavior:**
- Writes to JSON file, NOT Prisma database
- No Vendor model record created
- Legacy system (likely for demo/admin tools)

#### Path 3: Material Bank Import Tool
**File:** `.cursor/tools/normalize-to-folio.ts` (lines 60-110)

```typescript
async function getOrCreateVendor(vendorName: string): Promise<Vendor> {
  // Tries to find existing vendor via API
  const searchRes = await fetch(`${FOLIO_BASE}/api/vendors?search=${vendorName}`);
  // If not found, creates via POST /api/vendors
}
```

**Behavior:**
- Calls `/api/vendors` endpoint (which writes to JSON file, not DB)
- Does NOT create Vendor model record
- Used for Material Bank product imports

#### Path 4: Product Update with Vendor Name
**File:** `src/app/api/products/[productId]/route.ts` (lines 89-102)

```typescript
// Finds vendor by name (User with role VENDOR)
if (vendorName) {
  const vendor = await prisma.user.findFirst({
    where: {
      role: 'VENDOR',
      OR: [
        { name: { equals: vendorName, mode: 'insensitive' } },
        { companyName: { equals: vendorName, mode: 'insensitive' } }
      ]
    }
  });
  vendorId = vendor?.id;
}
```

**Behavior:**
- Looks up existing User with `role: 'VENDOR'`
- Does NOT create Vendor model record
- Updates product `vendorId` if found

### "Vendor Exists on Folio" Definition

**Current State:**
1. **Vendor User exists** (`User.role === 'VENDOR'`)
   - Check: `prisma.user.findFirst({ where: { role: 'VENDOR', name: vendorName } })`
   - Used in: Product updates, designer product creation

2. **Vendor Organization exists** (`Organization.type === 'VENDOR'`)
   - Check: Via `OrganizationUser` junction table
   - Used in: Project handoffs, rep invitations

3. **Vendor model record exists** (`Vendor` table)
   - Check: `prisma.vendor.findFirst({ where: { name: vendorName } })`
   - **RARELY USED** - Most code paths don't check this
   - Product can have `vendorRecordId` but it's often null

**Gap:**
- No unified "vendor exists" check
- Vendor model exists in schema but is underutilized
- Most code creates User records, not Vendor records
- Product can have both `vendorId` (User) and `vendorRecordId` (Vendor), but they're not always in sync

### Vendor Pages/Routes

**Existing Routes:**
- `/api/admin/vendors` - JSON file-based vendor management (legacy)
- `/api/vendors/events/create` - Vendor event creation
- `/vendor/dashboard` - Vendor dashboard (shows projects)
- `/vendor/project/[id]` - Vendor project management

**No dedicated vendor profile pages found** (e.g., `/vendor/[id]` or `/vendors/[slug]`)

### Vendor Auth/Roles

**Current System:**
- Users with `role: 'VENDOR'` can authenticate
- `isVendorRep: Boolean` flag for vendor representatives
- `vendorOrganizationId: String?` links rep to organization
- Organization-based access control via `OrganizationUser` table

**No vendor-specific auth flow found** (e.g., vendor claim/invite system beyond `PendingRepInvite`)

---

## C) Designer Dashboard / Directory Surfaces

### Existing Dashboard
**File:** `src/app/designer/page.tsx`

**Current Features:**
- Project grid view (all projects, drafts + published)
- Project creation modal
- Project visibility toggle (public/private)
- Project stats (views, saves, shares)
- Admin mode: filter by designer

**Missing:**
- No vendor/product directory
- No "my vendors" list
- No sourcing memory/search
- No recall queries ("what project used X?")

### Candidate UI Insertion Points

#### Option A: Designer Dashboard Card + Search (RECOMMENDED)
**Location:** `src/app/designer/page.tsx`

**Why:**
- Already shows project grid
- Has tab system (`activeTab: 'portfolio' | 'projects'`)
- Could add new tab: `'directory'` or `'sourcing'`
- Or add search bar above project grid
- Reuses existing project card components

**Implementation:**
- Add search input at top of dashboard
- Add filter chips: "Vendors", "Products", "Rooms", "Projects"
- Results show: products with project/room context
- Click product → navigate to project detail page

#### Option B: New Directory Page
**Location:** `src/app/designer/directory/page.tsx` (NEW)

**Why:**
- Dedicated space for sourcing memory
- Can have richer UI (vendor cards, product grid, filters)
- Doesn't clutter main dashboard
- Can link from dashboard nav

**Implementation:**
- New route: `/designer/directory`
- Shows: vendors used, products tagged, projects by vendor
- Search bar with autocomplete
- Filter by vendor, category, room, project

### Existing Components to Reuse

1. **Search Input**
   - Pattern: `src/components/selection/CatalogPicker.tsx` (lines 63-137)
   - Has search input with debounce
   - Can be adapted for directory search

2. **Product Grid**
   - Pattern: `src/components/AdvancedTagProducts.tsx` (lines 346-389)
   - Shows products in grid with images
   - Can be reused for directory results

3. **Project Cards**
   - Pattern: `src/app/designer/page.tsx` (project grid section)
   - Already shows project cards with images
   - Can link to project detail pages

4. **Tables**
   - No existing table components found
   - Would need to create or use shadcn/ui table

### Global Search (Internal)

**Existing Search:**
- `src/app/api/products/search/route.ts` - Product search by name
- `src/components/selection/CatalogPicker.tsx` - Product picker with search
- No global search across projects/vendors/products found

**Gap:**
- No unified search that spans products, vendors, projects, rooms
- Product search only searches `Product.name`
- No search by vendor name, room name, or project title

---

## D) Minimal "Recall" Feature Path (Using Existing Data)

### Data Available for Recall Queries

#### Query: "blue rug" → What project did I use this in?

**Available Data:**
1. **ProductTag** table
   - Links: `ProductTag → Product → name/brand`
   - Links: `ProductTag → ProjectImage → projectId, room`
   - Can search: `product.name`, `product.brand`, `image.room`

2. **Selection** table
   - Fields: `productName`, `vendorName`, `roomId`, `projectId`
   - Can search: `productName`, `vendorName`, `room.name`

3. **Product** table
   - Fields: `name`, `brand`, `category`, `vendorId`
   - Can search: `name`, `brand`, `category`

4. **ProjectImage** table
   - Fields: `room` (String?), `projectId`
   - Can search: `room` (if set)

5. **Room** table
   - Fields: `name`, `type`, `projectId`
   - Can search: `name`, `type`

### Minimal Query Approach

**SQL/Prisma Query Pattern:**

```typescript
// Search across ProductTag + Product + ProjectImage + Room
const results = await prisma.productTag.findMany({
  where: {
    image: {
      project: {
        designerId: session.user.id,  // Scope to designer
        OR: [
          { ownerId: session.user.id }
        ]
      }
    },
    OR: [
      { product: { name: { contains: query, mode: 'insensitive' } } },
      { product: { brand: { contains: query, mode: 'insensitive' } } },
      { image: { room: { contains: query, mode: 'insensitive' } } }
    ]
  },
  include: {
    product: { select: { id: true, name: true, brand: true, imageUrl: true } },
    image: {
      include: {
        project: {
          select: { id: true, title: true, designerId: true }
        }
      }
    }
  },
  orderBy: { createdAt: 'desc' },
  take: 20
});
```

**Also search Selections:**

```typescript
const selectionResults = await prisma.selection.findMany({
  where: {
    project: {
      designerId: session.user.id,
      OR: [{ ownerId: session.user.id }]
    },
    OR: [
      { productName: { contains: query, mode: 'insensitive' } },
      { vendorName: { contains: query, mode: 'insensitive' } },
      { room: { name: { contains: query, mode: 'insensitive' } } }
    ]
  },
  include: {
    project: { select: { id: true, title: true } },
    room: { select: { id: true, name: true } }
  },
  orderBy: { createdAt: 'desc' },
  take: 20
});
```

### Where It Should Live

**Option A: Designer Dashboard Search (RECOMMENDED)**
- Add search bar to `src/app/designer/page.tsx`
- Show results in modal or dropdown
- Click result → navigate to project detail page

**Option B: Directory Page**
- New route: `/designer/directory`
- Full-page search with filters
- Results in grid/list view

### Permission Scoping

**Current Pattern:**
- Projects have `designerId` and `ownerId`
- Check: `project.designerId === session.user.id || project.ownerId === session.user.id`
- Used in: `src/app/api/tag-product-to-image/route.ts` (lines 29-38)

**For Recall Queries:**
- Scope all queries to designer's projects
- Filter: `project.designerId === session.user.id OR project.ownerId === session.user.id`
- No cross-designer data leakage

---

## E) Integration Points Summary

### Hook 1: Tag Create
**File:** `src/app/api/tag-product-to-image/route.ts`  
**Function:** `POST()` (lines 11-225)

**Insertion Points:**

1. **After ProductTag.create()** (line 64)
   - **Action:** Resolve vendor (existing vs shadow vendor)
   - **Logic:**
     ```typescript
     // After tag creation, check if product has vendor
     const product = tag.product;
     if (!product.vendorId && !product.vendorRecordId) {
       // Product has no vendor - create shadow vendor
       const shadowVendor = await resolveOrCreateShadowVendor(product.brand || product.name);
       // Link product to shadow vendor
       await prisma.product.update({
         where: { id: product.id },
         data: { vendorRecordId: shadowVendor.id }
       });
     }
     ```

2. **After vendor resolution** (after line 91)
   - **Action:** Write designer↔vendor edge
   - **Logic:**
     ```typescript
     // Record designer-vendor relationship
     const vendorId = tag.product.vendorRecordId || tag.product.vendorId;
     if (vendorId && tag.image.project.designerId) {
       await prisma.graphEdge.create({
         data: {
           srcType: 'designer',
           srcId: tag.image.project.designerId,
           dstType: 'vendor',
           dstId: vendorId,
           kind: 'uses',
           weight: 1.0,
           decayAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
         }
       });
     }
     ```

3. **After edge logging** (after vendor edge write)
   - **Action:** Append sourcing memory item
   - **Logic:**
     ```typescript
     // Create sourcing memory entry (could be a new table or use existing)
     await prisma.contextSignal.create({
       data: {
         userId: tag.image.project.designerId,
         vendorId: vendorId,
         productId: product.id,
         projectId: tag.image.project.id,
         action: 'tagged',
         tags: [product.category, tag.image.room].filter(Boolean),
         meta: {
           imageId: tag.image.id,
           room: tag.image.room,
           taggedAt: tag.createdAt
         }
       }
     });
     ```

### Hook 2: Designer Dashboard
**File:** `src/app/designer/page.tsx`

**Insertion Points:**

1. **Add search bar** (above project grid, line ~200)
   - **Action:** Add search input component
   - **Query endpoint:** `GET /api/designer/recall?q={query}`
   - **Results:** Show products with project/room context

2. **Add directory tab** (in tab system, line 15)
   - **Action:** Add `'directory'` to `activeTab` type
   - **UI:** Show vendor/product directory view
   - **Query:** `GET /api/designer/directory`

### Hook 3: Vendor Claim / Invite
**Current System:** `PendingRepInvite` (schema.prisma:658-690)

**Enhancement Points:**

1. **Vendor model claim** (if vendor has `userId === null`)
   - **Action:** Allow vendor to claim Vendor record
   - **Logic:** Update `Vendor.userId` when rep claims invite
   - **Location:** Rep onboarding flow

2. **Shadow vendor → real vendor** (when vendor signs up)
   - **Action:** Merge shadow vendor into real vendor
   - **Logic:** Update all products with `vendorRecordId` to point to real vendor
   - **Location:** Vendor signup/claim flow

---

## F) Deliverable: Audit Map

### Tagging Pipeline
- **Files:**
  - `src/app/api/tag-product-to-image/route.ts` (POST handler)
  - `src/components/AdvancedTagProducts.tsx` (client component)
- **Entry point:** `POST /api/tag-product-to-image`
- **Models written:** `ProductTag`, `PendingRepInvite` (conditional), `Follow` (conditional), `AtelierSignal`
- **Payload shape:** `{ x, y, productId, projectId, imageId, repEmail? }`
- **Downstream triggers:** Atelier signal recording, rep auto-follow, pending rep invite

### Vendor Model + Existence Check
- **Model:** `Vendor` (schema.prisma:1180-1206) - underutilized
- **Creation paths:**
  1. Designer creates product → creates User with role='VENDOR' (NOT Vendor model)
  2. Admin creates vendor → writes to JSON file (NOT Vendor model)
  3. Material Bank import → calls JSON API (NOT Vendor model)
  4. Product update → looks up User with role='VENDOR' (NOT Vendor model)
- **"On Folio" definition:** 
  - Currently: User with role='VENDOR' OR Organization with type='VENDOR'
  - Vendor model exists but rarely used
  - Gap: No unified vendor existence check

### Best Integration Point
**Exactly where to implement:**

1. **Vendor resolution fallback ("shadow vendor")**
   - **Location:** `src/app/api/tag-product-to-image/route.ts` (after line 91)
   - **Function:** `resolveOrCreateShadowVendor(vendorName: string): Promise<Vendor>`
   - **Logic:**
     ```typescript
     // Check if Vendor exists by name
     let vendor = await prisma.vendor.findFirst({
       where: { name: { equals: vendorName, mode: 'insensitive' } }
     });
     
     // If not, create shadow vendor
     if (!vendor) {
       vendor = await prisma.vendor.create({
         data: {
           name: vendorName,
           // userId: null (unclaimed)
           // primaryEmail: null (no account yet)
         }
       });
     }
     
     return vendor;
     ```

2. **Edge logging**
   - **Location:** `src/app/api/tag-product-to-image/route.ts` (after vendor resolution)
   - **Model:** `GraphEdge` (schema.prisma:1108-1124) - already exists!
   - **Logic:**
     ```typescript
     await prisma.graphEdge.create({
       data: {
         srcType: 'designer',
         srcId: designerId,
         dstType: 'vendor',
         dstId: vendor.id,
         kind: 'uses',
         weight: 1.0,
         decayAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
       }
     });
     ```

3. **Sourcing memory item write**
   - **Location:** `src/app/api/tag-product-to-image/route.ts` (after edge logging)
   - **Model:** `ContextSignal` (schema.prisma:1077-1094) - already exists!
   - **Logic:**
     ```typescript
     await prisma.contextSignal.create({
       data: {
         userId: designerId,
         vendorId: vendor.id,
         productId: product.id,
         projectId: project.id,
         action: 'tagged',
         tags: [product.category, image.room].filter(Boolean),
         meta: { imageId, room: image.room, taggedAt: new Date() }
       }
     });
     ```

### Designer Recall UI Recommendation

**Option A: Dashboard card + search (RECOMMENDED)**
- **Location:** `src/app/designer/page.tsx`
- **Why:**
  - Already has project grid
  - Has tab system (can add 'directory' tab)
  - Reuses existing components
  - Low friction (no new route)
- **Implementation:**
  - Add search bar above project grid
  - Add `GET /api/designer/recall?q={query}` endpoint
  - Show results in modal/dropdown
  - Click → navigate to project detail

**Option B: Directory page**
- **Location:** `src/app/designer/directory/page.tsx` (NEW)
- **Why:**
  - Dedicated space for sourcing memory
  - Richer UI possible
  - Doesn't clutter dashboard
- **Implementation:**
  - New route: `/designer/directory`
  - Full-page search with filters
  - Results in grid/list view

### Minimal Query Spec

**Endpoint:** `GET /api/designer/recall?q={query}`

**Query Logic:**
```typescript
// Search ProductTags
const tagResults = await prisma.productTag.findMany({
  where: {
    image: {
      project: {
        OR: [
          { designerId: session.user.id },
          { ownerId: session.user.id }
        ]
      }
    },
    OR: [
      { product: { name: { contains: query, mode: 'insensitive' } } },
      { product: { brand: { contains: query, mode: 'insensitive' } } },
      { image: { room: { contains: query, mode: 'insensitive' } } }
    ]
  },
  include: {
    product: true,
    image: { include: { project: { select: { id: true, title: true } } } }
  },
  take: 20
});

// Search Selections
const selectionResults = await prisma.selection.findMany({
  where: {
    project: {
      OR: [
        { designerId: session.user.id },
        { ownerId: session.user.id }
      ]
    },
    OR: [
      { productName: { contains: query, mode: 'insensitive' } },
      { vendorName: { contains: query, mode: 'insensitive' } },
      { room: { name: { contains: query, mode: 'insensitive' } } }
    ]
  },
  include: {
    project: { select: { id: true, title: true } },
    room: { select: { id: true, name: true } }
  },
  take: 20
});

// Combine and deduplicate
return [...tagResults, ...selectionResults];
```

**Response Shape:**
```typescript
{
  results: [
    {
      type: 'productTag' | 'selection',
      product: { id, name, brand, imageUrl },
      project: { id, title },
      room: string | null,
      taggedAt: Date
    }
  ]
}
```

---

## Summary

### Key Findings

1. **Tagging Pipeline:** Well-defined entry point at `POST /api/tag-product-to-image`. Already writes `ProductTag`, `PendingRepInvite`, `Follow`, `AtelierSignal`. Perfect hook for vendor resolution and edge logging.

2. **Vendor Model:** Exists in schema but underutilized. Most code creates `User` records with `role='VENDOR'` instead of `Vendor` records. Gap: No unified vendor existence check.

3. **Designer Dashboard:** Has project grid but no directory/search. Can add search bar or new tab. Reuses existing components.

4. **Recall Queries:** Can use existing `ProductTag` and `Selection` tables. Query across `product.name`, `product.brand`, `image.room`, `selection.productName`, `selection.vendorName`.

5. **Integration Points:**
   - **Vendor resolution:** After `ProductTag.create()` in tag route
   - **Edge logging:** Use existing `GraphEdge` model (already in schema!)
   - **Sourcing memory:** Use existing `ContextSignal` model (already in schema!)
   - **Recall UI:** Add search to designer dashboard or new directory page

### Next Steps (After Audit)

1. Implement `resolveOrCreateShadowVendor()` function
2. Add edge logging after tag creation
3. Add sourcing memory write after edge logging
4. Create `GET /api/designer/recall` endpoint
5. Add search UI to designer dashboard

**No migrations needed** - all required models (`GraphEdge`, `ContextSignal`, `Vendor`) already exist in schema!









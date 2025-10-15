# Affiliate Tag & Publish Project Flow - Codebase Audit

**🔍 AUDIT ONLY** - No changes made  
**Date:** October 7, 2025  
**Goal:** Locate existing affiliate tagging and project publish flow for wiring to Designer Profile and Navigation

---

## Executive Summary

### ✅ What EXISTS

| Component | Status | Location |
|-----------|--------|----------|
| **Project Model** | ✅ Exists | `prisma/schema.prisma` |
| **isPublic Toggle** | ✅ Implemented | `src/app/designer/page.tsx` |
| **Publish Flow** | ✅ Partial | `src/app/designer/create/page.tsx` |
| **Product Tagging** | ✅ Exists | `src/components/AdvancedTagProducts.tsx` |
| **Affiliate URL Gen** | ✅ Exists | `src/lib/urls.ts` |
| **Create Chooser** | ✅ Exists | `src/components/CreateProjectChooser.tsx` |

### ⚠️ What's MISSING

| Component | Status | Impact |
|-----------|--------|--------|
| **AffiliateLink Model** | ❌ Missing | No DB persistence for affiliate codes |
| **publishedAt Field** | ❌ Missing | No timestamp tracking |
| **Publish Server Action** | ❌ Missing | No unified publish endpoint |
| **Affiliate Ensure Logic** | ❌ Missing | No auto-generation on publish |
| **Designer Profile Publish** | ❌ Missing | No publish button in profile grid |

---

## 1. Database Schema (Prisma)

### Current Project Model
**File:** `prisma/schema.prisma` (Lines 122-161)

```prisma
model Project {
  id               String         @id @default(uuid())
  title            String         @default("")
  description      String?
  status           String         @default("active")  // ⚠️ String, not enum
  stage            ProjectStage   @default(concept)
  isPublic         Boolean        @default(false)     // ✅ Visibility toggle
  isAIEnabled      Boolean        @default(false)
  views            Int            @default(0)
  saves            Int            @default(0)
  shares           Int            @default(0)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  designerId       String?
  ownerId          String
  projectType      ProjectType    @default(UNSPECIFIED)
  clientType       ClientType     @default(RESIDENTIAL)
  budgetBand       BudgetBand     @default(UNSPECIFIED)
  city             String?
  regionState      String?
  
  // Relations
  files            ProjectFile[]
  images           ProjectImage[] // ✅ Has product tags relation
  designer         User?          @relation("DesignerProjects")
  owner            User           @relation("OwnedProjects")
  rooms            Room[]
  selections       Selection[]    // ✅ Products/specs
  
  @@map("projects")
}
```

### Product Tagging Chain
**Files:** `prisma/schema.prisma`

```prisma
Project → ProjectImage → ProductTag → Product
```

**Product Tags Model (Lines 199-211):**
```prisma
model ProductTag {
  id        String       @id @default(uuid())
  x         Float        // Tag coordinate
  y         Float        // Tag coordinate
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  productId String
  imageId   String
  
  image     ProjectImage @relation(fields: [imageId], references: [id])
  product   Product      @relation(fields: [productId], references: [id])
  
  @@map("product_tags")
}
```

### ⚠️ Missing Fields

**Project needs:**
- `publishedAt DateTime?` - Track when first published
- Consider enum `ProjectStatus` (DRAFT, PUBLISHED, ARCHIVED)

**Missing Model - AffiliateLink:**
```prisma
// NOT FOUND - Needs to be created
model AffiliateLink {
  id         String   @id @default(cuid())
  code       String   @unique
  designerId String
  projectId  String
  productId  String
  createdAt  DateTime @default(now())
  clicks     Int      @default(0)
  
  designer   User     @relation(...)
  project    Project  @relation(...)
  product    Product  @relation(...)
  
  @@unique([designerId, projectId, productId])
}
```

---

## 2. Server-Side Logic

### A. Project Creation Action
**File:** `src/app/actions/projects.ts` (Lines 8-57)

**Function:** `createProjectAction`

```typescript
// ✅ EXISTS - Handles intent: 'folder' | 'publish_now'
export async function createProjectAction(input: {
  name: string;
  description?: string;
  intent: 'folder' | 'publish_now';  // ✅ Intent-based creation
}) {
  // Auth check
  // Permission check
  
  const project = await prisma.project.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: input.intent === 'publish_now' ? 'active' : 'draft',
      isPublic: input.intent === 'publish_now',  // ✅ Sets public on publish_now
      // ...other fields
    },
  });
  
  return { ok: true, projectId: project.id };
}
```

**Location:** `src/app/actions/projects.ts`  
**Features:**
- ✅ Authorization check (session + role)
- ✅ Permission check via `canCreateProject(role)`
- ✅ Sets `isPublic: true` when `intent === 'publish_now'`
- ✅ Sets `status: 'active'` vs. `'draft'`
- ⚠️ Does NOT generate affiliate links

### B. Affiliate URL Generation
**File:** `src/lib/urls.ts` (Lines 45-60)

**Function:** `generateAffiliateUrl`

```typescript
// ✅ EXISTS - Generates UTM-tagged URLs
export function generateAffiliateUrl(
  baseUrl: string, 
  designerId: string, 
  postTitle: string,
  utmSource: string = 'folio',
  utmMedium: string = 'designer'
): string {
  const params = {
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: slugify(postTitle),
    aff: designerId  // ✅ Affiliate ID embedded
  };
  
  return addQueryParams(baseUrl, params);
}
```

**Usage:** Currently only used in `src/app/api/designer/posts/route.ts` for post items, NOT for project products.

**Location:** `src/lib/urls.ts`  
**Features:**
- ✅ UTM parameter injection
- ✅ Designer ID as `aff` parameter
- ✅ Slugified campaign names
- ⚠️ NOT integrated with project product tagging

### C. Project Visibility Toggle
**File:** `src/app/designer/page.tsx` (Lines 144-174)

**Function:** `handleToggleVisibility`

```typescript
// ✅ EXISTS - Toggles isPublic via API
const handleToggleVisibility = async (projectId: string, currentVisibility: string) => {
  const newVisibility = currentVisibility === 'public' ? 'private' : 'public';
  
  const response = await fetch('/api/projects', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: projectId,
      visibility: newVisibility  // ⚠️ Uses 'visibility' not 'isPublic'
    }),
  });
  
  if (response.ok) {
    // Update local state
    setProjects(prevProjects => 
      prevProjects.map(project => 
        project.id === projectId 
          ? { ...project, visibility: newVisibility }
          : project
      )
    );
  }
};
```

**Location:** `src/app/designer/page.tsx`  
**Issues:**
- ⚠️ Uses `visibility` field (not in schema—should be `isPublic`)
- ⚠️ No affiliate link generation on publish
- ✅ Optimistic UI update

### D. Product Tagging API
**File:** `src/app/api/tag-product-to-image/route.ts`

**Endpoints:**
```typescript
POST /api/tag-product-to-image
  Body: { x, y, imageUrl, productId, projectId }
  Storage: ⚠️ In-memory only (not persisted to DB)
  
GET /api/tag-product-to-image?projectId=X&imageUrl=Y
  Returns: Array of tags (from memory, not DB)
```

**⚠️ CRITICAL ISSUE:** Tags are stored in memory only! This is demo code:
```typescript
// Line 3-13
let productTags: Array<{...}> = [];  // ⚠️ In-memory, lost on restart
```

**Location:** `src/app/api/tag-product-to-image/route.ts`  
**Status:** Demo implementation—needs database persistence

---

## 3. UI Components

### A. Create Project Chooser (Navigation)
**File:** `src/components/CreateProjectChooser.tsx`

**Purpose:** Modal that lets designers choose:
1. **"Project Folder"** → `/designer/create?intent=folder`
2. **"Publish Now"** → `/designer/create?intent=publish_now`

```typescript
// ✅ EXISTS - Two-path chooser
const goFolder = () => {
  router.push('/designer/create?intent=folder');
  onClose();
};

const goPublishNow = () => {
  router.push('/designer/create?intent=publish_now');  // ✅ Publish flow exists
  onClose();
};
```

**Triggered By:** Navigation component (Line 414 in `src/components/Navigation.tsx`)
```tsx
{showCreateChooser && (
  <CreateProjectChooser onClose={() => setShowCreateChooser(false)} />
)}
```

**Wiring Point #1 (Navigation):** ✅ Already wired  
Button: `<button onClick={() => setShowCreateChooser(true)}>`  
Location: `src/components/Navigation.tsx` (Lines 393-416)

### B. Publish Now Flow
**File:** `src/app/designer/create/page.tsx` (Lines 235-331)

**Component:** `PublishNowFlow`

```typescript
// ✅ EXISTS - Minimal publish flow
function PublishNowFlow() {
  const [step, setStep] = useState<'meta' | 'tag'>('meta');
  const [projectId, setProjectId] = useState<string | null>(null);
  
  async function handleCreate(e: React.FormEvent) {
    const res = await createProjectAction({ 
      name, 
      description: desc, 
      intent: 'publish_now'  // ✅ Creates with isPublic: true
    });
    
    if (res?.ok && res.projectId) {
      setProjectId(res.projectId);
      setStep('tag');  // ⚠️ Tag step not implemented
    }
  }
  
  // ⚠️ TODO: Tag step just redirects to project page
  if (projectId) {
    router.replace(`/project/${projectId}`);  // No tag UI shown
  }
}
```

**Status:**
- ✅ Creates project with `isPublic: true`
- ⚠️ "Tag" step is placeholder—redirects to project page
- ⚠️ No affiliate link generation

### C. Product Tagging Component
**File:** `src/components/AdvancedTagProducts.tsx`

**Purpose:** Visual tagging interface for marking products on project images

```typescript
// ✅ EXISTS - Full tagging UI
export default function AdvancedTagProducts({ 
  imageUrl, 
  projectId, 
  existingTags = [],
  onTagsUpdate,
  isEditable = true 
}) {
  // Handles:
  // - Click on image to place tag
  // - Product search/selection modal
  // - Save tag via POST /api/tag-product-to-image
  // - Delete tag via DELETE /api/tag-product-to-image/{id}
  // - Visual tag markers with hover info
}
```

**Save Logic (Lines 109-154):**
```typescript
const handleTagProduct = async () => {
  const res = await fetch("/api/tag-product-to-image", {
    method: "POST",
    body: JSON.stringify({
      x: selected.x,
      y: selected.y,
      imageUrl,
      projectId,
      productId: selectedProductId,
    }),
  });
  
  if (res.ok) {
    const newTag = { id: result.id, x, y, productId, product };
    setTags([...tags, newTag]);
    onTagsUpdate?.(updatedTags);  // ✅ Callback to parent
  }
}
```

**⚠️ Issue:** Tags save to in-memory store, not database

### D. Designer Profile Projects
**File:** `src/app/designer/page.tsx`

**Component:** Designer dashboard with project grid

**Key Features (Lines 294-370):**
```tsx
// ✅ EXISTS - Project card with controls
{projects.map(project => (
  <div key={project.id}>
    <SafeImage src={project.images?.[0]?.url} />
    
    {/* Visibility Toggle - Lines 305-316 */}
    <button onClick={() => handleToggleVisibility(project.id, project.visibility)}>
      {project.visibility === 'public' ? <FaEye /> : <FaEyeSlash />}
    </button>
    
    {/* Edit Button */}
    <button onClick={() => handleEditProject(project)}>
      <FaEdit />
    </button>
    
    {/* Delete Button */}
    <button onClick={() => handleDeleteProject(project.id)}>
      <FaTrash />
    </button>
    
    {/* Status Badge */}
    <span className={project.status === 'published' ? 'green' : 'gray'}>
      {project.status}
    </span>
  </div>
))}
```

**Wiring Point #2 (Designer Profile):** ✅ Partially wired
- ✅ Has visibility toggle (line 307)
- ✅ Has edit button (line 319)
- ⚠️ **NO "Publish" button** - only toggles visibility
- ⚠️ **NO affiliate generation** on toggle

### E. Project Creation Modal
**File:** `src/components/ProjectCreationModal.tsx`

**Status:** Large modal component for creating/editing projects

**Key Code (Lines 342-408):**
```typescript
const handleCreateProject = async () => {
  const projectData: any = {
    name: projectName,
    description: projectDescription,
    images: validImages,
    status: 'published',      // ✅ Sets status
    isDraft: false            // ✅ Not a draft
  };
  
  const response = await fetch('/api/projects', {
    method: editingProject ? 'PUT' : 'POST',
    body: JSON.stringify(projectData),
  });
  
  if (response.ok) {
    const newProject = await response.json();
    onProjectCreated(newProject);  // ✅ Callback to parent
  }
}
```

**Features:**
- ✅ Multi-step wizard (details → images → tags → settings)
- ✅ Image upload with validation
- ✅ Status field management
- ⚠️ No affiliate link generation step

---

## 4. Navigation & Entry Points

### A. Navigation Create Button
**File:** `src/components/Navigation.tsx` (Lines 393-416)

```tsx
{/* ✅ Create button exists for designers */}
{session?.user && canCreateProject(role) && (
  <>
    {role === 'DESIGNER' ? (
      <button onClick={() => setShowCreateChooser(true)}>
        <FaPlus /> {createCfg.label}
      </button>
    ) : (
      <Link href={createCfg.href}>
        <FaPlus /> {createCfg.label}
      </Link>
    )}
  </>
)}

{/* ✅ Chooser modal wired */}
{showCreateChooser && (
  <CreateProjectChooser onClose={() => setShowCreateChooser(false)} />
)}
```

**Flow:**
1. Designer clicks "+ Create" button
2. `CreateProjectChooser` modal opens
3. Designer chooses:
   - "Project Folder" → `/designer/create?intent=folder`
   - "Publish Now" → `/designer/create?intent=publish_now`

**Status:** ✅ Already wired correctly

### B. Publish Now Page
**File:** `src/app/designer/create/page.tsx` (Lines 235-331)

```typescript
// ✅ EXISTS - Handles ?intent=publish_now
function PublishNowFlow() {
  // Step 1: Meta (name, description)
  async function handleCreate(e: React.FormEvent) {
    const res = await createProjectAction({ 
      name, 
      description: desc, 
      intent: 'publish_now'  // ✅ Creates public project
    });
    
    if (res?.ok && res.projectId) {
      setProjectId(res.projectId);
      setStep('tag');
    }
  }
  
  // Step 2: Tag (⚠️ NOT IMPLEMENTED)
  if (projectId) {
    router.replace(`/project/${projectId}`);  // ⚠️ Skips tagging UI
  }
}
```

**Issues:**
- ✅ Creates project with `isPublic: true`
- ⚠️ **Tag step is TODO** - just redirects to project page
- ⚠️ No affiliate link generation
- ⚠️ No upload UI in this flow

---

## 5. Affiliate Link System

### Current Implementation
**File:** `src/lib/urls.ts` (Lines 45-60)

**Function:** `generateAffiliateUrl`

```typescript
// ✅ EXISTS - URL utility
export function generateAffiliateUrl(
  baseUrl: string, 
  designerId: string, 
  postTitle: string
): string {
  const params = {
    utm_source: 'folio',
    utm_medium: 'designer',
    utm_campaign: slugify(postTitle),
    aff: designerId  // ✅ Designer attribution
  };
  
  return addQueryParams(baseUrl, params);
}
```

**Current Usage:**
- ✅ Used in `src/app/api/designer/posts/route.ts` (Line 54)
- ⚠️ NOT used for project products
- ⚠️ No database persistence (just URL generation)

**What's Missing:**
```typescript
// ❌ NOT FOUND - Needs to be created
export async function ensureAffiliateLink({
  productId,
  projectId,
  designerId
}: {
  productId: string;
  projectId: string;
  designerId: string;
}) {
  // Check if exists
  // Create if not exists
  // Return affiliate code
}
```

---

## 6. Project Detail Page

### Current Structure
**File:** `src/app/project/[id]/page.tsx`

**Tabs:**
- Overview (Line 167-169)
- Media (Line 171-173)  
- Boards (Line 175-183) - Shows DesignerBoard with rooms/selections

**Sidebar - Project Status (Lines 205-221):**
```tsx
<div className="bg-white p-6 rounded-lg shadow-md">
  <h2>Project Status</h2>
  <div>
    <span>Visibility:</span>
    <span className={project.isPublic ? 'green' : 'gray'}>
      {project.isPublic ? 'Public' : 'Private'}  // ✅ Shows status
    </span>
  </div>
</div>
```

**⚠️ Issues:**
- ✅ Displays `isPublic` status
- ❌ **NO toggle button** on project page
- ❌ **NO publish button** on project page
- ❌ **NO affiliate links shown** for tagged products

---

## 7. Wiring Requirements Summary

### Wiring Point #1: Navigation → "Publish Now"
**Status:** ✅ **ALREADY WIRED**

**Path:**
```
Navigation (Create button) 
  → CreateProjectChooser modal 
  → "Publish Now" button 
  → /designer/create?intent=publish_now 
  → PublishNowFlow component
  → createProjectAction({ intent: 'publish_now' })
  → Project created with isPublic: true
```

**What Works:**
- ✅ Button exists and opens chooser
- ✅ "Publish Now" option exists
- ✅ Creates public project

**What's Missing:**
- ⚠️ No product tagging UI in publish flow
- ⚠️ No affiliate link generation

---

### Wiring Point #2: Designer Profile → Projects Section
**Status:** ⚠️ **PARTIALLY WIRED**

**Current State:**
- **File:** `src/app/designer/page.tsx` (Lines 294-370)
- ✅ Has **visibility toggle** (public/private eye icon)
- ✅ Has **edit button**
- ✅ Has **delete button**
- ⚠️ **MISSING "Publish" button** for draft projects

**What to Add:**
```tsx
{/* Add this after edit button */}
{project.status === 'draft' && (
  <button 
    onClick={() => handlePublishProject(project.id)}
    className="p-2 bg-green-500 text-white rounded-full"
    title="Publish Project"
  >
    <FaCheck className="w-4 h-4" />
  </button>
)}
```

---

## 8. Data Flow Map

### Current: Product Tagging → Project
```
1. Designer creates project (via ProjectCreationModal or PublishNowFlow)
2. Project saved to DB with isPublic flag
3. Designer uploads images → ProjectImage records created
4. Designer clicks image → AdvancedTagProducts component opens
5. Designer places tag → Clicks product → Saves
6. POST /api/tag-product-to-image → ⚠️ Saves to MEMORY ONLY
7. ⚠️ No affiliate link created
```

### Desired: Affiliate Generation on Publish
```
1. Designer creates/edits project (draft)
2. Designer tags products on images
3. Designer clicks "Publish" button
4. publishProjectAction runs:
   a. ✅ Check authorization
   b. ✅ Set isPublic: true, publishedAt: now()
   c. ❌ For each tagged product → ensureAffiliateLink()
   d. ✅ Revalidate paths
   e. ❌ Emit analytics event
5. Project is public with affiliate-tracked product links
```

---

## 9. Missing Components Inventory

### Server Actions Needed

| File | Function | Purpose | Status |
|------|----------|---------|--------|
| `src/app/actions/projects.ts` | `publishProjectAction` | Unified publish + affiliate gen | ❌ Missing |
| `src/lib/affiliate/ensureLink.ts` | `ensureAffiliateLink` | Create/fetch affiliate code | ❌ Missing |
| `src/app/api/tag-product-to-image/route.ts` | Fix persistence | Save to DB not memory | ⚠️ Broken |

### UI Components Needed

| File | Component | Purpose | Status |
|------|-----------|---------|--------|
| `src/app/designer/page.tsx` | Publish button | Show for draft projects | ❌ Missing |
| `src/components/PublishProjectButton.tsx` | Reusable publish CTA | Server action wrapper | ❌ Missing |
| `src/app/project/[id]/page.tsx` | Publish toggle | Toggle on detail page | ❌ Missing |

### Database Migrations Needed

| Migration | Purpose | Status |
|-----------|---------|--------|
| Add `publishedAt` to Project | Track publish timestamp | ❌ Missing |
| Create `AffiliateLink` model | Store affiliate codes | ❌ Missing |
| Add `ProjectStatus` enum | DRAFT/PUBLISHED states | ❌ Missing |
| Fix ProductTag persistence | Save tags to DB | ⚠️ Broken |

---

## 10. Recommended Implementation Plan

### Phase 1: Database Foundation
```bash
# 1. Add fields to Project
npx prisma migrate dev --name add_project_publication_fields

# Add to schema.prisma:
model Project {
  publishedAt DateTime?
  // Consider: status → ProjectStatus enum instead of string
}

# 2. Create AffiliateLink model
npx prisma migrate dev --name create_affiliate_links

model AffiliateLink {
  id         String   @id @default(cuid())
  code       String   @unique
  designerId String
  projectId  String
  productId  String
  clicks     Int      @default(0)
  createdAt  DateTime @default(now())
  
  @@unique([designerId, projectId, productId])
}

# 3. Fix ProductTag API to use DB
# Update /api/tag-product-to-image to use prisma.productTag.create()
```

### Phase 2: Server Actions
```typescript
// Create: src/app/actions/publishProject.ts
'use server';
export async function publishProjectAction(projectId: string) {
  // 1. Auth check
  // 2. Set isPublic: true, publishedAt: now()
  // 3. Get all ProductTags for project
  // 4. For each tag → ensureAffiliateLink()
  // 5. Revalidate paths
  // 6. Emit analytics
}

// Create: src/lib/affiliate/ensureLink.ts
export async function ensureAffiliateLink(args) {
  const existing = await prisma.affiliateLink.findFirst({ where: args });
  if (existing) return existing;
  return prisma.affiliateLink.create({ data: { ...args, code: ulid() } });
}
```

### Phase 3: UI Wiring

**A. Designer Profile (src/app/designer/page.tsx)**
```tsx
// Add publish button (after line 324):
{project.status !== 'published' && (
  <button onClick={() => handlePublishProject(project.id)}>
    <FaCheck /> Publish
  </button>
)}

// Add handler:
const handlePublishProject = async (projectId: string) => {
  await publishProjectAction(projectId);
  loadProjects();  // Refresh
};
```

**B. Navigation already wired** ✅  
No changes needed—CreateProjectChooser works

---

## 11. File Locations Reference

### Core Files (Audit Map)

| Type | File Path | Key Functions/Components |
|------|-----------|--------------------------|
| **Schema** | `prisma/schema.prisma` | Project, ProductTag, Product models |
| **Server Actions** | `src/app/actions/projects.ts` | `createProjectAction` |
| **API Routes** | `src/app/api/projects/route.ts` | POST, PUT project CRUD |
| **API Routes** | `src/app/api/tag-product-to-image/route.ts` | ⚠️ In-memory tag storage |
| **Utilities** | `src/lib/urls.ts` | `generateAffiliateUrl` |
| **Nav Component** | `src/components/Navigation.tsx` | Create button (line 393-416) |
| **Create Chooser** | `src/components/CreateProjectChooser.tsx` | "Publish Now" modal |
| **Publish Flow** | `src/app/designer/create/page.tsx` | `PublishNowFlow` component |
| **Designer Page** | `src/app/designer/page.tsx` | Project grid + toggle visibility |
| **Project Detail** | `src/app/project/[id]/page.tsx` | Shows project status |
| **Tagging UI** | `src/components/AdvancedTagProducts.tsx` | Visual product tagging |
| **Project Modal** | `src/components/ProjectCreationModal.tsx` | Full project wizard |

---

## 12. Cursor Search Queries (Copy-Paste)

Use these in Cursor's search to explore further:

```
Search 1: "createProjectAction" → Find all usages
Search 2: "isPublic" → Find all publish state checks
Search 3: "generateAffiliateUrl" → Find affiliate URL generation
Search 4: "ProductTag" → Find tagging logic
Search 5: "handleToggleVisibility" → Find visibility toggle
Search 6: "intent.*publish_now" → Find publish flow
Search 7: "CreateProjectChooser" → Find nav integration
Search 8: "/api/projects" (method: "PUT") → Find update endpoint
```

---

## 13. Risk Assessment

### Data Integrity ⚠️ CRITICAL
- **ProductTag storage:** Currently in-memory! Will lose all tags on restart
- **No affiliate tracking:** No database table exists
- **Status field:** String type allows invalid values

### Authorization ✅ GOOD
- ✅ Server actions check session
- ✅ Permission helpers (`canCreateProject`)
- ✅ Owner/designer validation

### Idempotency ⚠️ MISSING
- ❌ No unique constraint on affiliate links
- ❌ Republishing same project could duplicate data

### Revalidation ⚠️ PARTIAL
- ✅ `deleteProjectAction` revalidates `/projects`
- ❌ No revalidation on publish/toggle
- ❌ No cache busting for designer profiles

---

## 14. Recommended Next Steps

### Immediate (Blocking)
1. **Fix ProductTag API** - Save to database, not memory
2. **Create AffiliateLink model** - Add to schema.prisma
3. **Add publishProjectAction** - Server action with affiliate gen

### Short-Term (Wire UI)
4. **Add Publish button** to designer/page.tsx grid
5. **Wire Publish button** to publishProjectAction
6. **Add revalidation** to publish flow

### Medium-Term (Polish)
7. **Complete PublishNowFlow** tag step UI
8. **Add publish toggle** to project detail page
9. **Show affiliate links** on project products
10. **Analytics events** for publish actions

---

## 15. Code Snippets for Wiring

### Snippet 1: publishProjectAction (NEW FILE)
**Create:** `src/app/actions/publishProject.ts`

```typescript
'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const Input = z.object({ projectId: z.string().uuid() });

export async function publishProjectAction(raw: unknown) {
  const { projectId } = Input.parse(raw);
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  
  // Fetch project with tags
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      designerId: true,
      isPublic: true,
      images: {
        include: {
          tags: { include: { product: true } }
        }
      }
    },
  });
  
  if (!project) throw new Error('Project not found');
  
  // Auth check
  if (project.ownerId !== session.user.id && 
      project.designerId !== session.user.id) {
    throw new Error('Not authorized');
  }
  
  // Update project
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      isPublic: true,
      status: 'published',
      // publishedAt: project.publishedAt ?? new Date(),  // Add after migration
    },
  });
  
  // TODO: Generate affiliate links for tagged products
  // for (const image of project.images) {
  //   for (const tag of image.tags) {
  //     await ensureAffiliateLink({
  //       designerId: project.designerId!,
  //       projectId: project.id,
  //       productId: tag.productId,
  //     });
  //   }
  // }
  
  // Revalidate
  revalidatePath('/designer');
  revalidatePath('/projects');
  revalidatePath(`/project/${projectId}`);
  
  return { ok: true };
}
```

### Snippet 2: Add Publish Button to Designer Page
**File:** `src/app/designer/page.tsx` (Insert after line 324)

```tsx
{/* Add after Edit button */}
{project.status !== 'published' && project.status === 'draft' && (
  <button
    onClick={() => handlePublishProject(project.id)}
    className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
    title="Publish Project"
  >
    <FaCheck className="w-4 h-4" />
  </button>
)}

// Add handler function (after line 174):
const handlePublishProject = async (projectId: string) => {
  try {
    await publishProjectAction(projectId);
    loadProjects();  // Refresh list
    alert('Project published successfully!');
  } catch (error) {
    console.error('Failed to publish:', error);
    alert('Failed to publish project');
  }
};
```

---

## 16. Summary & Recommendations

### ✅ What's Working
1. **Navigation create flow** - Button → Chooser → Publish Now page
2. **Project creation** - Server action with intent-based flags
3. **Product tagging UI** - Visual interface for tagging products
4. **Affiliate URL generation** - Utility function exists
5. **Visibility toggle** - Can make projects public/private

### ⚠️ What Needs Fixing
1. **ProductTag persistence** - Currently in-memory only
2. **Affiliate link tracking** - No database model exists
3. **Publish button** - Not in designer profile grid
4. **Publish server action** - No unified action with affiliate gen
5. **PublishNowFlow tagging** - Redirects, doesn't show tag UI

### 🎯 Priority Order
1. **🔴 CRITICAL:** Fix ProductTag API to use database
2. **🟠 HIGH:** Add AffiliateLink model to schema
3. **🟠 HIGH:** Create publishProjectAction with affiliate logic
4. **🟡 MEDIUM:** Add publish button to designer/page.tsx grid
5. **🟢 LOW:** Complete PublishNowFlow tag step UI

---

## 17. Cursor One-Shot Audit Prompt

**To explore further, paste this into Cursor:**

```
Find all files referencing:
1. "createProjectAction" OR "publishProject"
2. "ProductTag" AND "save" OR "create"
3. "generateAffiliateUrl" usage
4. "isPublic" in Project updates
5. "handleToggleVisibility" implementation
6. "PublishNowFlow" component logic
7. "/api/tag-product-to-image" endpoints
8. "AdvancedTagProducts" component usage

Group results by:
- Server actions (auth + DB)
- API routes (endpoints)
- UI components (buttons, modals)
- Database models (Prisma schema)

Highlight any TODO comments or in-memory storage warnings.
```

---

## 18. Next Actions (For Implementation)

**DO NOT IMPLEMENT YET** - This is audit only, but here's the roadmap:

### Step 1: Database (1 migration)
```sql
-- Add to Project
ALTER TABLE projects ADD COLUMN "publishedAt" TIMESTAMP;

-- Create AffiliateLink table
CREATE TABLE "affiliate_links" (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  designerId TEXT NOT NULL,
  projectId TEXT NOT NULL,
  productId TEXT NOT NULL,
  clicks INT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT now(),
  UNIQUE(designerId, projectId, productId)
);
```

### Step 2: Fix Tag Persistence
Replace in-memory array with:
```typescript
// In /api/tag-product-to-image/route.ts
await prisma.productTag.create({
  data: { x, y, productId, imageId, projectId }
});
```

### Step 3: Create Publish Action
New file: `src/app/actions/publishProject.ts` (see Snippet 1 above)

### Step 4: Wire Designer Page
Add publish button (see Snippet 2 above)

---

**AUDIT COMPLETE ✅**  
**Date:** October 7, 2025  
**Findings:** Documented above  
**Status:** Ready for implementation phase





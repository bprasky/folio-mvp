# Profile Projects Filter - Published Only

**Date:** October 13, 2025  
**Status:** ✅ **COMPLETE** - Profile now shows only published/completed work

---

## The Natural Flow

### Before (Confusing)
```
/designer (dashboard)
  ↓
Shows: ALL projects (drafts + published)

/designer/profile (portfolio)
  ↓
Shows: ALL projects (drafts + published)

Result: ❌ Drafts mixed with portfolio
```

### After (Natural)
```
/designer (dashboard)
  ↓
Shows: ALL projects (drafts + published)
Purpose: Manage work-in-progress

/designer/profile (portfolio)
  ↓
Shows: PUBLISHED projects ONLY
Purpose: Showcase completed work

Result: ✅ Clean portfolio separation
```

---

## What Changed

### 1. ✅ Added Filter Parameter to Query

**File:** `src/server/queries/getMyProjects.ts`

**Before:**
```typescript
export async function getMyProjects() {
  // No filtering - returned everything
}
```

**After:**
```typescript
export type ProjectFilter = 'all' | 'published' | 'draft';

export async function getMyProjects(filter: ProjectFilter = 'all') {
  // Build where clause with ownership filters
  const whereClause: any = { OR: ownershipFilters };

  // Apply status filter
  if (filter === 'published') {
    whereClause.AND = [{
      OR: [
        { isPublic: true },
        { publishedAt: { not: null } },
        { status: 'published' }
      ]
    }];
  } else if (filter === 'draft') {
    whereClause.AND = [{
      isPublic: false,
      publishedAt: null
    }];
  }

  return prisma.project.findMany({ where: whereClause });
}
```

**Flexibility:**
- `getMyProjects('all')` - All projects (dashboard)
- `getMyProjects('published')` - Only published (profile portfolio)
- `getMyProjects('draft')` - Only drafts (future use)

---

### 2. ✅ Profile Shows Published Only

**File:** `src/app/api/designer/profile/route.ts`

**Before:**
```typescript
const projects = await getMyProjects();
```

**After:**
```typescript
// Profile view: only show published/completed projects (portfolio showcase)
const projects = await getMyProjects('published');
```

**Result:**
- Profile Projects tab = Portfolio showcase
- Only completed, published work visible
- Drafts hidden (they're work-in-progress, not portfolio pieces)

---

### 3. ✅ Dashboard Still Shows Everything

**File:** `src/app/designer/page.tsx`

**Current implementation:**
```typescript
const loadProjects = async (designerId?: string) => {
  const url = designerId 
    ? `/api/projects?designerId=${designerId}&includeDrafts=true` 
    : '/api/projects?includeDrafts=true';
  const response = await fetch(url);
  // Shows ALL projects (drafts + published)
}
```

**Status:** ✅ No changes needed - already correct
- Dashboard shows everything for project management
- "Continue Setup" button visible on drafts

---

### 4. ✅ Enhanced Debug Endpoint

**File:** `src/app/api/debug/my-projects/route.ts`

**New features:**
```typescript
// Can test different filters
GET /api/debug/my-projects?filter=all
GET /api/debug/my-projects?filter=published
GET /api/debug/my-projects?filter=draft

// Returns breakdown
{
  "filter": "published",
  "count": 2,
  "breakdown": {
    "published": 2,
    "draft": 0
  },
  "projects": [...]
}
```

---

## User Experience

### Designer Dashboard (`/designer`)
**Purpose:** Project management workspace

**Shows:**
- ✅ All your projects (drafts + published)
- ✅ "Continue Setup" button on drafts
- ✅ "Manage Project" button on all
- ✅ Status badges (Draft/Published)

**Use Case:**
- Manage work-in-progress
- Complete unfinished projects
- Edit existing projects
- View project stats

---

### Designer Profile (`/designer/profile`)
**Purpose:** Public portfolio showcase

**Shows:**
- ✅ Only published/completed projects
- ✅ Clean, professional portfolio grid
- ✅ No drafts or work-in-progress
- ✅ Your best work only

**Use Case:**
- Share with potential clients
- Showcase completed work
- Build professional reputation
- Social media sharing

---

## The Filter Logic

### Published Projects Include:
```typescript
OR: [
  { isPublic: true },              // ← Public visibility
  { publishedAt: { not: null } },  // ← Has publish date
  { status: 'published' }          // ← Explicitly published
]
```

**Any one of these = Published**

### Draft Projects:
```typescript
AND: [
  { isPublic: false },        // ← Not public
  { publishedAt: null }       // ← No publish date
]
```

**Both conditions = Draft**

---

## Example Scenarios

### Scenario 1: Designer Creates & Publishes
```
1. Create project "Modern Loft"
   → status: 'draft', isPublic: false, publishedAt: null

2. Dashboard (/designer)
   ✅ Shows "Modern Loft" with "Draft" badge
   ✅ Shows "Continue Setup" button

3. Profile (/designer/profile)
   ❌ Does NOT show "Modern Loft" (it's a draft)

4. Complete setup → Publish project
   → status: 'published', isPublic: true, publishedAt: Date

5. Dashboard (/designer)
   ✅ Shows "Modern Loft" with "Published" badge
   ✅ Shows "Manage Project" button

6. Profile (/designer/profile)
   ✅ NOW shows "Modern Loft" in portfolio!
```

### Scenario 2: Designer Has Mixed Projects
```
Portfolio State:
- 3 published projects
- 2 draft projects
- Total: 5 projects

/designer (dashboard):
✅ Shows all 5 projects
   - 3 with "Published" badge
   - 2 with "Draft" badge + "Continue Setup"

/designer/profile (portfolio):
✅ Shows only 3 published projects
   - Clean portfolio view
   - No drafts visible
```

---

## Benefits

### For Designers
✅ **Clean portfolio** - Only show finished work to potential clients  
✅ **Work in private** - Drafts don't leak to portfolio  
✅ **Professional appearance** - No half-done projects visible  
✅ **Clear separation** - Dashboard = work, Profile = showcase  

### For Viewers (Future Public Profiles)
✅ **Quality content** - Only see completed projects  
✅ **No confusion** - No "why is this empty?" draft cards  
✅ **Better UX** - Polished portfolio only  

### For Platform
✅ **Natural mental model** - Matches user expectations  
✅ **Reduces support** - "Where did my draft go?" → It's in dashboard  
✅ **Encourages completion** - Must publish to appear in portfolio  

---

## Testing Checklist

### ✅ Dashboard Still Works
- [x] Navigate to `/designer`
- [x] See ALL your projects (drafts + published)
- [x] Draft badges visible
- [x] "Continue Setup" on drafts
- [x] Can manage all projects

### ✅ Profile Shows Published Only
- [x] Navigate to `/designer/profile`
- [x] Click "Projects" tab
- [x] Only published projects visible
- [x] No draft projects shown
- [x] No "Draft" badges (all are published)
- [x] Empty state if no published projects

### ✅ Create & Publish Flow
- [x] Create new project (draft)
- [x] Dashboard shows it with "Draft" badge
- [x] Profile does NOT show it yet
- [x] Complete setup & publish
- [x] Dashboard still shows it (now "Published")
- [x] Profile NOW shows it in portfolio

### ✅ Debug Endpoint
- [x] Visit `/api/debug/my-projects?filter=all`
- [x] Shows all projects
- [x] Visit `/api/debug/my-projects?filter=published`
- [x] Shows only published
- [x] Visit `/api/debug/my-projects?filter=draft`
- [x] Shows only drafts

---

## Debug Commands

### Test All Filters
```bash
# All projects
curl http://localhost:3000/api/debug/my-projects?filter=all

# Published only (what profile shows)
curl http://localhost:3000/api/debug/my-projects?filter=published

# Drafts only
curl http://localhost:3000/api/debug/my-projects?filter=draft
```

### Expected Response
```json
{
  "userId": "abc-123",
  "email": "designer@example.com",
  "filter": "published",
  "count": 3,
  "breakdown": {
    "published": 3,
    "draft": 0
  },
  "projects": [
    {
      "id": "p1",
      "title": "Modern Loft",
      "status": "published",
      "isPublic": true,
      "publishedAt": "2024-10-12T...",
      "designerId": "abc-123",
      "ownerId": "abc-123"
    }
  ]
}
```

---

## Implementation Details

### Query Structure
```typescript
WHERE (
  -- Ownership (at least one must match)
  (designerId = userId OR ownerId = userId OR designerOrgId IN orgIds OR participants.some)
  
  AND
  
  -- Status filter (if specified)
  (isPublic = true OR publishedAt IS NOT NULL OR status = 'published')
)
```

### Order
```typescript
ORDER BY updatedAt DESC
```

**Result:** Most recently updated published projects first

---

## Files Modified

1. ✅ `src/server/queries/getMyProjects.ts`
   - Added `ProjectFilter` type
   - Added `filter` parameter
   - Added filter logic to where clause
   - Enhanced debug logging with breakdown

2. ✅ `src/app/api/designer/profile/route.ts`
   - Changed to `getMyProjects('published')`
   - Comment explains portfolio showcase purpose

3. ✅ `src/app/api/debug/my-projects/route.ts`
   - Added `?filter=` query param support
   - Returns breakdown of published vs draft
   - Shows filter in response

---

## No Breaking Changes

✅ **Backward compatible:**
- `getMyProjects()` defaults to `'all'` (existing behavior)
- Dashboard unchanged (still shows all)
- Only profile view filtered

✅ **No schema changes:**
- Uses existing `isPublic`, `publishedAt`, `status` fields
- No migrations needed

✅ **No data loss:**
- Drafts still accessible via dashboard
- Just hidden from portfolio view

---

## Rollback Plan

If you want to revert to showing all projects in profile:

```typescript
// src/app/api/designer/profile/route.ts
const projects = await getMyProjects('all'); // or just getMyProjects()
```

**That's it!** Single line change to toggle behavior.

---

## Summary

### What We Achieved
✅ **Natural separation** - Dashboard = workspace, Profile = portfolio  
✅ **Published-only portfolio** - Clean showcase of completed work  
✅ **Flexible query** - Can filter by all/published/draft  
✅ **Enhanced debugging** - Breakdown of project types  
✅ **No breaking changes** - Backward compatible  

### User Impact
- **Before:** Profile mixed drafts with finished work (confusing)
- **After:** Profile only shows polished, published projects (professional)

### Mental Model
```
Dashboard (/designer)
  = "My workspace"
  = Shows everything I'm working on
  = Drafts + Published

Profile (/designer/profile)
  = "My portfolio"
  = Shows my best completed work
  = Published only
```

---

**Implementation Status:** ✅ **COMPLETE**  
**Filter Applied:** Profile = Published only  
**Dashboard:** Unchanged (shows all)  
**Debug Tools:** Enhanced with filter params  

🎉 Portfolio now has a professional, published-only Projects tab!





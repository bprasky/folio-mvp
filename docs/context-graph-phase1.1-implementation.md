# Context Graph + Sourcing Memory - Phase 1.1 Polish

**Date:** 2025-01-27  
**Status:** ✅ Complete

## Summary

Phase 1.1 polish improvements: vendor resolution confidence, enriched recall results, tag highlighting, and recent memory UI.

## Files Touched

1. **`src/lib/vendor/resolveVendor.ts`** (MODIFIED)
   - Added confidence levels: "high" | "medium" | "low"
   - Only creates shadow vendors when confidence is high/medium
   - Improved brand validation with denylist
   - Returns `{ vendor, vendorName, confidence }` structure

2. **`src/app/api/tag-product-to-image/route.ts`** (MODIFIED)
   - Updated to handle new vendor resolution result structure
   - GraphEdge only written if vendor exists (high/medium confidence)
   - ContextSignal always written, even if vendor is null (omits vendorId)

3. **`src/app/api/designer/recall/route.ts`** (MODIFIED)
   - Enriched with tagId, imageId, x, y for tag results
   - Normalized vendorName from vendorRecord or vendor User
   - Improved deepLinks: `/designer/projects/${projectId}?image=${imageId}&tag=${tagId}`

4. **`src/app/api/designer/recall/recent/route.ts`** (NEW)
   - Returns last 5 ProductTags for designer
   - Same response shape as recall endpoint

5. **`src/app/project/[id]/page.tsx`** (MODIFIED)
   - Reads `image` and `tag` query params
   - Passes highlight params to MediaSection

6. **`src/app/project/[id]/MediaSection.tsx`** (MODIFIED)
   - Added `highlightImageId` and `highlightTagId` props
   - Tag highlighting with pulse ring animation (2 seconds)
   - Auto-scrolls to highlighted image
   - Shows tags overlay when highlighted

7. **`src/app/designer/page.tsx`** (MODIFIED)
   - Added "Recent" memory list below search
   - Loads recent 5 items on mount
   - Minimal, editorial UI

## Key Improvements

### A) Vendor Resolution Confidence

**Before:** Created shadow vendors for any brand name  
**After:** Only creates vendors when confidence is high/medium

- **High confidence:** vendorRecord.name or vendor (User) name/companyName
- **Medium confidence:** product.brand (if passes validation)
- **Low confidence:** Returns null vendor, no shadow vendor created

**Brand validation:**
- Must have no vendorId and no vendorRecordId
- Not in denylist: ["unknown","n/a","generic","misc","brand","vendor"]
- Length >= 3 and <= 80

### B) Tag Route Tolerates Missing Vendor

- GraphEdge only written if vendor exists (high/medium confidence)
- ContextSignal always written, omits vendorId if vendor is null
- Prevents graph rot from low-confidence vendor names

### C) Enriched Recall Results

**Added fields:**
- `tagId`, `imageId`, `x`, `y` for tag results
- Normalized `vendorName` from vendorRecord or vendor User
- Better deepLinks with image/tag query params

**DeepLink format:**
- Tags: `/designer/projects/${projectId}?image=${imageId}&tag=${tagId}`
- Selections: `/designer/projects/${projectId}?room=${roomId}` (if room exists)

### D) Tag Highlighting on Project Page

**Behavior:**
1. Reads `image` and `tag` query params from URL
2. Scrolls to image (smooth scroll, centers viewport)
3. Highlights tag with pulse ring animation (2 seconds)
4. Shows product name tooltip on highlighted tag
5. Image border gets purple ring when highlighted

**Implementation:**
- Client-side effect in MediaSection
- CSS animations for pulse ring
- Non-intrusive (doesn't change existing layouts)

### E) Recent Memory UI

**Location:** Designer dashboard, below search input

**Features:**
- Shows last 5 tagged products
- Product image, name, project, room
- Click navigates to project with tag highlight
- Minimal, editorial styling
- Only shows for designers (not admins without selected designer)

## Testing Checklist

- [ ] Tag product with high-confidence vendor → vendor created
- [ ] Tag product with low-confidence brand → no vendor created
- [ ] Tag product with no vendor → ContextSignal written without vendorId
- [ ] Search "blue rug" → results include tagId, imageId, deepLink
- [ ] Click recall result → navigates to project, highlights tag
- [ ] Recent memory loads on dashboard
- [ ] Click recent item → navigates with tag highlight
- [ ] Tag pulse animation works (2 seconds)
- [ ] Image scrolls to center when highlighted

## What Ships at Launch

✅ **Search → jump to exact tag** (the "magic")
- Recall search with enriched deepLinks
- Tag highlighting with pulse animation
- Auto-scroll to image

✅ **Recent memory list** (daily utility)
- Last 5 tagged products
- Quick access to recent work
- One-click navigation

✅ **Vendor resolution confidence** (prevents graph rot)
- Only creates vendors when confident
- Low-confidence brands don't pollute graph
- Clean, canonical vendor identity

## Next Steps (Future Phases)

- Directory page with full vendor/product grid
- Vendor-facing visibility (show designer relationships)
- Vendor claim/invite flow for shadow vendors
- Enhanced recall filters (vendor, room, date range)
- AI-powered recall queries (embeddings)









# Context Graph + Sourcing Memory - Phase 1 Implementation

**Date:** 2025-01-27  
**Status:** ✅ Complete

## Summary

Phase 1 implementation of Context Graph + Sourcing Memory feature. This adds vendor resolution, relationship logging, and designer recall queries without breaking existing functionality.

## Files Touched

1. **`src/lib/vendor/resolveVendor.ts`** (NEW)
   - Vendor resolution helper function
   - Creates shadow vendors when needed
   - Handles vendor name resolution from multiple sources

2. **`src/app/api/tag-product-to-image/route.ts`** (MODIFIED)
   - Added vendor resolution after tag creation
   - Added GraphEdge write (designer ↔ vendor relationship)
   - Added ContextSignal write (sourcing memory)
   - All additions are non-breaking and wrapped in try-catch

3. **`src/app/api/designer/recall/route.ts`** (NEW)
   - Recall endpoint for designer search queries
   - Searches ProductTags and Selections
   - Returns normalized results with project/room context

4. **`src/app/designer/page.tsx`** (MODIFIED)
   - Added "Ask your history" search input
   - Debounced search with results dropdown
   - Trust copy: "Folio remembers what you've specified across your tagged projects."

## What Gets Written on Tag Now

When a product is tagged (`POST /api/tag-product-to-image`), the following data is written:

1. **ProductTag** (existing)
   - `x`, `y`, `productId`, `imageId`

2. **Vendor Resolution** (new)
   - Resolves or creates `Vendor` record
   - Updates `Product.vendorRecordId` if missing

3. **GraphEdge** (new)
   - `srcType: "designer"`, `srcId: designerId`
   - `dstType: "vendor"`, `dstId: vendor.id`
   - `kind: "specified"`, `weight: 1.0`
   - `decayAt: 1 year from now`
   - Deduplicates: checks for existing edge in last 24h, increments weight if found

4. **ContextSignal** (new - Sourcing Memory)
   - `userId: designerId`
   - `vendorId: vendor.id`
   - `productId: product.id`
   - `projectId: project.id`
   - `action: "tagged"`
   - `tags: [category, room]` (if available)
   - `meta: { imageId, x, y, productName, vendorName }`

5. **AtelierSignal** (existing)
   - Vendor, category, and room signals (unchanged)

6. **PendingRepInvite** (existing, conditional)
   - Only if `repEmail` provided (unchanged)

7. **Follow** (existing, conditional)
   - Only if rep exists (unchanged)

## Example API Response for Recall Query "blue rug"

**Request:**
```
GET /api/designer/recall?q=blue%20rug
```

**Response:**
```json
{
  "results": [
    {
      "type": "tag",
      "project": {
        "id": "project-uuid-123",
        "title": "Modern Living Room"
      },
      "room": "Living Room",
      "product": {
        "id": "product-uuid-456",
        "name": "Navy Blue Wool Rug",
        "brand": "West Elm",
        "imageUrl": "https://example.com/rug.jpg"
      },
      "vendorName": null,
      "at": "2025-01-15T10:30:00.000Z",
      "deepLink": "/designer/projects/project-uuid-123"
    },
    {
      "type": "selection",
      "project": {
        "id": "project-uuid-789",
        "title": "Cozy Family Room"
      },
      "room": "Family Room",
      "product": {
        "name": "Blue Area Rug",
        "imageUrl": "https://example.com/rug2.jpg"
      },
      "vendorName": "Material Bank",
      "at": "2025-01-10T14:20:00.000Z",
      "deepLink": "/designer/projects/project-uuid-789"
    }
  ]
}
```

## Key Implementation Decisions

1. **Canonical Vendor Identity:** Uses `Vendor` model (not `User` with role='VENDOR') for graph edges
2. **Shadow Vendors:** Creates unclaimed `Vendor` records with `userId: null` for future claiming
3. **Deduplication:** GraphEdge checks for existing edge in last 24h to avoid spam
4. **Non-Breaking:** All new code wrapped in try-catch, doesn't fail tag creation if graph/memory writes fail
5. **Rep Invite Flow:** Completely unchanged - still uses Organization-based vendor lookup

## Testing Checklist

- [ ] Tag a product → verify Vendor record created/updated
- [ ] Tag a product → verify GraphEdge created
- [ ] Tag a product → verify ContextSignal created
- [ ] Search "blue rug" → verify results appear
- [ ] Click recall result → verify navigation to project
- [ ] Tag same product twice → verify GraphEdge weight increments
- [ ] Tag product with existing vendor → verify no duplicate Vendor created
- [ ] Rep invite flow still works (unchanged)

## Next Steps (Future Phases)

- Vendor claim/invite flow for shadow vendors
- Vendor dashboard showing designer relationships
- Enhanced recall with filters (vendor, room, date range)
- AI-powered recall queries (embeddings)









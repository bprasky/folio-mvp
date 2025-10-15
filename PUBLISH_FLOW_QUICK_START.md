# Publish Flow - Quick Start Guide

## ✅ Implementation Complete

All work is done and **100% safe** - no data was wiped or lost.

---

## What Was Changed

### Database (Safe Addition Only)
✅ Added **one optional column** to `projects` table:
```sql
ALTER TABLE "projects" ADD COLUMN "publishedAt" TIMESTAMP(3);
```
- ✅ No data deleted
- ✅ All existing records preserved
- ✅ Nullable field (defaults to null)

### Code Changes (6 files)

| File | Change | Type |
|------|--------|------|
| `prisma/schema.prisma` | Added `publishedAt DateTime?` | Schema |
| `src/app/actions/projects.ts` | Added `publishProjectAction` + enhanced create | Server |
| `src/app/api/tag-product-to-image/route.ts` | Database persistence (was in-memory) | API |
| `src/app/designer/PublishButton.tsx` | NEW component | UI |
| `src/app/designer/page.tsx` | Wired PublishButton to grid | UI |
| `src/components/AdvancedTagProducts.tsx` | Support imageId for DB tags | Component |

---

## How It Works Now

### 1. Navigation → "Publish Now" ✅
**Path:** Nav Create button → Modal → "Publish Now"

**What happens:**
1. Designer clicks "+ Create" in navigation
2. Modal shows "Project Folder" vs "Publish Now"
3. Choose "Publish Now" → Goes to `/designer/create?intent=publish_now`
4. Enter project name/description
5. Project created with:
   - `isPublic: true` ✅
   - `status: 'published'` ✅
   - `publishedAt: now()` ✅
6. Redirects to project page for image upload & tagging

---

### 2. Designer Profile → Projects ✅
**Path:** Designer dashboard projects grid

**What happens:**
1. View projects in `/designer` page
2. Draft projects show **green checkmark button** (Publish)
3. Click button → `publishProjectAction` runs:
   - Sets `isPublic: true`
   - Sets `status: 'published'`
   - Sets `publishedAt` (if not already set)
   - Revalidates cache
4. Button disappears after publish
5. Project list refreshes automatically

---

### 3. Product Tagging (Fixed) ✅
**Component:** `AdvancedTagProducts`

**What happens:**
1. Click on project image to place tag
2. Search and select product
3. Tag saved to **database** (not memory anymore)
4. Tags persist across server restarts ✅
5. Pass `imageId` prop for full DB support

**Usage:**
```tsx
<AdvancedTagProducts
  imageUrl={image.url}
  imageId={image.id}      // ← Now supported for DB persistence
  projectId={project.id}
  existingTags={tags}
  onTagsUpdate={handleUpdate}
/>
```

---

## Testing Your Implementation

### Test 1: Create via "Publish Now"
```bash
1. Sign in as designer
2. Click "+ Create" in navigation
3. Click "Publish Now"
4. Enter project name: "Test Project"
5. Click "Continue to Upload & Tag"
6. Verify project created with isPublic: true
7. Check database: publishedAt should be set
```

### Test 2: Publish from Designer Profile
```bash
1. Go to /designer page
2. Create draft project (or use existing)
3. Find draft project card
4. Click green checkmark (Publish button)
5. Watch loading spinner
6. Button should disappear after publish
7. Verify project now shows as "Published"
```

### Test 3: Tag Products
```bash
1. Open any project with images
2. Click on an image
3. Place a tag (click on image)
4. Select a product from search
5. Save tag
6. Restart dev server
7. Verify tags still exist ✅ (database-backed)
```

---

## Verification Commands

### Check Database Schema
```bash
npx prisma db pull
# Verify publishedAt field exists in Project
```

### Check Migrations
```bash
ls prisma/migrations
# Should see: 20251007_add_published_at/
```

### Generate Prisma Client
```bash
npx prisma generate
# If locked, just restart dev server - it auto-generates
```

---

## API Endpoints Reference

### Publish Project
```typescript
// Server Action (use in client components with useTransition)
import { publishProjectAction } from '@/app/actions/projects';

await publishProjectAction({ projectId: 'uuid' });
```

### Tag Product
```typescript
// POST /api/tag-product-to-image
POST /api/tag-product-to-image
Body: {
  x: 50.5,              // % from left
  y: 25.3,              // % from top
  productId: 'uuid',
  imageId: 'uuid',      // Required for DB persistence
  projectId: 'uuid'     // For ownership verification
}
```

### Get Tags
```typescript
// GET /api/tag-product-to-image?imageId={id}
const tags = await fetch(`/api/tag-product-to-image?imageId=${imageId}`)
  .then(r => r.json());
```

---

## What's Next (Future)

### Optional: Add AffiliateLink Model
When you're ready to track affiliate attribution:

1. **Add to schema.prisma:**
```prisma
model AffiliateLink {
  id         String   @id @default(cuid())
  code       String   @unique
  designerId String
  projectId  String
  productId  String
  clicks     Int      @default(0)
  createdAt  DateTime @default(now())
  
  designer   User     @relation(fields: [designerId], references: [id])
  project    Project  @relation(fields: [projectId], references: [id])
  product    Product  @relation(fields: [productId], references: [id])
  
  @@unique([designerId, projectId, productId])
}
```

2. **Run migration:**
```bash
npx prisma migrate dev --name add_affiliate_links
```

3. **Uncomment lines 122-147** in `src/app/actions/projects.ts`

4. **Install ulid:**
```bash
npm install ulid
```

---

## Troubleshooting

### Issue: Publish button doesn't appear
**Check:** Is project's `status === 'draft'` or `isPublic === false`?  
**Fix:** Verify project data structure in database

### Issue: Tags still disappear on restart
**Check:** Did migration apply correctly?  
**Fix:** Verify ProductTag table exists and has records

### Issue: "Not authorized" error
**Check:** Is user signed in as designer?  
**Check:** Does project belong to this user?  
**Fix:** Verify `project.ownerId` or `project.designerId` matches session user

### Issue: Prisma client out of sync
**Fix:** 
```bash
npx prisma generate
# Then restart dev server
```

---

## Summary

✅ **Publish flow complete** - Both entry points wired  
✅ **Database safe** - Only additive changes, no data loss  
✅ **Tag persistence** - Fixed critical bug (was in-memory)  
✅ **Authorization** - Full ownership checks  
✅ **Idempotent** - Safe to retry operations  
✅ **Cache management** - Auto-refresh after publish  
✅ **Future-ready** - Prepared for affiliate tracking  

**Your project publishing system is now production-ready!** 🎉

---

**Questions or Issues?** 
Check `PUBLISH_FLOW_IMPLEMENTATION_SUMMARY.md` for detailed technical docs.




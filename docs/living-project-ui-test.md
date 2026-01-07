# Living Project Skeleton Overlay UI - Testing Guide

## Prerequisites

1. **Feature Flags**: Enable the following in your `.env` file:
   ```bash
   NEXT_PUBLIC_FOLIO_LIVING_PROJECTS=true
   NEXT_PUBLIC_FOLIO_SKELETON_TAGS=true
   NEXT_PUBLIC_FOLIO_ROOM_GRAVITY=true
   NEXT_PUBLIC_FOLIO_DYNAMIC_FEED_ENTRY=true
   ```

2. **Database**: Ensure migrations have been run and Prisma client is regenerated:
   ```bash
   npx prisma generate
   ```

3. **Project Setup**: You need a project with:
   - `intent` = `PAST`
   - `livingEnabled` = `true` (default)
   - `livingOptOut` = `false` (default)

## Test Steps

### 1. Create a PAST Project

1. Navigate to project creation flow
2. Select "Past Project" when prompted
3. Fill in project details and create

**Expected**: Project is created with `intent = PAST`

### 2. Upload Images to Project

1. Navigate to the project's "Media" tab
2. Upload at least 3-4 images
3. Assign images to different rooms (if room selection is available)

**Expected**: 
- Images are uploaded successfully
- For PAST projects, skeleton items are automatically generated (check database or wait a few seconds)
- Room rows are auto-created based on `ProjectImage.room` values

**Verify in Database**:
```sql
-- Check skeleton items were created
SELECT COUNT(*) FROM skeleton_items WHERE projectId = '<project-id>';

-- Check rooms were created
SELECT * FROM rooms WHERE projectId = '<project-id>';
```

### 3. Open Room Boards View

1. Navigate to the project's "Boards" tab (or "Overview" default view)
2. Ensure you are logged in as the project owner

**Expected**:
- Room boards are visible
- Project images for each room are displayed in a grid below the selections
- Skeleton overlay boxes appear as subtle outlines on images (only for PAST projects with living enabled)

### 4. Test Skeleton Overlay Interaction

1. Click on a skeleton box overlay on an image
2. A side panel should open on the right

**Expected**:
- Side panel opens with title "We noticed something here"
- Three options are visible:
  - "Confirm as Product"
  - "Confirm as Label"
  - "Dismiss (don't ask again)"

### 5. Test Confirm as Product

1. Click "Confirm as Product"
2. Search for a product in the search box
3. Select a product from results
4. Click "Confirm"

**Expected**:
- Product search results appear as you type
- Selecting a product highlights it
- After confirmation:
  - Toast message: "Confirmed as product"
  - Side panel closes
  - Skeleton box disappears from image
  - A `ProjectProductTag` is created in the database
  - Skeleton status changes to `CONFIRMED`

**Verify in Database**:
```sql
-- Check ProjectProductTag was created
SELECT * FROM project_product_tags WHERE projectId = '<project-id>' ORDER BY createdAt DESC LIMIT 1;

-- Check skeleton status
SELECT status, confirmedProductId FROM skeleton_items WHERE id = '<skeleton-id>';
```

### 6. Test Confirm as Label

1. Click on another skeleton box
2. Click "Confirm as Label"
3. Enter a label (e.g., "Coffee Table")
4. Click "Confirm"

**Expected**:
- Text input appears
- After confirmation:
  - Toast message: "Confirmed as label"
  - Side panel closes
  - Skeleton box disappears
  - `ProjectProductTag` is created with `label` field set
  - Skeleton status changes to `CONFIRMED` with `confirmedLabel` set

### 7. Test Dismiss

1. Click on another skeleton box
2. Click "Dismiss (don't ask again)"

**Expected**:
- Toast message: "Dismissed"
- Side panel closes
- Skeleton box disappears
- Skeleton status changes to `DISMISSED`
- Skeleton will not appear again

### 8. Test Skeleton Inbox

1. Scroll down to the "Unfinished details" panel
2. Check if unconfirmed skeletons are listed

**Expected**:
- Panel shows "Unfinished details" title
- Lists skeletons for the current room
- Each item shows:
  - Thumbnail of the image
  - "Unconfirmed detail" text
  - Confidence percentage

### 9. Test Inbox Click → Focus

1. Click on an item in the skeleton inbox
2. The skeleton should be highlighted and the side panel should open

**Expected**:
- Side panel opens
- Corresponding skeleton box on the image is highlighted (stronger border/glow)
- You can then confirm/dismiss as in previous steps

### 10. Test Move to Room (Optional)

1. Open a skeleton side panel
2. Scroll to "Move to room" dropdown
3. Select a different room
4. Click "Move"

**Expected**:
- Toast message: "Moved to room"
- `SkeletonItem.roomName` is updated
- **Note**: `ProjectImage.room` is NOT changed (skeleton-only assignment)

### 11. Test Feature Flag Guards

1. Disable `NEXT_PUBLIC_FOLIO_SKELETON_TAGS` in `.env`:
   ```bash
   NEXT_PUBLIC_FOLIO_SKELETON_TAGS=false
   ```
2. Restart dev server
3. Refresh the project boards page

**Expected**:
- No skeleton overlays appear
- No skeleton inbox panel
- Images display normally without skeleton boxes

### 12. Test Owner-Only Access

1. Log out or use a different account that is NOT the project owner
2. Navigate to the project boards page

**Expected**:
- No skeleton overlays (even if feature flags are enabled)
- Images display normally
- Public view shows no skeleton UI

### 13. Test Project-Level Opt-Out

1. Update project in database:
   ```sql
   UPDATE projects SET "livingOptOut" = true WHERE id = '<project-id>';
   ```
2. Refresh the boards page

**Expected**:
- No skeleton overlays appear
- No skeleton inbox panel
- Images display normally

### 14. Test Non-PAST Projects

1. Create an ACTIVE or FUTURE project
2. Upload images
3. Navigate to boards

**Expected**:
- No skeleton items are generated
- No skeleton overlays appear
- Images display normally

### 15. Test Dynamic Hero Update (Optional)

1. Confirm several skeletons as products/labels
2. Ensure project has a published `ProjectPost`
3. Call admin endpoint:
   ```bash
   curl -X POST "http://localhost:3000/api/admin/living/apply-dynamic-hero?projectId=<project-id>" \
     -H "Cookie: next-auth.session-token=<your-session-token>"
   ```

**Expected**:
- `ProjectPost.heroAssetId` may update to reflect the room with highest gravity
- `expandedBlocks.living` is updated with `featureRoomName` and `updatedAt`
- Only updates if 7+ days have passed since last update (guardrail)

## Troubleshooting

### Skeletons Not Appearing

1. **Check feature flags**: Ensure both `NEXT_PUBLIC_FOLIO_LIVING_PROJECTS` and `NEXT_PUBLIC_FOLIO_SKELETON_TAGS` are `true`
2. **Check project intent**: Must be `PAST`
3. **Check project flags**: `livingEnabled` must be `true`, `livingOptOut` must be `false`
4. **Check ownership**: Must be logged in as project owner/admin
5. **Check database**: Verify skeleton items exist:
   ```sql
   SELECT * FROM skeleton_items WHERE "projectImageId" = '<image-id>' AND status = 'UNCONFIRMED';
   ```
6. **Check browser console**: Look for API errors or warnings

### Skeleton Generation Not Running

1. Check image upload route logs for skeleton generation triggers
2. Verify skeleton generation is non-blocking (doesn't fail upload)
3. Check server logs for errors

### Side Panel Not Opening

1. Check browser console for errors
2. Verify API route `/api/living/skeleton` is accessible
3. Check network tab for failed requests

### Product Search Not Working

1. Verify `/api/products/search` endpoint is accessible
2. Check if products exist in database
3. Check browser console for API errors

## Success Criteria

✅ Skeleton overlays appear only for PAST projects with living enabled  
✅ Overlays are subtle and assistive (not "AI flashy")  
✅ Owner-only access is enforced  
✅ Feature flags properly gate functionality  
✅ Confirm/Dismiss workflows create/update database records correctly  
✅ Skeleton inbox lists unconfirmed items per room  
✅ Public views never show skeleton UI  
✅ Non-blocking: skeleton generation failures don't break image uploads  









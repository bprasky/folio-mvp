# How to Upload Images & Tag Products - Quick Guide

## ✅ Two Ways to Open the Modal

### Method 1: From Project Page (RECOMMENDED)
**Best for:** Adding images anytime, editing existing projects

```
1. Go to your project page: /project/{id}
2. Look at right sidebar: "Project Actions"
3. ✅ Click "Add Images & Tag Products" button (blue)
4. Modal opens immediately
5. Upload images → Tag products → Save
```

**Advantage:** Works every time, no routing issues

---

### Method 2: Auto-Redirect After Creation
**Best for:** New projects just created

```
1. Create project (any method)
2. ✅ Auto-redirected to /project/{id}/setup
3. Modal opens automatically
4. Upload images → Tag products → Save
```

**If modal doesn't open:** Use Method 1 instead

---

## Step-by-Step: Upload & Tag Flow

### Step 1: Open the Modal

**Option A:** Click "Add Images & Tag Products" on project page  
**Option B:** Go to `/project/{your-project-id}/setup`

### Step 2: Add Images

1. Modal opens on "Images" tab
2. Click "Add Image" or paste image URL
3. Enter image URL (e.g., from Unsplash, your CDN, etc.)
4. Optional: Assign room name
5. Image appears in preview
6. Repeat for all images
7. Click "Next" when done

### Step 3: Tag Products

1. Modal switches to "Tagging" tab
2. **Click on any image** where product appears
3. Tag marker (dot) appears at click point
4. Product search modal opens
5. Search for product:
   - Type name, brand, or category
   - OR paste product URL to auto-scrape
6. Select product from results
7. **Affiliate URL auto-generates** ✅
8. Tag saved to database
9. Repeat for all products

### Step 4: Complete

1. Click "Update Project" or "Create Project"
2. Modal closes
3. Project page refreshes
4. ✅ Images and tags now visible

---

## What Happens Behind the Scenes

### Image Upload
```
1. URL validated
2. ProjectImage record created in database
   {
     id: uuid
     url: "https://..."
     name: "Image name"
     room: "Living Room"
     projectId: project.id
   }
3. Image persisted (survives refresh)
```

### Product Tagging
```
1. Click coordinates captured (x%, y%)
2. Product selected
3. ProductTag record created in database
   {
     id: uuid
     x: 50.5
     y: 25.3
     productId: product.id
     imageId: image.id
   }
4. Affiliate URL generated:
   product.url + ?utm_source=folio&utm_medium=designer&utm_campaign=project-title&aff=designerId
5. Tag persisted (survives refresh)
```

---

## Modal Features

### Built-In Functionality

✅ **Multi-step wizard** (Details → Images → Tagging)  
✅ **Image URL validation** (shows errors for broken links)  
✅ **Product search** (fuzzy matching)  
✅ **Product scraping** (paste any product URL)  
✅ **Visual tag placement** (click on image)  
✅ **Tag hover preview** (see product info)  
✅ **Affiliate URL generation** (automatic)  
✅ **Draft saving** (auto-save as you work)  
✅ **Error handling** (graceful failures)  
✅ **Responsive design** (works on mobile)

### Tab Navigation

- **Details:** Edit project name, description, etc.
- **Images:** Add/remove images, assign rooms
- **Tagging:** Only appears if images exist
- **Progress:** Shows step number (1/3, 2/3, 3/3)

---

## Where to Find the Buttons

### On Project Page (`/project/{id}`)

**Sidebar → "Project Actions" Section:**
```
┌─────────────────────────────┐
│  Project Actions            │
├─────────────────────────────┤
│  📸 Add Images & Tag        │  ← Click this!
│     Products                │
├─────────────────────────────┤
│  📄 Export Spec (HTML)      │
├─────────────────────────────┤
│  🔗 Share Project           │
└─────────────────────────────┘
```

**Button:** Blue, always visible for project owners

---

### On Designer Profile (`/designer`)

**Project Card (for drafts without images):**
```
┌─────────────────────────┐
│  Project Title          │
│                         │
│  📤 Continue Setup      │  ← Click this!
│                         │
│  [Draft] [Private]      │
└─────────────────────────┘
```

**Button:** Blue pill, shows only for incomplete drafts

---

## Troubleshooting

### Issue: Button not visible on project page

**Check:**
- Are you signed in?
- Are you the project owner?
- Look in right sidebar under "Project Actions"

**Fix:**
- Button only shows for owners
- If you're the owner but don't see it, refresh the page

---

### Issue: Modal doesn't open from setup page

**Workaround:**
1. Go to project page: `/project/{id}`
2. Click "Add Images & Tag Products" button
3. Modal opens directly (no routing)

---

### Issue: Can't find my project

**Navigate:**
1. Go to `/designer` page
2. All your projects listed there
3. Click project name to open
4. Or click "Continue Setup" for drafts

---

### Issue: Tagging tab doesn't appear

**Requirement:** Must have images first

**Steps:**
1. Open modal
2. Go to "Images" tab
3. Add at least 1 image
4. "Tagging" tab appears
5. Switch to Tagging tab

---

## Example: Complete "Kips Bay Showhouse" Workflow

### 1. Create Project
```
- Click "+ Create" → "Publish Now"
- Name: "Kips Bay Showhouse"
- Description: [paste your description]
- Click "Continue to Upload & Tag"
```

### 2. Access Upload/Tag Modal

**Automatic (if it works):**
- Redirects to `/project/{id}/setup`
- Modal should open

**Manual (if automatic fails):**
- Click URL bar
- Replace `/setup` with just `/project/{id}`
- Press Enter
- Click "Add Images & Tag Products" button in sidebar

### 3. Add Images
```
- Click "Add Image"
- Paste URL: https://images.unsplash.com/photo-...
- Room: "Bathroom"
- Add more images as needed
- Click "Next"
```

### 4. Tag Products
```
- Click on bathtub in image
- Search: "Kohler clawfoot"
- Select product
- ✅ Affiliate URL generates
- Click on vanity
- Search: "Artistic Tile Casino Royale"
- Select product
- ✅ Affiliate URL generates
- Repeat for all products
```

### 5. Complete
```
- Click "Update Project"
- Modal closes
- View project with images & tagged products
- Publish if draft (green checkmark from /designer)
```

---

## Quick Reference

| Action | Location | Button/Link |
|--------|----------|-------------|
| **Upload images** | Project page sidebar | "Add Images & Tag Products" |
| **Tag products** | Same modal (after images) | Click on image |
| **Continue setup** | Designer profile | "Continue Setup" (drafts) |
| **Publish draft** | Designer profile | Green checkmark |
| **View project** | Anywhere | `/project/{id}` URL |

---

## Summary

✅ **Button added to project page** - Always accessible  
✅ **Modal opens on click** - No routing required  
✅ **Setup page fixed** - Modal opens on load  
✅ **Two reliable paths** - Choose what works  

**Try Method 1 first** - Click "Add Images & Tag Products" from your project page. It's the most reliable!

---

**Status:** Ready to use  
**Recommended:** Use button on project page  
**Backup:** Use /project/{id}/setup route





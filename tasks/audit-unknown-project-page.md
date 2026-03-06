# Audit: `/designer/projects/[id]` — The Unknown Page

## Context

The URL `https://folioad.com/designer/projects/be3e09b9-...` renders a page the founder doesn't recognize. This audit identifies what it is, how users reach it, and whether it should exist.

---

## 1. What renders at this URL?

**File:** `src/app/designer/projects/[id]/page.tsx` (lines 1–505)
**Component:** `ProjectDashboard` (client component, `'use client'`)

This is a **standalone room-management dashboard** — completely separate from the main project workspace at `/project/[id]`.

- **No `?view=` parameter handling.** The component never calls `useSearchParams()`. There is no tab system. There is no conditional rendering based on query params.
- **No redirect logic.** It does not redirect anywhere — it renders its own content directly.
- **Not the same page as `/project/[id]?view=media`.** That route (`src/app/project/[id]/page.tsx`) is an entirely different page component — a server component with a tab system (`overview | media | boards | drafts | files | publish | story`).

**The default view when no `?view=` is specified:** There is no view param concept here. The page always renders the same fixed layout.

---

## 2. What content does it show?

**Data fetched client-side** (lines 62–94):
- `GET /api/designer/projects/${id}` — project with rooms, selections, images
- `GET /api/designer/projects` — all projects (for context)

**Layout rendered** (lines 245–502):
1. **Header** — back arrow, project name, category badge, description (lines 245–262)
2. **Action buttons grid** (lines 265–318):
   - Add Project-Level Selection
   - Add Room
   - Toggle Public/Private
   - Tag Products
   - Export Spec Sheet
   - Upload Files
3. **Rooms grid** (lines 396–459) — cards for each room showing:
   - Room name, icon, selection count
   - Thumbnail grid of first 4 selection photos
   - "Manage Room" button → navigates to `/designer/projects/[id]/rooms/[roomId]`
4. **Empty state** if no rooms (lines 462–483)

**What it does NOT show:**
- No project images/media gallery
- No editorial/story content
- No boards view
- No tabs

---

## 3. How does a user reach this URL?

Every inbound link to bare `/designer/projects/[id]` (no sub-path, no view param):

| Source | File | Line | Link |
|--------|------|------|------|
| Designer dashboard "Manage" button | `src/app/designer/page.tsx` | 381 | `href={/designer/projects/${project.id}}` |
| Portfolio mosaic "Edit" button | `src/components/profile/ProjectMosaic.tsx` | 330 | `href={/designer/projects/${item.id}}` |
| Room page back buttons (×2) | `src/app/designer/projects/[id]/rooms/[roomId]/page.tsx` | 248, 271 | `router.push(/designer/projects/${projectId})` |
| Visit token redirect | `src/app/visit/[token]/page.tsx` | 169 | `window.location.href = /designer/projects/${projectId}` |

**Not linked here:**
- Project creation flow → redirects to `/project/${id}?view=media` (via `UnifiedCreateProjectUI.tsx:72`)
- Interview/draft/publish flows → all go to `/designer/projects/[id]/preview`
- No breadcrumbs point here

---

## 4. How does it differ from the tabbed views?

There are **two completely separate route trees** for projects:

### Route A: `/project/[id]` — Main workspace (tabbed)
- **File:** `src/app/project/[id]/page.tsx` (server component)
- **Tabs:** `overview | media | boards | drafts | files | publish | story`
- **Default:** `?view=media` (set by project creation redirect)
- **Purpose:** The primary project editing experience — media upload, boards, editorial drafts, publishing

### Route B: `/designer/projects/[id]` — Room management dashboard (no tabs)
- **File:** `src/app/designer/projects/[id]/page.tsx` (client component)
- **Tabs:** None
- **Purpose:** Legacy(?) room/selection management UI — add rooms, manage selections per room, toggle public, export spec sheet

**The URLs the user asked about:**
| URL | What renders |
|-----|-------------|
| `/designer/projects/[id]` | Room management dashboard (this mystery page) |
| `/designer/projects/[id]?view=media` | Same room dashboard — the `?view=media` param is **silently ignored** |
| `/designer/projects/[id]?view=publish` | Same room dashboard — param ignored |
| `/designer/projects/[id]?view=boards` | Same room dashboard — param ignored |
| `/project/[id]?view=media` | Main workspace, media tab |
| `/project/[id]?view=boards` | Main workspace, boards tab |

---

## 5. Should this URL exist?

### Assessment

This appears to be a **legacy management page** from an older architecture where projects were organized around rooms and selections. The main project workspace (`/project/[id]`) has since evolved with a full tab system (media, boards, drafts, story, publish) that supersedes most of this page's functionality.

**Evidence it's legacy/orphaned:**
- The room/selection model it manages doesn't appear to be the primary workflow anymore
- The main project creation flow sends users to `/project/[id]?view=media`, not here
- It has no tab system or view-param handling — simpler, older architecture
- The data model (rooms → selections with photos/notes/vendorId) differs from the main workspace's media/boards model

**However, it IS reachable:**
- The designer dashboard "Manage" button links here
- The portfolio mosaic "Edit" button links here
- The visitor token flow redirects here
- Room detail pages navigate back here

### Recommendations

1. **If the room/selection model is deprecated:** Redirect `/designer/projects/[id]` → `/project/[id]?view=media` and update the 4 inbound links above
2. **If the room/selection model is still needed:** This page needs design attention — it's functional but clearly wasn't designed as a landing page
3. **Immediate quick fix:** At minimum, update the designer dashboard "Manage" button (`src/app/designer/page.tsx:381`) to link to `/project/[id]?view=media` instead, so users reach the primary workspace

### Files that would need changes (if redirecting):
- `src/app/designer/projects/[id]/page.tsx` — add redirect or remove
- `src/app/designer/page.tsx:381` — update "Manage" link
- `src/components/profile/ProjectMosaic.tsx:330` — update "Edit" link
- `src/app/visit/[token]/page.tsx:169` — update redirect target
- `src/app/designer/projects/[id]/rooms/[roomId]/page.tsx:248,271` — update back navigation

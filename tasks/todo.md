# Guided Publish Flow — Conditional Tab Visibility

## Plan Status: READY FOR REVIEW

---

## Audit Summary

### Key Finding: Dual Publish Paths
There are two publish functions with different behaviors:
1. **`publishEditorial`** (`actions/projects.ts:78`) — called by PublishPanel → only updates `ProjectPost.status` to `'PUBLISHED'`, does NOT update `Project.publishedAt`
2. **`publishProjectAction`** (`actions/projects.ts:258`) — updates `Project.status = 'published'`, `Project.isPublic = true`, `Project.publishedAt`
3. **Status API** (`posting/project/[id]/status`) — updates both Project and ProjectPost

**Implication**: Tab visibility cannot rely solely on `Project.publishedAt`. Must also check `ProjectPost.status`.

### Current Tab State
- All 4 tabs always rendered (`ProjectTabs.tsx`)
- URL-based navigation (`?view=boards|media|story|publish`)
- Default tab: `boards`
- Project page already fetches `post.expandedBlocks` from ProjectPost

### Editorial Terminology
- 23 user-facing instances of "editorial" across ~12 files
- Admin/magazine pages use "editorial" deliberately (lower priority)
- Designer-facing flow has ~15 instances to rename

---

## Implementation Plan

### Phase 1: Conditional Tab Visibility

#### 1a. Extend ProjectPost fetch in page.tsx
**File**: `src/app/project/[id]/page.tsx`
- Add `status` to the `post` select query (line 71) so we can determine publish state
- Compute `isPublished` flag: `base.post?.status === 'PUBLISHED' || !!base.publishedAt`
- Pass `isPublished` to `ProjectTabs`
- Add redirect: if `view === 'story' || view === 'publish'` and `!isPublished`, redirect to `media`
- Change default tab from `boards` to `media` for unpublished projects

#### 1b. Filter tabs in ProjectTabs.tsx
**File**: `src/app/project/[id]/ProjectTabs.tsx`
- Add `isPublished: boolean` to `ProjectTabsProps`
- Filter `tabs` array: only include `story` and `publish` when `isPublished === true`
- No disabled states, no locks — tabs simply don't exist in the array

### Phase 2: Guided Publish Flow (Inline in Media Tab)

#### 2a. Add guided flow to MediaSection
**File**: `src/app/project/[id]/MediaSection.tsx`
- Extend props to accept project publish state and details
- Below the image grid `</section>`, render `<GuidedPublishFlow>` when: `images.length > 0 && !isPublished && isOwner`

#### 2b. Create GuidedPublishFlow component
**New file**: `src/app/project/[id]/GuidedPublishFlow.tsx`
- Client component with two sections:

**Section 1 — Project Summary Card** (always visible when images exist):
- Shows: project title, project type, city/region, image count, room count (from existing project data)
- Editable inline (title, type, location fields)
- Saves via existing project update API
- Collapsible, starts expanded if fields are empty

**Section 2 — Publish CTA**:
- Primary "Publish" button
- On click: opens `PublishPreviewModal`
- If no story draft exists yet, generates one first (same API as PublishPanel)
- Button states: "Publish" → "Creating your story..." → modal opens with preview

#### 2c. Create PublishPreviewModal component
**New file**: `src/app/project/[id]/PublishPreviewModal.tsx`
- Modal overlay showing generated story preview
- Fetches draft via `GET /api/posting/project/{id}/drafts`
- Displays: title, deck, narrative section previews
- "Publish" button at bottom → calls `POST /api/projects/{id}/approvals/publish-editorial`
- "Back" button to close modal
- On publish success: `router.refresh()` (page reloads, tabs appear, shows media tab)
- Also calls the same Project-level publish to ensure `Project.publishedAt` is set

### Phase 3: Terminology Cleanup (User-Facing Only)

Files and changes:
1. `src/components/interview/shared/EditorialPreview.tsx:40` — "Your editorial is taking shape" → "Your story is taking shape"
2. `src/components/posting/interview/FooterBar.tsx:109` — "Generate Editorial" → "Create Story"
3. `src/components/interview/InterviewFlow.tsx:243` — "Creating your editorial draft..." → "Creating your story..."
4. `src/app/project/[id]/DraftsPanel.tsx:722` — "No editorial draft yet..." → "No story draft yet..."
5. `src/components/posting/interview/InterviewModal.tsx` — Multiple: "AI editorial assistant" → "AI assistant", "editorial draft" → "story draft"
6. `src/components/posting/interview/InterviewModeSelector.tsx:68-69` — "editorial AI" → "story AI"
7. `src/components/posting/FinishScheduleOptionsModal.tsx:116` — "editorial content" → "richer story content"
8. `src/app/project/[id]/OverviewTab.tsx:233` — "Create editorial draft" → "Create story"
9. `src/components/magazine/MagazineProductRail.tsx:24` — "Products from this editorial" → "Products from this story"
10. `src/components/atelier/EditorialMosaic.tsx` — "Editorial" badge → "Story", aria-label fix

**Not changing** (admin/magazine context where "editorial" is deliberate):
- `src/app/editorials/page.tsx` — public editorial features page
- `src/app/admin/editorial-review/page.tsx` — admin interface

### Phase 4: Edge Cases

- **URL guard**: `?view=story` or `?view=publish` on unpublished project → redirect to `?view=media`
- **No images**: Only upload interface, no guided flow elements
- **Returning to unpublished draft with images**: Guided flow shows current state (summary card, publish button)
- **Published project**: All 4 tabs visible, land on media by default
- **`publish_now` intent**: Routes through same guided flow in Media tab

---

## Files Modified (Summary)

| # | File | Change Type |
|---|------|-------------|
| 1 | `src/app/project/[id]/page.tsx` | Modify — add post.status to query, compute isPublished, default tab logic, redirect |
| 2 | `src/app/project/[id]/ProjectTabs.tsx` | Modify — conditional tab filtering |
| 3 | `src/app/project/[id]/MediaSection.tsx` | Modify — render GuidedPublishFlow below image grid |
| 4 | `src/app/project/[id]/GuidedPublishFlow.tsx` | **New** — inline publish sequence |
| 5 | `src/app/project/[id]/PublishPreviewModal.tsx` | **New** — preview modal |
| 6-15 | Various (Phase 3) | Modify — terminology "editorial" → "story" |

## Execution Order
1. Phase 1a+1b — Tab visibility (foundation)
2. Phase 2a+2b+2c — Guided flow + modal (core feature)
3. Phase 3 — Terminology cleanup (mechanical)
4. Phase 4 — Edge case testing & verification

## Risks & Mitigations
- **Risk**: `publishEditorial` doesn't set `Project.publishedAt`, causing tab detection mismatch
  - **Mitigation**: Detect publish via `ProjectPost.status === 'PUBLISHED'` (already fetched via post relation)
- **Risk**: Breaking existing published project views
  - **Mitigation**: `isPublished` check uses OR logic — either source triggers published state
- **Risk**: Draft generation in guided flow might fail
  - **Mitigation**: Error handling with retry, fallback to showing just the publish button

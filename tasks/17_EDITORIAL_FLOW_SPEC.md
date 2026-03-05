# 17 — Editorial Flow Specification

> **Status**: Spec draft
> **Date**: 2026-03-05
> **Scope**: Interview → Generation → Editing → Publish

---

## Section 1: Current State (Problems)

### 1A. Project States and Transitions (Audit)

The project editorial lifecycle has five implicit states, but they are **not formalized** — routing logic is spread across `page.tsx:114-139` and `ProjectTabs.tsx:44-77` with ad-hoc boolean checks.

**State detection today:**

| Check | File:Line | What it does |
|-------|-----------|-------------|
| `hasDraftOrPublished` | `page.tsx:115` | `!!base.post \|\| !!base.publishedAt` |
| `isPublished` | `page.tsx:117` | `base.post?.status === 'PUBLISHED' \|\| !!base.publishedAt` |

**Tab visibility rules:**

| Tab | Condition | File:Line |
|-----|-----------|-----------|
| Boards | Always visible | `ProjectTabs.tsx:50` |
| Media | Always visible | `ProjectTabs.tsx:56` |
| Story | `isPublished === true` | `ProjectTabs.tsx:62` |
| Publish | `hasDraftOrPublished === true` | `ProjectTabs.tsx:68-69` |

**Per-state behavior today:**

**EMPTY** (no answers, no draft, not published):
- Media tab is default. Guided publish flow hidden (no images).
- Publish tab: redirected to media (`page.tsx:137-139`).
- Story tab: redirected to media (`page.tsx:133-135`).
- "Preview & Publish" button: does not exist (no `GuidedPublishFlow` rendered without images).

**Has images, no interview, no draft:**
- GuidedPublishFlow renders below image grid (`MediaSection.tsx:526-535`).
- Shows "Proceed to Publish" button → opens `InterviewModal` (`GuidedPublishFlow.tsx:163-168`).
- Publish tab: redirected to media (no `post` exists).
- Story tab: redirected to media.

**INTERVIEWED** (has answers, no draft):
- Same as above — no generation has happened yet.
- The interview saves answers to `EditorialInterviewAnswer` but no `ProjectPost` is created until generation runs.
- Publish tab still redirected (no `post` exists).

**GENERATED** (has answers + draft, not published):
- `hasDraftOrPublished` is true → Publish tab appears.
- GuidedPublishFlow shows "Preview & Publish" (primary) + "Redo Interview" (secondary) (`GuidedPublishFlow.tsx:147-161`).
- "Preview & Publish" → opens `PublishPreviewModal` showing title/deck/first 3 narrative paragraphs (`PublishPreviewModal.tsx:137-181`).
- "Redo Interview" → opens `InterviewModal` again.
- Publish tab → `StagingPublishPanel` shows immersive preview with `ImmersiveProjectPage`, readiness checklist, regenerate button, publish button.
- Story tab: still redirected (not published).

**PUBLISHED:**
- `isPublished` is true → both Story and Publish tabs visible.
- Publish tab → `StagingPublishPanel` shows "Published" banner, "View Post" link, "Unpublish" button.
- Story tab → `StoryPanel` shows interview answers, credits editor, regenerate draft option.
- GuidedPublishFlow hidden (`isPublished` check in `MediaSection.tsx:526`).

**UNPUBLISHED** (was published, reverted):
- `publishEditorial` sets `ProjectPost.status = 'PUBLISHED'` but **does not** set `Project.publishedAt` (`actions/projects.ts:114-115`).
- Unpublish calls `/api/posting/project/{id}/status` with `action: 'unpublish'` (`usePublishFlow.ts:277-280`).
- After unpublish: `publishSuccess = false`, `publishedSlug = null` in client state.
- **Problem**: If `Project.publishedAt` was set by a different code path, `isPublished` remains true even after unpublish because of the OR check (`page.tsx:117`).

### 1B. Interview Flow (Audit)

**Question generation** (`src/lib/editorial/getInterviewQuestions.ts:92-111`):
- Calls `assessProjectContext(projectId)` to determine context level (0-5).
- Calls `classifyProjectSize(roomCount, selectionCount)` to get target question count:
  - 1 room → 6 questions
  - 2-3 rooms → 8-10 questions
  - 4-6 rooms → 12-14 questions
  - 7+ rooms → 15-18 questions
- Calls `generateInterviewQuestions(context)` which produces contextual questions based on rooms, selections, vendors, images.
- Falls back to `BASE_QUESTIONS` (5 generic) if contextual system produces < 4 questions.

**Question presentation** (`InterviewModal.tsx`):
- Sequential: one question at a time, progress counter "Q3 of 12".
- All questions auto-selected on load (no pick phase) — `InterviewModal.tsx:478-503`.
- `MIN_QUESTIONS = 5` before coverage-based skipping is allowed (`InterviewModal.tsx:53`).

**Follow-up generation** (`InterviewModal.tsx:597-672`):
- After each answer, calls `/api/posting/project/{id}/interview/followups/single`.
- Returns 0-2 follow-up questions + question updates (covered/morphed).
- Morphed questions: LLM rewrites remaining questions to avoid redundancy.
- Covered questions: skipped entirely after MIN_QUESTIONS threshold.

**Room awareness**: Questions are generated with room context (via `contextLevel.ts` → `RoomContext`), but **the interview UI has no room-level pacing**. The designer sees a flat sequential list with no indication of which room is being discussed. There are no room pills, no per-room progress, no skip-room controls.

**"Pick up where I left off"** (`InterviewModal.tsx:216-387`):
- On open, fetches `/api/posting/project/{id}/interview` for saved answers.
- Also checks `localStorage` for autosaved draft (`interviewDraft:{projectId}`).
- Merges server + localStorage answers.
- If answers exist: shows "draft resume" prompt with `draftAnswerCount`.
- Restores `currentQuestionIndex` and `phase` from localStorage.
- **Does not** skip to first unanswered — restores exact saved position.

**Interview mode selection** (`InterviewModeSelector.tsx`):
- Two modes: "Live Conversation" (realtime/voice) and "Written Responses" (text).
- Mode selector shown when `flags.realtimeInterview && realtimeInterviewConfig.enabled`.
- Voice mode uses LiveKit (`RealtimeInterviewView`).

### 1C. Generation Trigger (Audit)

- When last question is answered, `autoGenerateRef.current = true` and phase → "complete" (`InterviewModal.tsx:767-768`).
- `handleGenerate` is called (either automatically or via button):
  - Validates all base answers are non-empty (`InterviewModal.tsx:979`).
  - Persists all answers + follow-ups to server.
  - POSTs to `/api/posting/project/{id}/interview/generate?forceOverwriteDraft=true&mode=recomposition`.
  - Sends `answersOverride` and `followupsOverride` in body.
- **No gate** requiring all rooms to have answers. No minimum answer threshold beyond "all selected questions must be answered."
- Generation can happen with answers for only some rooms if the question bank didn't include all rooms.

### 1D. Post-Generation Editing (Audit)

**After generation, the user can:**
1. **Regenerate entire article** — "Regenerate" button in `StagingPublishPanel.tsx:157-164` calls `generateDraft()` which re-calls the generation endpoint.
2. **Toggle context** — "Include my bio" and "Reference my other projects" checkboxes (`StagingPublishPanel.tsx:183-210`).
3. **View immersive preview** — `ImmersiveProjectPage` renders the article as readers see it.

**What's missing:**
- **No inline editing** of generated text.
- **No section-level regeneration** — only full article regeneration.
- **No feedback mechanism** — no way to say "make this section more casual."
- **No manual edit preservation** — regeneration replaces everything.
- **No undo/version history** — previous drafts are overwritten.

### 1E. Publish Tab vs Preview (Audit)

**Publish tab** (`?view=publish`):
- Full-width, outside `<main>` wrapper (`page.tsx:244`).
- Server-side fetches `getPostForStaging(projectId)` for expandedBlocks + modules.
- If no draft: shows `NoDraftState` with "Generate Draft" button.
- If draft exists: shows `StagingPublishPanel` with sticky top banner, immersive preview, sticky bottom footer with readiness checklist + publish button.

**PublishPreviewModal** (`PublishPreviewModal.tsx`):
- Overlay modal triggered from GuidedPublishFlow's "Preview & Publish" button.
- Shows simplified preview: title, deck, first 3 narrative paragraphs.
- Has its own Publish button → calls `flow.publish()`.
- On success: redirects to `?view=publish`.

**Key difference**: The publish tab is the full editing/staging surface. The preview modal is a lightweight confirmation step for first-time publish from the media tab.

---

## Section 2: State Machine

### States

```
EMPTY → INTERVIEWED → GENERATED → PUBLISHED
                                       ↓
                                   UNPUBLISHED
                                       ↓
                                   GENERATED (re-edit)
                                       ↓
                                   PUBLISHED (re-publish)
```

| State | Condition |
|-------|-----------|
| **EMPTY** | No `EditorialInterview` exists OR interview has 0 answers AND no `ProjectPost` exists |
| **INTERVIEWED** | `EditorialInterview` has ≥1 answer AND no `ProjectPost` exists (or post has no expandedBlocks) |
| **GENERATED** | `ProjectPost` exists with `expandedBlocks` AND `status !== 'PUBLISHED'` |
| **PUBLISHED** | `ProjectPost.status === 'PUBLISHED'` |
| **UNPUBLISHED** | `ProjectPost` exists with `expandedBlocks` AND `status === 'DRAFT'` AND `ProjectPost.publishedAt` is not null (was previously published) |

### Per-State UI

#### EMPTY
| Surface | Content |
|---------|---------|
| Media tab | Image upload interface. No guided flow (no images). |
| Publish tab | Redirected to Media. |
| Story tab | Redirected to Media. |
| Primary CTA | "Upload Photos" (in Media tab). |
| Secondary | None. |

#### INTERVIEWED
| Surface | Content |
|---------|---------|
| Media tab | Image grid + GuidedPublishFlow with "Proceed to Publish" → opens InterviewModal. If answers exist but no draft, CTA says "Generate Story" and triggers generation directly. |
| Publish tab | Redirected to Media (no post exists). |
| Story tab | Redirected to Media. |
| Primary CTA | "Generate Story" (triggers generation from answers). |
| Secondary | "Redo Interview" (reopens InterviewModal). |

#### GENERATED
| Surface | Content |
|---------|---------|
| Media tab | Image grid + GuidedPublishFlow with "Preview & Publish" (primary) + "Redo Interview" (secondary). |
| Publish tab | `StagingPublishPanel` — immersive preview + readiness checklist + "Publish to Folio" button. Editing surface for inline edits, section feedback, regeneration. |
| Story tab | Redirected to Media (not yet published). |
| Primary CTA | "Publish to Folio" (in Publish tab footer). |
| Secondary | "Regenerate", context toggles, section-level feedback (all in Publish tab). |
| Navigation | Clicking "Preview & Publish" in Media → navigates to `?view=publish`. |

#### PUBLISHED
| Surface | Content |
|---------|---------|
| Media tab | Image grid. GuidedPublishFlow hidden. |
| Publish tab | `StagingPublishPanel` — "Published" banner, "View Post" link, "Unpublish" button, regenerate. |
| Story tab | `StoryPanel` — interview answers, credits editor, supplemental quotes. |
| Primary CTA | "View Post" (external link to `/p/{slug}`). |
| Secondary | "Unpublish", "Regenerate", "Edit article" (returns to Publish tab editing surface). |

#### UNPUBLISHED
| Surface | Content |
|---------|---------|
| Media tab | Image grid + GuidedPublishFlow with "Preview & Publish" + "Redo Interview". |
| Publish tab | Same as GENERATED but with a banner: "Previously published — changes require re-publishing." |
| Story tab | Redirected to Media (no longer published). |
| Primary CTA | "Re-publish" (in Publish tab). |
| Secondary | "Regenerate", edit, redo interview. |

### Transitions

| From | Action | To |
|------|--------|----|
| EMPTY | Complete interview (≥1 answer saved) | INTERVIEWED |
| INTERVIEWED | Generate article | GENERATED |
| INTERVIEWED | Redo interview | INTERVIEWED (reset) |
| GENERATED | Publish | PUBLISHED |
| GENERATED | Regenerate | GENERATED |
| GENERATED | Redo interview | INTERVIEWED (new generation needed) |
| PUBLISHED | Unpublish | UNPUBLISHED |
| PUBLISHED | Regenerate | PUBLISHED (live content updated) |
| UNPUBLISHED | Re-publish | PUBLISHED |
| UNPUBLISHED | Regenerate | UNPUBLISHED (draft updated) |
| UNPUBLISHED | Redo interview + regenerate | GENERATED |

---

## Section 3: Interview Pacing Model

### Room Progress Tracking

The interview should know all rooms in the project (from `Room` model and image room labels).

**Progress indicator** at top of interview modal:

```
[ Kitchen ✓ ] [ Living Room ◐ ] [ Primary Bath ○ ] [ Entry ○ ]
```

- **Not started** (○ gray): no answers for this room
- **In progress** (◐ partial fill): some answers, below minimum
- **Complete** (✓ filled): minimum questions met or all questions answered
- **Skipped** (⊘ strikethrough): explicitly skipped by designer

Current room highlighted. Designer sees: "Kitchen — 3 of 5 questions" style progress.

### Per-Room Question Budget

Room importance determines question depth. Formula:

```
baseQuestions = max(2, min(5, ceil(imageCount * 0.7 + tagCount * 0.3)))
```

| Room characteristic | Base questions | Follow-up budget |
|---------------------|---------------|-----------------|
| 1-2 images, 0-3 tags (powder bath, laundry) | 2 | 1 |
| 3-4 images, 4-8 tags (guest bath, office) | 3 | 2 |
| 5-7 images, 9-15 tags (kitchen, primary bed) | 4 | 2-3 |
| 8+ images, 16+ tags (great room, showcase kitchen) | 5 | 3 |

### Skip Controls

- Skip button appears after room minimum is met: "Move to next room →"
- Skip does **not** end the interview — advances to next room.
- "Finish interview" only appears after ALL rooms have been completed or explicitly skipped.
- Skipped rooms are tracked: `roomProgress[roomId].status = 'skipped'`.

### Question Generation Per Room

**Base questions (2-5 per room):**
Generated from room type, tagged products, and image content. Uses existing `generateInterviewQuestions` system but partitioned by room.

**Follow-up questions (1-3 per room):**
Generated from the designer's base answers for THAT room via `/interview/followups/single`. These go deeper on what they said. Same mechanism as today but scoped to room context.

**Cross-room questions (0-1, after 3+ rooms complete):**
New question type generated after sufficient room coverage:
- "You mentioned [X] in the kitchen and [Y] in the living room — was there a unifying thread?"
- These create connective tissue for the editorial narrative.
- Generated by passing all completed room answers to the follow-up endpoint with a `crossRoom: true` flag.

### Global Interview Gates

| Gate | Threshold | Type |
|------|-----------|------|
| Minimum total answers | `max(5, roomCount * 2)` | Hard block — cannot generate |
| Room with 3+ images, zero answers | Any such room exists | Warning (yellow banner) |
| Room with 5+ product tags, zero answers | Any such room exists | Warning (yellow banner) |
| All rooms skipped (no completed rooms) | Zero completed rooms | Hard block |

Warnings are non-blocking — designer can override by clicking "Generate anyway."

### "Pick Up Where I Left Off" Behavior

1. Load all existing answers from server + localStorage.
2. Compute room progress: which rooms are complete, in-progress, or untouched.
3. Jump to the first room that is either:
   - In-progress (has some answers but below minimum), OR
   - Not started (zero answers) and not skipped.
4. Show progress indicator with completed rooms filled.
5. Do NOT re-ask answered questions unless designer clicks "Re-answer this question" on a specific answer.
6. For in-progress rooms, resume at the next unanswered question within that room.

---

## Section 4: Post-Generation Review & Editing

The Publish tab (`?view=publish`) becomes the primary editing surface.

### Article Display

- Show the generated article in its final formatted layout using `ImmersiveProjectPage` (existing component).
- Each section/room block gets a subtle hover state revealing edit controls.
- Sections are individually selectable.

### Inline Text Editing

- Designer clicks any paragraph → text becomes editable (contentEditable or textarea overlay).
- Edits are saved as **overrides** on the section:
  ```json
  {
    "sectionIndex": 2,
    "originalBody": "The kitchen anchors the home...",
    "editedBody": "The kitchen is the heart of this home...",
    "editedAt": "2026-03-05T..."
  }
  ```
- Original generated text preserved underneath so regeneration doesn't lose manual edits.
- Visual indicator: subtle "Edited" pill on manually modified sections vs "As generated" (default, no pill).

### Section-Level Feedback & Regeneration

- Each section has a feedback button (small icon, not dominant).
- Clicking opens a compact text input: "What would you change about this section?"
- Placeholder examples: "Make this more casual" / "Omit the backsplash detail" / "Focus on the material choice"
- Submit regenerates ONLY that section, passing:
  - The original interview answers for that room
  - The designer's feedback note
  - The rest of the article (for tone/context consistency)
  - The product tags for that room
- New section replaces old. Designer can undo (revert to previous version).
- API: `POST /api/posting/project/{id}/sections/{index}/regenerate` with `{ feedback: string }`.

### General Feedback & Full Regeneration

- "Regenerate entire article" button (existing, in banner).
- Optional note field added: "Any specific direction?" (text input that appears on click).
- Warning: "This will replace the current article. Any manual edits will be lost unless you keep them."
- Checkbox: "Keep my manual edits" — if checked, sections with `editedBody` are preserved and only non-edited sections regenerate.

### Additional Questions

- Per-room "Answer more questions" button visible in the Publish tab's article sections.
- Opens 2-3 additional follow-up questions specific to that room (inline expandable, not a modal).
- After answering, designer can regenerate that section with new context.
- New answers are **added** to the existing answer pool, not replacing.
- API: `POST /api/posting/project/{id}/interview/followups/single` with `{ roomId, additionalContext: true }`.

### Context Toggles (Existing)

- "Include my bio" toggle — `StagingPublishPanel.tsx:183-189`.
- "Reference my other projects" toggle — `StagingPublishPanel.tsx:193-199`.
- These affect regeneration, not display. Already implemented.

---

## Section 5: Publish Flow

### Pre-Publish Checklist (Non-Blocking)

Displayed in the sticky footer of the Publish tab (existing `ReadinessItem` pattern in `StagingPublishPanel.tsx:377-407`):

- [ ] All rooms covered in interview (or explicitly skipped)
- [ ] Article reviewed (designer has scrolled through publish tab)
- [ ] Cover image selected
- [ ] Products tagged on at least one image
- [ ] No accuracy warnings from generation

All items are indicators, not gates. Designer can publish with incomplete checklist.

### Publish Action

- Single "Publish to Folio" button (existing).
- Confirmation step: shows article title, room count, image count.
- On publish:
  - `ProjectPost.status` → `'PUBLISHED'`
  - `ProjectPost.publishedAt` → `now()`
  - `Project.isPublic` → `true`
  - `Project.publishedAt` → `now()`
  - **Both** ProjectPost and Project updated in single transaction (fixes current dual-path bug).
- API: consolidate into the existing `/api/projects/{id}/approvals/publish-editorial` endpoint.

### Post-Publish

- "View published article" link → `/p/{slug}` (existing).
- "Share to Instagram" flow (existing Instagram campaign system).
- "Edit article" → navigates to `?view=publish` editing surface.
- Edits after publish require explicit "Re-publish" to go live (UNPUBLISHED state while editing).

---

## Section 6: Data Model Changes

All changes are **ADD-only** — no destructive migrations.

### New Fields on `ProjectPost`

```prisma
model ProjectPost {
  // ... existing fields ...

  // Manual edit overlay — JSON array of section overrides
  // [{ sectionIndex: number, originalBody: string, editedBody: string, editedAt: DateTime }]
  sectionOverrides    Json?     @map("section_overrides")

  // Section regeneration history — JSON array
  // [{ sectionIndex: number, versions: [{ body: string, feedback?: string, createdAt: DateTime }] }]
  sectionHistory      Json?     @map("section_history")

  // Generation feedback note (for full regeneration)
  lastGenerationNote  String?   @map("last_generation_note")  @db.Text
}
```

### New Fields on `EditorialInterview`

```prisma
model EditorialInterview {
  // ... existing fields ...

  // Per-room completion tracking — JSON object
  // { [roomId]: { status: 'not_started' | 'in_progress' | 'complete' | 'skipped', answeredCount: number, minimumMet: boolean } }
  roomProgress        Json?     @map("room_progress")
}
```

### New Fields on `EditorialInterviewAnswer`

```prisma
model EditorialInterviewAnswer {
  // ... existing fields ...

  // Room association for room-aware pacing
  roomId              String?   @map("room_id")

  // Cross-room question flag
  isCrossRoom         Boolean   @default(false) @map("is_cross_room")
}
```

### No New Models Required

The existing models are sufficient with the above additions:
- Section overrides live on `ProjectPost.sectionOverrides` (JSON).
- Section version history lives on `ProjectPost.sectionHistory` (JSON).
- Room progress lives on `EditorialInterview.roomProgress` (JSON).
- Room association on answers uses existing `Room.id` reference.

---

## Section 7: Implementation Sequencing

### Phase A: Fix the State Machine

**Goal**: Correct routing for all 5 states. No new features.

**Changes:**
1. Formalize state computation in `page.tsx` — single `getEditorialState()` function returning `EMPTY | INTERVIEWED | GENERATED | PUBLISHED | UNPUBLISHED`.
2. Fix `isPublished` check to use `ProjectPost.status === 'PUBLISHED'` only (remove `|| !!base.publishedAt` fallback that causes UNPUBLISHED state to show as PUBLISHED).
3. Fix `publishEditorial` action to also set `Project.publishedAt` and `Project.isPublic` in the same transaction.
4. Fix unpublish to clear `Project.publishedAt` and set `Project.isPublic = false`.
5. Add UNPUBLISHED state detection and appropriate tab visibility.
6. Route "Preview & Publish" in GENERATED state directly to `?view=publish` instead of opening PublishPreviewModal.

**Files**: `page.tsx`, `ProjectTabs.tsx`, `GuidedPublishFlow.tsx`, `actions/projects.ts`, `status/route.ts`.

**Test**: Verify all 5 states show correct tabs, buttons, and redirects.

### Phase B: Interview Pacing

**Goal**: Room progress, per-room budgets, skip controls, proper gating.

**Changes:**
1. Add `roomProgress` field to `EditorialInterview` schema.
2. Add `roomId` field to `EditorialInterviewAnswer` schema.
3. Modify question generation to partition questions by room.
4. Add room progress indicator UI to `InterviewModal`.
5. Add skip-room and finish-interview controls.
6. Add global gates (minimum answers, room coverage warnings).
7. Update "pick up where I left off" to use room progress.
8. Add cross-room question generation after 3+ rooms complete.

**Files**: `prisma/schema.prisma`, `InterviewModal.tsx`, `contextLevel.ts`, `generateQuestions.ts`, `getInterviewQuestions.ts`, `useInterviewQuestions.ts`.

**Test**: Create project with 4+ rooms. Verify room pills, per-room question flow, skip controls, resume behavior.

### Phase C: Post-Generation Editing

**Goal**: Inline edits, section feedback, section-level regeneration.

**Changes:**
1. Add `sectionOverrides` and `sectionHistory` fields to `ProjectPost` schema.
2. Build inline editing in `StagingPublishPanel` — contentEditable paragraphs with save-on-blur.
3. Build section feedback UI — per-section feedback button + text input.
4. Build section regeneration API: `POST /api/posting/project/{id}/sections/{index}/regenerate`.
5. Build undo mechanism (revert to previous version from `sectionHistory`).
6. Add "Edited" vs "As generated" visual indicators.
7. Add per-room "Answer more questions" inline expansion.

**Files**: `prisma/schema.prisma`, `StagingPublishPanel.tsx`, new `SectionEditor.tsx` component, new API route, `ImmersiveProjectPage.tsx` (add edit affordances).

**Test**: Generate article, edit a paragraph, regenerate a section with feedback, verify undo, verify manual edits survive full regeneration with "Keep my edits" checked.

### Phase D: Full Regeneration with Feedback

**Goal**: Directed regeneration, edit preservation, additional context.

**Changes:**
1. Add `lastGenerationNote` field to `ProjectPost`.
2. Add optional feedback text input to the Regenerate button flow.
3. Implement "Keep my manual edits" checkbox logic — preserve `sectionOverrides` entries during regeneration.
4. Pass feedback note to generation prompt.
5. Wire context toggles to section-level regeneration (not just full article).

**Files**: `StagingPublishPanel.tsx`, `usePublishFlow.ts`, `generate/route.ts`, prompt builders.

**Test**: Regenerate with feedback note, verify tone/content changes. Edit 2 sections manually, regenerate with "Keep my edits" checked, verify those 2 sections preserved.

---

## Section 8: Open Questions

- **Question:** Should room progress be persisted server-side (EditorialInterview.roomProgress) or client-side (localStorage)?
  - **Context:** Currently the interview autosaves to both server and localStorage. Room progress is interview UI state but also needed for "pick up where I left off" across devices.
  - **Options:** (A) Server-side only — simpler resume, works across devices, adds DB writes. (B) Server + localStorage hybrid — localStorage for in-flight, server for completed rooms. (C) Server-side, synced on room completion — fewer writes, slight risk of losing in-progress state.

- **Question:** Should the UNPUBLISHED state show the Story tab or hide it?
  - **Context:** Currently Story tab requires `isPublished`. After unpublish, the article content still exists in ProjectPost. The Story tab shows interview answers and credits, which are useful during editing.
  - **Options:** (A) Hide Story tab when unpublished — simpler, matches current behavior. (B) Show Story tab always once a draft exists — gives access to interview answers and credits during editing. (C) Merge Story tab content into the Publish tab editing surface — eliminates the need for a separate tab.

- **Question:** For section-level regeneration, should the section be replaced in-place or shown as a diff?
  - **Context:** The designer needs to compare old vs new. A direct replacement with undo is simpler but doesn't let them compare side-by-side.
  - **Options:** (A) Replace in-place with undo button (1-level undo). (B) Show new version below old with "Accept" / "Keep original" buttons. (C) Replace in-place with full version history accessible via dropdown.

- **Question:** When a designer does "Redo Interview," should existing answers be cleared or preserved?
  - **Context:** Currently "Redo Interview" opens the InterviewModal which shows a "draft resume" prompt. The designer can choose to continue or start over. Starting over clears localStorage but server answers may persist.
  - **Options:** (A) Always show resume prompt — designer chooses. (B) Clear all answers and start fresh (destructive). (C) Keep existing answers but allow re-answering any question (non-destructive).

- **Question:** Cross-room questions — should they appear as a separate "Connections" phase after all rooms, or interleaved after the 3rd room?
  - **Context:** Cross-room questions need context from multiple rooms. Showing them as a separate phase is cleaner but adds another step. Interleaving feels more natural but interrupts room flow.
  - **Options:** (A) Separate phase after all rooms complete — "Connecting your spaces" section with 2-3 questions. (B) Interleaved — after completing room 3+, one cross-room question appears before the next room. (C) Optional — shown in post-generation editing as "Answer more questions" with cross-room prompts.

- **Question:** What should the minimum image count be before showing the guided publish flow?
  - **Context:** Currently GuidedPublishFlow renders when `images.length > 0` (`MediaSection.tsx:526`). The publish banner shows at `images.length >= 3` (`MediaSection.tsx:263`). Generation quality is poor with < 3 images.
  - **Options:** (A) Keep at 1 image — allow early exploration. (B) Require 3+ images — matches the banner threshold, ensures minimum quality. (C) Show guided flow at 1 image but gate generation at 3+ — lets designers see the flow without generating garbage.

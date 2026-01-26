# Project Posting/Publishing Regeneration & Iteration Audit

**Date:** 2026-01-26
**Scope:** Post regeneration, follow-up questions, PDF import connection, admin impersonation, testing capabilities

---

## 1. Capability Matrix

| Capability | Status | Location |
|------------|--------|----------|
| **Post Regeneration** | ✓ Exists | `InterviewModal.tsx`, `/api/posting/project/[projectId]/interview/generate/route.ts` |
| **Re-run after adding tags** | ✓ Exists | Generate endpoint auto-picks up new tags |
| **Versioning/history** | ✗ Missing | Single DRAFT slot, overwrites on regeneration |
| **Follow-up questions** | ✓ Exists | Sequential per-question generation via `/api/.../followups/single` |
| **Interview state persistence** | ✓ Exists | Server (`provenance.interview.payload`) + localStorage |
| **"Edit Answers / Regenerate"** | ✓ Exists | Preview page button reopens modal |
| **PDF import → Post CTA** | ✗ Missing | No prompt to regenerate after import |
| **"New products available" indicator** | ✗ Missing | No UI notification |
| **Admin impersonation** | ✓ Exists | `/api/admin/impersonate/[id]`, 4-hour sessions |
| **Admin view as user** | ✓ Exists | Full impersonation with UI banner |
| **Admin edit on behalf of user** | ✓ Exists (via impersonation) | Can perform any action as user |
| **Create test projects as admin** | ✓ Exists | `POST /api/admin/projects` |
| **Seed data/test fixtures** | ✓ Exists | `npm run seed`, `prisma/seed.js` |
| **User context switching** | ✓ Exists | Impersonation system with audit logging |

---

## 2. Detailed Capability Analysis

### 2.1 Post Regeneration

**Status:** ✓ Exists
**Location:**
- `src/components/posting/interview/InterviewModal.tsx:709-782`
- `src/app/api/posting/project/[projectId]/interview/generate/route.ts:1440-2020`

**Current Behavior:**
- Designers CAN re-run post generation at any time (within 5/day limit)
- New tags from images are automatically picked up on regeneration
- `forceOverwriteDraft=true` is always used - completely replaces `expandedBlocks`
- Interview answers (`provenance.interview.payload`) are PRESERVED across regenerations
- Metadata tracks: `generatedAt`, `generatedWith` (answer/image counts)

**Gap for Demo Flow:**
- **No versioning** - previous draft content is lost on regeneration
- No diff view to compare before/after regeneration
- No selective regeneration (e.g., regenerate only certain chapters)

---

### 2.2 Follow-up Questions Flow

**Status:** ✓ Exists
**Location:**
- `src/components/posting/interview/InterviewModal.tsx:96-1330`
- `src/components/posting/interview/FollowUpsForm.tsx:31-299`
- `src/app/api/posting/project/[projectId]/interview/followups/single/route.ts`

**Current Behavior:**
- 4-phase flow: pick → question → followup → complete
- Per-question follow-up generation with acknowledgment sentences
- Can resume incomplete interviews (server + localStorage persistence)
- "Edit Answers / Regenerate" button on preview page reopens modal
- Auto-save every 60 seconds in follow-up phase

**Gap for Demo Flow:**
- No "add more questions" after initial selection without re-entering pick phase
- No inline answer editing on preview (must reopen modal)
- Sequential one-question-at-a-time flow can be slow

---

### 2.3 PDF Import → Post Connection

**Status:** ✗ Missing
**Location:**
- `src/app/project/[id]/MediaSection.tsx:154-156`
- `src/components/import/PdfSpecImportModal.tsx:272-279`

**Current Behavior:**
- PDF finalize calls `router.refresh()` only
- Products are created but no notification shown
- User must manually navigate to Publish tab
- User must manually click "Generate Editorial"

**Gap for Demo Flow:**
- **Critical gap** - No CTA to regenerate post after import
- No "new products available" indicator
- No state tracking for "new since last generation"
- Files tab and Publish tab don't communicate

---

### 2.4 Admin Impersonation

**Status:** ✓ Exists
**Location:**
- `src/app/api/admin/impersonate/[id]/route.ts`
- `src/app/api/admin/impersonate/exit/route.ts`
- `src/components/admin/ImpersonationBanner.tsx`
- `src/app/admin/users/page.tsx:194-207`

**Current Behavior:**
- Admin can start impersonation from `/admin/users` dropdown
- Cannot impersonate other admins (403 error)
- 4-hour session max with httpOnly cookie
- All impersonations logged in `ImpersonationLog` table
- Amber warning banner shown globally during impersonation
- Can perform any action as impersonated user

**Gap for Demo Flow:**
- None - fully functional for demo purposes

---

### 2.5 Testing Without Real Designer

**Status:** ✓ Exists
**Location:**
- `prisma/seed.js` - Main seed with users, events, products
- `prisma/seed-nycx.ts` - NYCxDesign 2026 festival + 140 test designers
- `src/app/api/admin/designers/route.ts` - Create designers via API
- `src/app/api/admin/projects/route.ts` - Create projects via API

**Current Behavior:**
- Seed creates: `admin@folio.com`, `designer@folio.com`, `vendor@folio.com` (password: `password123`)
- Admin can create test designers via API or UI
- Admin can create projects on behalf of any designer
- Demo mode for `demodesigner@folio.com` with guided tour
- Full impersonation for QA testing

**Gap for Demo Flow:**
- Demo designer tour is hardcoded to specific project (`/p/meru-XB4XBK`)
- No bulk project creation tool

---

## 3. Critical Gaps for Demo Flow

### Priority 1: PDF Import → Post Regeneration CTA

**Problem:** After PDF import, users have no prompt to regenerate their post with new products.

**Impact:** Designers may not realize posts can be improved with newly imported products.

**Recommended Solution:**
```
Option A: Banner in Publish tab
- After PDF import completion, show "New products added! Regenerate your post?"
- Track products added since last generation timestamp

Option B: Post-import modal
- After PDF finalize, show CTA: "Would you like to update your editorial with these products?"
- One-click regeneration option
```

### Priority 2: Post Version History

**Problem:** Regeneration overwrites existing draft with no way to recover previous version.

**Impact:** Designers may lose content they preferred from an earlier generation.

**Recommended Solution:**
```
Option A: Simple version snapshots
- Before regeneration, save previous expandedBlocks to history array
- Allow restore from last N versions (e.g., 3)

Option B: Generation comparison
- Show diff between current and newly generated content
- Let user accept/reject changes per section
```

### Priority 3: Inline Answer Editing

**Problem:** Must reopen full interview modal to edit answers for regeneration.

**Impact:** Friction in iterative refinement flow.

**Recommended Solution:**
```
- Add inline edit buttons on preview page next to each answer
- Quick save triggers partial regeneration
- Or: "Quick Edit" mode that shows answers inline
```

---

## 4. Recommended Build Order for Demo-Ready State

### Phase 1: Critical Path (Demo Blocker)
1. **PDF Import → Regenerate CTA** - Add banner/modal after import completion
2. **"New products available" indicator** - Show in Publish tab when products added since last generation

### Phase 2: Quality of Life
3. **Generation comparison view** - Show what changed before committing
4. **Simple version history** - Store last 3 drafts, allow restore
5. **Inline answer editing** - Edit without full modal re-entry

### Phase 3: Polish
6. **Selective regeneration** - Regenerate specific chapters only
7. **Bulk test project creation** - Admin tool for creating multiple test projects
8. **Demo tour updates** - Point to real projects, not hardcoded

---

## 5. Key Models Reference

### ProjectPost Schema
```prisma
model ProjectPost {
  id              String      @id @default(cuid())
  projectId       String      @unique
  status          PostStatus  @default(DRAFT)  // DRAFT|REVIEW|PUBLISHED|ARCHIVED
  expandedBlocks  Json?       // Generated content structure
  provenance      Json?       // Interview answers, metadata
  credits         Json?
  publishedAt     DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}
```

### expandedBlocks Structure
```typescript
{
  lead: { title?, kicker?, deck? },
  galleryChapters: [{
    title?, body: string[], imageIds: string[], pullQuote?
  }],
  pullQuotes?: string[],
  materialsLedger?: { items: [...] },
  method?: string[],
  qa?: [{ q, a, role }],
  credits?: [{ role, name, url? }],
  mode: 'recomposition'|'verbatim'
}
```

### provenance.interview Structure
```typescript
{
  payload: {
    answers: InterviewAnswer[],
    followups: InterviewAnswer[],
    selectedQuestionIds: string[],
    imageOrder: string[]
  },
  status?: { phase, startedAt?, endedAt? },
  generatedAt?: number,
  generatedWith?: { answerCount, followupCount, selectionCount, imageCount }
}
```

---

## 6. File Reference Index

| Component | File Path |
|-----------|-----------|
| InterviewModal | `src/components/posting/interview/InterviewModal.tsx` |
| FollowUpsForm | `src/components/posting/interview/FollowUpsForm.tsx` |
| Generate endpoint | `src/app/api/posting/project/[projectId]/interview/generate/route.ts` |
| Interview API | `src/app/api/posting/project/[projectId]/interview/route.ts` |
| Followups single | `src/app/api/posting/project/[projectId]/interview/followups/single/route.ts` |
| MediaSection | `src/app/project/[id]/MediaSection.tsx` |
| PdfSpecImportModal | `src/components/import/PdfSpecImportModal.tsx` |
| DraftsPanel | `src/app/project/[id]/DraftsPanel.tsx` |
| Preview page | `src/app/designer/projects/[id]/preview/page.tsx` |
| PostExpanded | `src/components/posting/PostExpanded.tsx` |
| Impersonation API | `src/app/api/admin/impersonate/[id]/route.ts` |
| Impersonation Banner | `src/components/admin/ImpersonationBanner.tsx` |
| Admin users page | `src/app/admin/users/page.tsx` |
| Admin projects API | `src/app/api/admin/projects/route.ts` |
| Admin designers API | `src/app/api/admin/designers/route.ts` |
| Seed script | `prisma/seed.js` |
| NYCx seed | `prisma/seed-nycx.ts` |
| Schema | `prisma/schema.prisma:1074-1094` (ProjectPost) |

---

## 7. Summary

**What Works Well:**
- Post regeneration is fully functional with preserved interview data
- Follow-up questions flow is sophisticated with per-question AI generation
- Admin impersonation is production-ready with full audit trail
- Test data infrastructure is comprehensive

**What Needs Work:**
- PDF import → Post connection is completely missing
- No versioning or history for generated content
- No inline editing for iterative refinement

**For Demo:**
The most critical gap is the PDF import → Post regeneration connection. A designer completing the full flow (upload PDF → extract products → generate post) would not receive any prompt to regenerate their editorial with the newly imported products.

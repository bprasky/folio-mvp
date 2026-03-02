# Profile Consolidation Plan

## Goal
Make the monograph (`/monograph/[username]`) the canonical public profile, fix its critical issues, and build the individual bio interview to populate it with real content.

---

## Phase 1: Fix the Monograph's Critical Issues (This Week)

### 1.1 Remove "return first designer" fallback
**File:** `src/app/monograph/[username]/page.tsx` (lines 96-104)
**What:** Delete the last-resort fallback that returns the first designer when no match is found. This is a dev-only crutch that would show the wrong designer in production.
**Change:** Remove lines 96-104. The `containsMatch` fallback (lines 81-94) is already generous enough. If nothing matches, return `null` and let `notFound()` on line 133 handle it.
**Complexity:** Trivial (delete 8 lines)

### 1.2 Replace hardcoded fingerprint tags with real data
**File:** `src/app/monograph/[username]/page.tsx` (lines 110-120, `getFingerprintTags`)
**What:** The function returns hardcoded strings like "Warm Minimalism", "Natural Materials", etc. Replace with real data from `user.specialties` (String[] on User model) and/or `user.aestheticProfile` (Json field).
**Change:**
- Update `getDesignerByUsername` select to include `specialties` and `aestheticProfile`
- Rewrite `getFingerprintTags` to pull from specialties first, fall back to parsed aestheticProfile, then empty array
**Complexity:** Low (1 file, ~20 lines changed)

### 1.3 Add profile image to the Hero component
**Files:**
- `src/app/monograph/[username]/page.tsx` — pass `profileImage` to Hero
- `src/components/monograph/Hero.tsx` — add optional `profileImageUrl` prop, render circular avatar
**What:** Currently the hero only shows a project hero image. Add the designer's `profileImage` as a circular avatar overlaid in the bottom-left, next to the name.
**Complexity:** Low (2 files, ~15 lines)

### 1.4 Wire real editorial featured count
**File:** `src/app/monograph/[username]/page.tsx` (line 194)
**What:** `editorialsFeatured` is hardcoded to `12`. Query `ProjectPost` count where project belongs to this designer and status is `'PUBLISHED'`.
**Change:** Add a parallel query in the `Promise.all` block:
```ts
prisma.projectPost.count({
  where: { project: { designerId: designer.id }, status: 'PUBLISHED' }
})
```
**Complexity:** Trivial (add 1 query, remove hardcoded value)

### 1.5 Fix hardcoded fallback metrics
**File:** `src/app/monograph/[username]/page.tsx` (lines 190-194)
**What:** `followers`, `projectViews`, `productSaves` all have fake fallbacks (`18420`, `184600`, `4247`). Should fall back to `0`.
**Change:** Replace `|| 18420` with `|| 0`, etc.
**Complexity:** Trivial (3 lines)

---

## Phase 1B: Make the Monograph Discoverable

### 1.6 Redirect designer credit links to monograph
**Files to change:**
- `src/components/project/CreditsSection.tsx` (line 40) — `/designer/${credit.userId}`
- `src/components/project/ImmersiveProjectPage.tsx` (line 110) — `/designer/${designer.id}`
- `src/components/feed/stories/StoryViewer.tsx` (line 71) — `/designer/${g.designer.slug}`
- `src/components/ProjectCreationModal.tsx` (line 578) — `/designer/${c.userId}`

**New file:** `src/lib/utils/getMonographUrl.ts`
```ts
export function getMonographUrl(user: { name: string }): string {
  return `/monograph/${user.name.replace(/\s+/g, '').toLowerCase()}`;
}
```
Update all 4 components to use this utility. Designer name is already available in context for all 4 cases.
**Complexity:** Medium (4 files + 1 new utility, ~30 lines)

### 1.7 Add "View Public Profile" link to /designer/profile
**File:** `src/app/designer/profile/page.tsx`
**What:** Add a link near the edit/save buttons that says "View Public Profile" → opens monograph in new tab.
**Complexity:** Trivial (5 lines)

### 1.8 Add canonical monograph link to directory listings
**File:** Directory page designer cards should link to `/monograph/{username}` instead of `/designer/{id}`.
**Complexity:** Low (1 file, ~10 lines)

---

## Phase 1C: Standardize Published Project Count

### 1.9 Fix /profile/[userId] hero count
**File:** `src/app/profile/[userId]/page.tsx` (lines 82-84)
**What:** Currently counts only `{ isPublic: true }`. Should use full OR filter.
**Change:**
```ts
OR: [
  { isPublic: true },
  { publishedAt: { not: null } },
  { status: 'published' }
]
```
**Complexity:** Trivial

### 1.10 Fix /api/profile/[userId] count
**File:** `src/app/api/profile/[userId]/route.ts` (line 54)
**What:** Same — `_count` select uses only `{ isPublic: true }`.
**Complexity:** Trivial

### 1.11 Extract shared published project filter
**New file:** `src/server/queries/filters.ts`
```ts
export const PUBLISHED_PROJECT_FILTER = {
  OR: [
    { isPublic: true },
    { publishedAt: { not: null } },
    { status: 'published' }
  ]
};
```
Apply to all occurrences across the codebase.
**Complexity:** Low (1 new file, update 3-5 imports)

---

## Phase 2: Individual Bio Interview (Next Week)

### 2.1 Reusability Assessment
The org `BioInterviewModal` is **highly reusable**. The org-specific parts are just:
- Question content (from `interview-questions.ts`)
- API endpoint (`/api/orgs/${orgId}/bio-interview`)
- Name interpolation (`{orgName}`)

**Recommendation:** Create a parallel individual version (Option A) for speed, refactor to shared base later.

### 2.2 Create individual interview question sets
**New file:** `src/lib/profile-interview/interview-questions.ts`

| Org Question | Individual Equivalent |
|---|---|
| "How did {orgName} get started?" | "What's your design origin story?" |
| "Design philosophy?" | Same (reuse) |
| "Project types?" | Same (reuse) |
| "Where are you based?" | Same (reuse) |
| "Ideal client?" | Same (reuse) |
| L2: "How do perspectives shape studio voice?" | Remove (N/A for individual) |
| L3: "Studio recognition?" | "What recognition have you received?" |
| L3: "Collaborators?" | Same (reuse) |

**Complexity:** Low (~150 lines, mostly adapted)

### 2.3 Create generate-profile-bio.ts
**New file:** `src/lib/profile-interview/generate-profile-bio.ts`
Adapted from `generate-org-bio.ts`. Same Anthropic pipeline, same output format. Different prompt framing + DB writes to `prisma.profileInterview` instead of `prisma.orgBioInterview`.

**Field mapping note:** ProfileInterview uses `generatedBio` (not `fullBio`) and `philosophyStatement` (not `philosophyTagline`). The generation function maps between these.
**Complexity:** Low-Medium (~120 lines)

### 2.4 Create API endpoints
**New files:**
- `src/app/api/profile-interview/route.ts` — POST save answers, GET fetch
- `src/app/api/profile-interview/generate/route.ts` — POST trigger generation

Auth: session user only (no org permission checks needed). Writes to `prisma.profileInterview.upsert`.
**Complexity:** Low-Medium (~130 lines total)

### 2.5 Create ProfileInterviewModal
**New file:** `src/components/profile-interview/ProfileInterviewModal.tsx`
Duplicate of BioInterviewModal with individual question sets and API endpoints.
**Complexity:** Medium (~200 lines)

### 2.6 Add "Start Bio Interview" trigger
**File:** `src/app/designer/profile/page.tsx`
CTA button that opens ProfileInterviewModal. Show when no ProfileInterview exists or status is DRAFT.
**Complexity:** Low (~20 lines)

### 2.7 Surface generated bio on the monograph
**Files:**
- `src/app/monograph/[username]/page.tsx` — add `profileInterview` to query
- `src/components/monograph/Hero.tsx` — add optional subtitle prop for philosophyStatement
- `src/components/monograph/Services.tsx` — add optional processDescription prop

**Mapping:**
- `philosophyStatement` → subtitle under designer name in Hero
- `shortBio` → opening quote section
- `pullQuotes` → interspersed in page
- `processDescription` → Services section context

**Complexity:** Medium (3 files, ~40 lines)

---

## Phase 3: Deprecate Redundant Surfaces (Later)

| Surface | Current | Future |
|---|---|---|
| `/monograph/[username]` | Editorial profile (disconnected) | **Canonical public profile** |
| `/designer/profile` | Edit + display hybrid | Edit dashboard only (not public) |
| `/profile/[userId]` | Public profile with stats | Redirect → monograph |
| `/designer/[username]` | Aesthetic brand page | Redirect → monograph |
| `/profile` | Account settings | Unchanged |

---

## Complexity Summary

| Task | Files | Lines | Effort |
|---|---|---|---|
| **Phase 1 Total** | ~15 files | ~140 lines | **1-2 days** |
| **Phase 2 Total** | ~9 files | ~660 lines | **2-3 days** |
| **Phase 3** | ~3 files | ~30 lines | **Half day** |

---

## Key Risks & Decisions Needed

1. **Username resolution is fragile.** The monograph uses a name-matching chain (email prefix → exact name → contains). Long-term needs a proper `slug` field on User. Works for current user base but is tech debt.

2. **Credit link migration breaks bookmarks.** Changing `/designer/{id}` → `/monograph/{name}` breaks old URLs. Phase 3 adds redirects from old routes.

3. **ProfileInterview vs OrgBioInterview field names differ.** `generatedBio` vs `fullBio`, `philosophyStatement` vs `philosophyTagline`. Handle mapping in the generation function.

4. **Monograph URL scheme.** Currently `/monograph/[username]`. The archived Navigation component already generates `/@username` links. Consider a middleware rewrite `/@*` → `/monograph/*` eventually.

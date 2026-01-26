# Ralph Eligibility Audit Report - Folio MVP

**Audit Date:** 2026-01-25
**Codebase Size:** 1,530 TypeScript files
**Tech Stack:** Next.js 14.1, TypeScript (strict: false), Prisma, NextAuth, Supabase, Zod

---

## Executive Summary

The Folio codebase presents **significant opportunities** for Ralph-eligible automation. The combination of:
- TypeScript strict mode being **disabled**
- Only **1 test file** in the entire codebase
- **380 API routes** with inconsistent validation patterns
- **1,000+ type safety issues** (`any` types, type assertions)
- **500+ console.log statements** that should be proper logging

...creates a large surface area of well-defined, repetitive tasks ideal for autonomous AI coding loops.

---

## Ralph-Eligible Task Categories

### 1. Console.log Cleanup

**Pattern:** Replace console.log/error/warn with structured logging or remove debug statements

**Files Affected:** 500+ files with console statements (see detailed list in `/root/.claude/projects/...`)

**Complexity:** Low

**Risk:** Low - console statements don't affect functionality

**Acceptance Criteria:**
- [ ] No `console.log` in production code (API routes, lib functions)
- [ ] Debug statements in dev-only files are acceptable
- [ ] `console.error` in catch blocks can remain if no logging system exists
- [ ] typecheck passes
- [ ] `npm run build` succeeds

**Sample Stories (5 examples):**
- `src/app/vendor/project/[id]/page.tsx` (13 console statements): Remove debug logging
- `src/app/vendor/project/[id]/rooms/[roomId]/page.tsx` (11 console statements): Remove debug logging
- `src/jobs/embedding-updater.ts` (15 console statements): Convert to structured logging
- `src/jobs/edge-decay.ts` (15 console statements): Convert to structured logging
- `src/app/projects/ProjectsPageClient.tsx` (7 console statements): Remove debug logging

**Estimated Total Stories:** 150-200 (batch by directory)
**Recommended Batch Size:** 10-15 files per Ralph run

---

### 2. TypeScript `any` Type Replacement

**Pattern:** Replace explicit `: any` type annotations with proper types

**Files Affected:** 421 files with 1,006 occurrences of `: any`

**Complexity:** Low-Medium (depends on inference complexity)

**Risk:** Low - TypeScript strict mode is OFF, so no immediate breakage

**Acceptance Criteria:**
- [ ] `: any` replaced with specific type
- [ ] Type can be inferred from usage context
- [ ] No new `@ts-ignore` added
- [ ] typecheck passes
- [ ] existing imports don't break

**Sample Stories (5 examples):**
- `src/lib/editorial/curator.ts` (19 any types): Type editorial curation functions
- `src/components/posting/PostExpanded.tsx` (16 any types): Type post rendering props
- `src/components/posting/interview/InterviewModal.tsx` (13 any types): Type interview flow
- `src/app/project/[id]/DraftsPanel.tsx` (10 any types): Type draft management
- `src/lib/editorial/buildEditorialChapters.ts` (10 any types): Type chapter building

**Estimated Total Stories:** 200-250 (batch by module/feature area)
**Recommended Batch Size:** 5-10 files per Ralph run (related files together)

---

### 3. `as any` Type Assertion Removal

**Pattern:** Replace `as any` type assertions with proper typing or type guards

**Files Affected:** 151 files with 381 occurrences

**Complexity:** Medium

**Risk:** Low-Medium - may require interface changes

**Acceptance Criteria:**
- [ ] `as any` replaced with specific type assertion or removed
- [ ] Type guards used where runtime checking needed
- [ ] typecheck passes
- [ ] no runtime behavior change

**Sample Stories (5 examples):**
- `src/app/api/auth/[...nextauth]/options.ts` (28 assertions): Type NextAuth configuration
- `src/app/api/posting/project/[projectId]/interview/generate/route.ts` (30 assertions): Type interview generation
- `src/app/org/[orgId]/page.tsx` (16 assertions): Type org page data
- `src/app/events/[id]/FestivalDetailClient.tsx` (12 assertions): Type festival data
- `src/lib/editorial/getOrCreateEditorialDraft.ts` (10 assertions): Type editorial drafts

**Estimated Total Stories:** 75-100
**Recommended Batch Size:** 3-5 files per Ralph run

---

### 4. API Route Zod Validation

**Pattern:** Add Zod schema validation to API routes missing input validation

**Files Affected:** ~355 routes (380 total - 25 with Zod)

**Complexity:** Low-Medium

**Risk:** Medium - could reject previously accepted (invalid) input

**Acceptance Criteria:**
- [ ] Request body parsed with Zod schema
- [ ] Proper error response (400) for validation failures
- [ ] Schema matches existing expected shape
- [ ] typecheck passes
- [ ] route still functions with valid input

**Sample Stories (5 examples):**
- `src/app/api/vendor/projects/route.ts`: Add project creation schema
- `src/app/api/vendor/visits/route.ts`: Add visit tracking schema
- `src/app/api/designer/profile/route.ts`: Add profile update schema
- `src/app/api/organizations/route.ts`: Add org creation schema
- `src/app/api/products/route.ts`: Add product creation schema

**Estimated Total Stories:** 300-350
**Recommended Batch Size:** 10-15 related routes per Ralph run

---

### 5. Hardcoded Color Replacement

**Pattern:** Replace hardcoded hex colors with Tailwind/design system tokens

**Files Affected:** 119 component files with 961 hardcoded colors

**Complexity:** Low

**Risk:** Low - visual changes reviewable in browser

**Acceptance Criteria:**
- [ ] Hex colors replaced with Tailwind classes (e.g., `bg-neutral-800`)
- [ ] If no token exists, document in component comment
- [ ] Visual appearance matches (use design system equivalent)
- [ ] typecheck passes
- [ ] no CSS errors

**Sample Stories (5 examples):**
- `src/components/vendor/events/ai/AiDashboard.tsx` (28 colors): Convert to design tokens
- `src/components/profile/unified/ProfileAbout.tsx` (25 colors): Convert to design tokens
- `src/components/org-onboarding/OrgAboutTab.tsx` (24 colors): Convert to design tokens
- `src/components/vendor/events/post/TimeToSpec.tsx` (23 colors): Convert to design tokens
- `src/components/vendor/events/post/TopProductsPost.tsx` (22 colors): Convert to design tokens

**Estimated Total Stories:** 100-120
**Recommended Batch Size:** 5-8 component files per Ralph run

---

### 6. next/image Migration

**Pattern:** Replace `<img>` tags with Next.js `<Image>` component for optimization

**Files Affected:** ~130 components using `<img>` or custom Image (206 total - 78 with next/image)

**Complexity:** Low-Medium

**Risk:** Low - visual, easily testable

**Acceptance Criteria:**
- [ ] `<img>` replaced with `<Image>` from `next/image`
- [ ] `width` and `height` or `fill` prop set appropriately
- [ ] `alt` text preserved or added if missing
- [ ] Image renders correctly
- [ ] No layout shift (CLS) issues

**Sample Stories (5 examples):**
- `src/components/ProjectCreationModal.tsx` (101 img refs): Migrate project images
- `src/components/project/editorial/layoutEngine.ts` (92 img refs): Migrate editorial images
- `src/components/instagram/InstagramExportModal.tsx` (53 img refs): Migrate Instagram preview images
- `src/components/posting/PostExpanded.tsx` (34 img refs): Migrate post images
- `src/components/boards/GeneratedGrid.tsx` (33 img refs): Migrate board images

**Estimated Total Stories:** 80-100
**Recommended Batch Size:** 3-5 components per Ralph run

---

### 7. JSDoc Documentation

**Pattern:** Add JSDoc comments to exported functions in /lib

**Files Affected:** 218 files with 580 exported functions (many missing JSDoc)

**Complexity:** Low

**Risk:** Low - documentation only

**Acceptance Criteria:**
- [ ] Exported functions have JSDoc with `@param` and `@returns`
- [ ] Complex types have `@example` usage
- [ ] No functionality changes
- [ ] typecheck passes

**Sample Stories (5 examples):**
- `src/lib/permissions.ts` (32 exports): Document permission checking functions
- `src/lib/authz/access.ts` (6 exports): Document authorization utilities
- `src/lib/pricing/tiers.ts` (14 exports): Document pricing tier logic
- `src/lib/pricing/subscription-service.ts` (12 exports): Document subscription functions
- `src/lib/fibonacciUtils.ts` (8 exports): Document layout utilities

**Estimated Total Stories:** 150-180
**Recommended Batch Size:** 8-12 files per Ralph run

---

### 8. ErrorBoundary Wrapping

**Pattern:** Wrap component trees with ErrorBoundary for graceful error handling

**Files Affected:** Currently only 4 usages; ~200 page/layout components need boundaries

**Complexity:** Low

**Risk:** Low - adds safety without changing behavior

**Acceptance Criteria:**
- [ ] Page-level components wrapped with ErrorBoundary
- [ ] Fallback UI appropriate for context
- [ ] Error logging preserved
- [ ] Component still renders normally
- [ ] typecheck passes

**Sample Stories (5 examples):**
- `src/app/project/[id]/page.tsx`: Add error boundary with project error UI
- `src/app/designer/[username]/page.tsx`: Add error boundary with profile error UI
- `src/app/vendor/dashboard/page.tsx`: Add error boundary with dashboard error UI
- `src/app/events/[id]/page.tsx`: Add error boundary with event error UI
- `src/app/search/page.tsx`: Add error boundary with search error UI

**Estimated Total Stories:** 40-50 (page components only)
**Recommended Batch Size:** 8-10 pages per Ralph run

---

### 9. TODO/FIXME/HACK Resolution

**Pattern:** Address or document technical debt markers

**Files Affected:** 63 files with 82 TODO/FIXME/HACK comments

**Complexity:** Medium (varies by task)

**Risk:** Medium - depends on the specific TODO

**Acceptance Criteria:**
- [ ] TODO addressed OR converted to tracked issue
- [ ] FIXME fixed OR documented why deferred
- [ ] HACK cleaned up OR justified in comment
- [ ] typecheck passes
- [ ] existing tests pass

**Sample Stories (5 examples):**
- `src/app/project/[id]/DesignerBoard.tsx` (3 TODOs): Resolve board TODOs
- `src/components/vendor/actions/CreateAppreciationDinnerDrawer.tsx` (3 TODOs): Resolve modal TODOs
- `src/app/api/collaboration/stories/[id]/publish/route.ts` (2 TODOs): Resolve publish TODOs
- `src/lib/boost/notifyVendor.ts` (2 TODOs): Resolve notification TODOs
- `src/app/monograph/[username]/page.tsx` (2 TODOs): Resolve monograph TODOs

**Estimated Total Stories:** 60-80
**Recommended Batch Size:** 5-8 files per Ralph run (requires judgment)

---

### 10. Non-null Assertion Cleanup

**Pattern:** Replace `!.` non-null assertions with proper null checks

**Files Affected:** 22 files with 46 non-null assertions

**Complexity:** Low

**Risk:** Low - adds safety

**Acceptance Criteria:**
- [ ] `!.` replaced with optional chaining or null check
- [ ] Appropriate fallback behavior defined
- [ ] No runtime errors on null
- [ ] typecheck passes

**Sample Stories (5 examples):**
- `src/components/project/editorial/layoutEngine.ts` (6 assertions): Add null checks to layout
- `src/app/api/products/[productId]/insights/route.ts` (8 assertions): Add null checks to insights
- `src/app/api/designer/directory/route.ts` (3 assertions): Add null checks to directory
- `src/app/api/instagram/campaign/generate/route.ts` (3 assertions): Add null checks to campaign
- `src/app/api/projects/[id]/interview-quotes/route.ts` (5 assertions): Add null checks to quotes

**Estimated Total Stories:** 20-25
**Recommended Batch Size:** 5-8 files per Ralph run

---

## Excluded from Ralph

| Task | Reason for Exclusion |
|------|---------------------|
| Enable TypeScript strict mode globally | Requires human decision on migration strategy; would cause 1000s of errors |
| Atelier fingerprinting logic changes | AI prompt engineering, requires domain expertise and human review |
| API authentication refactoring | Security-critical, requires human review of auth flows |
| Database schema migrations | High risk, requires careful planning and rollback strategy |
| Component library design decisions | Requires design taste and editorial judgment |
| N+1 query optimization | Requires understanding of data access patterns and potential side effects |
| Test suite architecture | Requires human decisions on testing strategy and framework |
| Accessibility (a11y) overhaul | Only 68 components have aria/role; needs design review for proper a11y |
| Major refactors (e.g., state management) | Architectural decisions requiring human judgment |
| Editorial content and copy changes | Requires editorial judgment and brand voice |

---

## Priority Ranking

### Recommended Ralph Run Order

| Priority | Category | Rationale |
|----------|----------|-----------|
| **1** | Console.log Cleanup | Lowest risk, no behavior change, immediate code quality improvement |
| **2** | Non-null Assertion Cleanup | Low risk, small scope (22 files), adds safety |
| **3** | TODO/FIXME Resolution | Medium scope, addresses documented tech debt |
| **4** | JSDoc Documentation | Low risk, documentation only, improves maintainability |
| **5** | Hardcoded Color Replacement | Visual changes easily reviewable, improves consistency |
| **6** | TypeScript `any` Replacement | Medium scope, improves type safety, no runtime impact |
| **7** | `as any` Assertion Removal | Builds on #6, requires more context |
| **8** | next/image Migration | Visual improvements, performance benefits, easily testable |
| **9** | ErrorBoundary Wrapping | Adds safety, low risk |
| **10** | API Route Zod Validation | Higher risk (could reject valid inputs), needs careful testing |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total TypeScript files | 1,530 |
| API routes | 380 |
| Components | 200+ |
| Test files | 1 |
| `: any` occurrences | 1,006 |
| `as any` occurrences | 381 |
| Non-null assertions | 46 |
| @ts-ignore/@ts-nocheck | 6 |
| Console statements | 500+ files |
| Hardcoded colors | 961 in 119 files |
| TODO/FIXME/HACK comments | 82 in 63 files |
| Files using next/image | 78 |
| ErrorBoundary usages | 4 |
| AGENTS.md files | 0 |

---

## Estimated Total Ralph Stories

| Category | Estimated Stories |
|----------|-------------------|
| Console.log Cleanup | 150-200 |
| TypeScript `any` Replacement | 200-250 |
| `as any` Assertion Removal | 75-100 |
| API Route Zod Validation | 300-350 |
| Hardcoded Color Replacement | 100-120 |
| next/image Migration | 80-100 |
| JSDoc Documentation | 150-180 |
| ErrorBoundary Wrapping | 40-50 |
| TODO/FIXME Resolution | 60-80 |
| Non-null Assertion Cleanup | 20-25 |
| **TOTAL** | **1,175-1,455 stories** |

---

## Next Steps

1. **Start with Console.log Cleanup** - Low risk, high volume, immediate improvement
2. **Create tracking issue** for each category to monitor progress
3. **Establish baseline metrics** before starting (lint warnings, type errors, etc.)
4. **Define batch boundaries** by directory/feature area for related changes
5. **Set up visual regression testing** before starting image/color migrations

---

*Report generated by Claude Opus 4.5 - 2026-01-25*

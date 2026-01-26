# Designer Component Audit Report

**Date:** 2026-01-26
**Auditor:** Claude Code
**Focus:** Designer-facing components and flows for founding designers

---

## Executive Summary

This audit evaluates the hardening opportunities for critical designer-facing components in Folio. The analysis covers 5 major flows with **39 identified hardening tasks** across error handling, loading states, empty states, input validation, type safety, and accessibility.

### Priority Distribution
- **Critical (P0):** 6 tasks - Core flows with high breakage risk
- **High (P1):** 14 tasks - Important UX improvements
- **Medium (P2):** 12 tasks - Polish and robustness
- **Low (P3):** 7 tasks - Nice-to-have improvements

### Estimated Total Stories: 18-22

---

## Flow 1: Project Upload Flow

### `src/components/ProjectCreationModal.tsx`
**Purpose:** Multi-step modal for creating/editing projects with image upload and product tagging
**User Impact if Broken:** **CRITICAL** - Primary entry point for all designer content
**Lines of Code:** ~1794

#### Current State Assessment

| Category | Status | Notes |
|----------|--------|-------|
| ErrorBoundary | ❌ Missing | No wrapper, throws propagate to parent |
| Try/catch on async | ✅ Good | All API calls wrapped |
| User-friendly errors | ⚠️ Partial | Some errors use technical language |
| Retry buttons | ✅ Good | Image retry implemented |
| Loading indicators | ✅ Good | Multiple loading states tracked |
| Skeleton UI | ❌ Missing | No skeleton for initial load |
| Disabled during submit | ✅ Good | `isSubmitting` properly used |
| Upload progress | ❌ Missing | No progress for multi-file uploads |
| Empty state UI | ⚠️ Partial | Basic empty grid, no CTA |
| Client-side validation | ⚠️ Partial | Name/category required, no inline feedback |
| File type validation | ✅ Good | Checks `file.type.startsWith('image/')` |
| File size validation | ✅ Good | 10MB limit enforced |
| Props typed | ⚠️ Partial | Uses `any` for `editingProject`, `onProjectCreated` |
| API responses typed | ❌ Missing | `any` used throughout |
| Optimistic updates | ✅ Good | Draft auto-save to localStorage |
| Accessibility | ⚠️ Partial | Missing aria-live for loading states |

#### Hardening Tasks (Ralph-eligible)

1. **[P0]** Wrap component in ErrorBoundary with project-specific fallback
2. **[P1]** Add upload progress indicator for batch image uploads
3. **[P1]** Replace `any` types with proper interfaces for `editingProject` and project data
4. **[P1]** Add inline validation feedback for required fields
5. **[P2]** Add skeleton loading state for initial modal render
6. **[P2]** Add aria-live regions for loading state announcements
7. **[P3]** Improve error messages to be more user-friendly

**Estimated Stories:** 3-4

---

## Flow 2: Editorial Generation Flow

### `src/components/posting/interview/InterviewModal.tsx`
**Purpose:** Multi-phase interview flow for generating editorial drafts
**User Impact if Broken:** **CRITICAL** - Core editorial generation workflow
**Lines of Code:** ~1403

#### Current State Assessment

| Category | Status | Notes |
|----------|--------|-------|
| ErrorBoundary | ❌ Missing | Complex component with many failure points |
| Try/catch on async | ✅ Good | All API calls wrapped |
| User-friendly errors | ✅ Good | Banner system for errors |
| Retry buttons | ⚠️ Partial | Skip/retry for follow-ups only |
| Loading indicators | ✅ Good | Multiple loading states |
| Skeleton UI | ⚠️ Partial | Loading spinner only |
| Disabled during submit | ✅ Good | `isSubmitting` properly used |
| Empty state UI | ✅ Good | "No questions available" state |
| Client-side validation | ✅ Good | Answer validation before submit |
| Props typed | ✅ Good | Well-typed interfaces |
| API responses typed | ⚠️ Partial | Some `any` types in API parsing |
| Optimistic updates | ✅ Good | localStorage autosave |
| LLM Health Check | ✅ Good | Pre-checks AI availability |
| Accessibility | ⚠️ Partial | Dialog has role, missing focus trapping |

#### Hardening Tasks (Ralph-eligible)

1. **[P0]** Wrap in ErrorBoundary with interview-specific recovery
2. **[P1]** Add retry button for failed follow-up generation
3. **[P1]** Type API response objects (`FollowupsApiResponse` is good, extend pattern)
4. **[P2]** Add focus management when transitioning between phases
5. **[P2]** Add skeleton loading for question cards
6. **[P3]** Add progress persistence recovery prompt on open

**Estimated Stories:** 3

---

### `src/lib/editorial/getOrCreateEditorialDraft.ts`
**Purpose:** Server-side function to get/create editorial drafts
**User Impact if Broken:** **HIGH** - Breaks editorial preview for published projects
**Lines of Code:** ~235

#### Current State Assessment

| Category | Status | Notes |
|----------|--------|-------|
| Try/catch on async | ✅ Good | Wrapped with fallback |
| Error logging | ✅ Good | Detailed console logs |
| Graceful fallback | ✅ Good | Returns minimal blocks on failure |
| Type safety | ✅ Good | Uses Zod schemas |
| Return value typing | ✅ Good | Well-typed return object |

#### Hardening Tasks (Ralph-eligible)

1. **[P2]** Add structured error codes for client-side handling
2. **[P3]** Add retry logic for transient database errors

**Estimated Stories:** 1

---

### `src/components/posting/PostExpanded.tsx`
**Purpose:** Renders the expanded editorial view of a project
**User Impact if Broken:** **HIGH** - Public-facing project display
**Lines of Code:** ~370

#### Current State Assessment

| Category | Status | Notes |
|----------|--------|-------|
| ErrorBoundary | ❌ Missing | Complex rendering with many edge cases |
| Null checks | ⚠️ Partial | Uses optional chaining but no fallbacks |
| Loading states | ❌ Missing | No loading indicator |
| Empty state | ⚠️ Partial | Sections conditionally render |
| Image error handling | ❌ Missing | Images can fail silently |
| Props typed | ⚠️ Partial | `payload: any` |

#### Hardening Tasks (Ralph-eligible)

1. **[P0]** Wrap in ErrorBoundary with graceful degradation
2. **[P1]** Type `payload` prop properly (or use Zod validation)
3. **[P1]** Add image error handling with fallback placeholders
4. **[P2]** Add loading skeleton for server-rendered content
5. **[P2]** Add empty state for missing editorial blocks

**Estimated Stories:** 2-3

---

## Flow 3: Product Tagging Flow

### `src/components/products/ProductForm.tsx`
**Purpose:** Form for creating/editing products with URL import and AI completion
**User Impact if Broken:** **HIGH** - Product management for designers
**Lines of Code:** ~834

#### Current State Assessment

| Category | Status | Notes |
|----------|--------|-------|
| ErrorBoundary | ❌ Missing | Form errors handled inline |
| Try/catch on async | ✅ Good | All API calls wrapped |
| User-friendly errors | ⚠️ Partial | Uses `alert()` in some places |
| Loading indicators | ✅ Good | Multiple loading states |
| Disabled during submit | ✅ Good | Submit disabled when loading |
| Client-side validation | ⚠️ Partial | Only name required check |
| Form typing | ✅ Good | `ProductFormData` interface |
| API responses typed | ⚠️ Partial | Some `any` in results |
| Accessibility | ⚠️ Partial | Labels present, no aria-describedby for errors |

#### Hardening Tasks (Ralph-eligible)

1. **[P1]** Replace `alert()` calls with toast notifications
2. **[P1]** Add comprehensive client-side validation with Zod
3. **[P2]** Add aria-describedby for error messages
4. **[P2]** Type API responses for import/AI endpoints
5. **[P3]** Add image preview error state with retry

**Estimated Stories:** 2

---

### Product Tagging in ProjectCreationModal
**Purpose:** Tag products to specific coordinates on project images
**User Impact if Broken:** **HIGH** - Core product discovery feature

#### Current State Assessment

| Category | Status | Notes |
|----------|--------|-------|
| Try/catch on async | ✅ Good | Product scraping wrapped |
| Error messages | ✅ Good | `scrapingError` state used |
| Loading states | ✅ Good | `isScrapingProduct` tracked |
| Pending product handling | ✅ Good | Visual indicator for pending tags |

#### Hardening Tasks (Ralph-eligible)

1. **[P2]** Add batch tag creation error recovery
2. **[P3]** Add tag position validation (prevent tags outside image bounds)

**Estimated Stories:** 1

---

## Flow 4: Publishing/Export Flow

### `src/components/instagram/InstagramExportModal.tsx`
**Purpose:** Export project to Instagram carousel with image reordering and captions
**User Impact if Broken:** **MEDIUM** - Secondary export feature
**Lines of Code:** ~668

#### Current State Assessment

| Category | Status | Notes |
|----------|--------|-------|
| ErrorBoundary | ❌ Missing | Complex export logic |
| Try/catch on async | ✅ Good | All exports wrapped |
| User-friendly errors | ⚠️ Partial | Uses `alert()` for errors |
| Loading indicators | ✅ Good | Multiple loading states |
| Progress feedback | ⚠️ Partial | Re-upload shows count, no per-image progress |
| Empty state | ✅ Good | "No images found" message |
| Image CDN handling | ✅ Good | Facebook CDN re-upload implemented |
| Disabled during submit | ✅ Good | Buttons disabled during operations |

#### Hardening Tasks (Ralph-eligible)

1. **[P1]** Replace `alert()` with toast notifications
2. **[P1]** Add ErrorBoundary wrapper
3. **[P2]** Add per-slide progress during batch download
4. **[P2]** Add retry individual slide option on failure
5. **[P3]** Add keyboard navigation for carousel preview

**Estimated Stories:** 2

---

## Flow 5: Designer Profile/Portfolio

### `src/components/profile/DesignerProfileShell.tsx`
**Purpose:** Route to appropriate profile state component based on designer setup
**User Impact if Broken:** **CRITICAL** - Public designer profile
**Lines of Code:** ~121

#### Current State Assessment

| Category | Status | Notes |
|----------|--------|-------|
| ErrorBoundary | ❌ Missing | Should wrap dynamic shell selection |
| State routing | ✅ Good | Comprehensive state handling |
| Fallback handling | ✅ Good | DefaultShell for unknown states |
| Type safety | ✅ Good | Uses proper interfaces |

#### Hardening Tasks (Ralph-eligible)

1. **[P0]** Wrap in ErrorBoundary with profile-specific fallback
2. **[P2]** Add loading state between shell transitions

**Estimated Stories:** 1

---

### `src/components/profile/states/EmptyProfileState.tsx`
**Purpose:** Empty state for designers without projects/brand
**User Impact if Broken:** **HIGH** - First-time designer experience
**Lines of Code:** ~135

#### Current State Assessment

| Category | Status | Notes |
|----------|--------|-------|
| Owner vs Public view | ✅ Good | Different states for owner |
| CTA buttons | ✅ Good | Clear next actions |
| Image handling | ⚠️ Partial | Uses SafeImage component |
| Type safety | ✅ Good | Proper Props type |
| Accessibility | ⚠️ Partial | Missing heading hierarchy audit |

#### Hardening Tasks (Ralph-eligible)

1. **[P3]** Add loading state for profile image
2. **[P3]** Audit heading hierarchy for screen readers

**Estimated Stories:** 0.5

---

### `src/components/designer/BrandSetupWizard.tsx`
**Purpose:** Wizard for setting up studio brand identity
**User Impact if Broken:** **MEDIUM** - Onboarding step (can be skipped)
**Lines of Code:** ~245

#### Current State Assessment

| Category | Status | Notes |
|----------|--------|-------|
| ErrorBoundary | ❌ Missing | Form submission can fail silently |
| Try/catch on async | ✅ Good | Server actions wrapped |
| User-friendly errors | ❌ Poor | Uses `alert()` for all errors |
| Loading indicators | ✅ Good | `isLoading` state |
| Client-side validation | ❌ Missing | No validation before submit |
| Type safety | ✅ Good | Props and form data typed |

#### Hardening Tasks (Ralph-eligible)

1. **[P1]** Replace `alert()` with inline error messages
2. **[P1]** Add client-side validation for URL fields
3. **[P2]** Add color format validation (hex pattern)
4. **[P3]** Add logo URL preview with error handling

**Estimated Stories:** 1-2

---

## Cross-Cutting Concerns

### Error Boundary Coverage

**Current State:** Only 2 ErrorBoundary components exist:
- `src/components/ImageErrorBoundary.tsx` - Image-specific
- `src/components/analytics/ErrorBoundary.tsx` - Analytics-specific

**Recommendation:** Create a generic `DesignerFlowErrorBoundary` component that:
1. Logs errors to analytics
2. Shows designer-friendly recovery UI
3. Offers retry and support contact options
4. Preserves draft data when possible

**Estimated Stories:** 1

---

### Type Safety Improvements

| Pattern | Occurrences | Fix |
|---------|-------------|-----|
| `any` in API responses | 15+ | Create typed API response helpers |
| `any` in form data | 8+ | Use Zod schemas |
| `any` in props | 6+ | Define proper interfaces |

**Estimated Stories:** 2

---

### Accessibility Gaps

| Issue | Components Affected | Fix |
|-------|---------------------|-----|
| Missing aria-live | All modals | Add announcements for loading/errors |
| Focus management | InterviewModal, ProjectCreationModal | Trap focus, manage on step change |
| Missing aria-describedby | All forms | Link errors to inputs |

**Estimated Stories:** 2

---

## Summary: All Hardening Tasks

### P0 - Critical (Must Fix)
1. Wrap ProjectCreationModal in ErrorBoundary
2. Wrap InterviewModal in ErrorBoundary
3. Wrap PostExpanded in ErrorBoundary
4. Wrap DesignerProfileShell in ErrorBoundary
5. Wrap InstagramExportModal in ErrorBoundary
6. Create generic DesignerFlowErrorBoundary component

### P1 - High Priority
7. ProjectCreationModal: Add upload progress indicator
8. ProjectCreationModal: Replace `any` types
9. ProjectCreationModal: Add inline validation feedback
10. InterviewModal: Add retry button for follow-ups
11. InterviewModal: Type API responses
12. PostExpanded: Type payload prop
13. PostExpanded: Add image error handling
14. ProductForm: Replace `alert()` with toasts
15. ProductForm: Add Zod validation
16. InstagramExportModal: Replace `alert()` with toasts
17. BrandSetupWizard: Replace `alert()` with inline errors
18. BrandSetupWizard: Add URL validation

### P2 - Medium Priority
19. ProjectCreationModal: Add skeleton loading
20. ProjectCreationModal: Add aria-live regions
21. InterviewModal: Add focus management
22. InterviewModal: Add skeleton for question cards
23. getOrCreateEditorialDraft: Add error codes
24. PostExpanded: Add loading skeleton
25. PostExpanded: Add empty state for missing blocks
26. ProductForm: Add aria-describedby
27. ProductForm: Type API responses
28. Product tagging: Add batch error recovery
29. InstagramExportModal: Add per-slide progress
30. InstagramExportModal: Add retry individual slide

### P3 - Low Priority
31. ProjectCreationModal: Improve error messages
32. InterviewModal: Add progress recovery prompt
33. getOrCreateEditorialDraft: Add retry logic
34. Product tagging: Add position validation
35. InstagramExportModal: Add keyboard navigation
36. EmptyProfileState: Add image loading state
37. EmptyProfileState: Audit heading hierarchy
38. BrandSetupWizard: Add color validation
39. BrandSetupWizard: Add logo preview error handling

---

## Recommended Sprint Plan

### Sprint 1: Error Boundaries (3-4 stories)
- Create generic DesignerFlowErrorBoundary
- Wrap all 5 critical components
- Add error logging to analytics

### Sprint 2: Form Validation & Feedback (4-5 stories)
- Replace all `alert()` calls with toast system
- Add Zod validation to forms
- Add inline validation feedback

### Sprint 3: Loading & Progress States (3-4 stories)
- Add upload progress indicators
- Add skeleton loading states
- Add per-operation progress feedback

### Sprint 4: Type Safety & Accessibility (4-5 stories)
- Replace `any` types throughout
- Add aria-live regions
- Add focus management to modals

---

## Appendix: Component Dependencies

```
ProjectCreationModal
├── GlassInput
├── NextImage
└── framer-motion

InterviewModal
├── Dialog (headlessui)
├── PromptPicker
├── AnswerForm
├── FollowUpsForm
├── FooterBar
├── TagPreview
├── QuestionCard
└── ProgressIndicator

PostExpanded
├── CinematicHero
├── DesignerSignature
├── ProductGrid
├── MotionPullQuote
├── RelatedProjects
├── ScrollSyncPanel
├── FeatureDiptych
├── ChapterGallery
└── MaterialPair

InstagramExportModal
├── Dialog (headlessui)
├── ImageReorderGrid
├── QuoteSelector
├── CarouselPreview
└── ExportButton

DesignerProfileShell
├── MinimalShell
├── EditorialShell
├── WarmShell
├── MoodyShell
├── BoldShell
├── DefaultShell
├── EmptyProfileState
├── BrandOnlyProfileState
└── ProjectsOnlyProfileState
```

---

*Report generated by Claude Code audit session*

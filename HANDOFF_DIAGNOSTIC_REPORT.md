# Handoff-to-Designer UX Diagnostic Report

## Executive Summary
The handoff-to-designer UX is **NOT visible** on `/vendor/create-project` because the page renders a **legacy project creation form** instead of the expected handoff composer components. The handoff system exists but is not integrated into the create project page.

---

## 1) Page Wiring — /vendor/create-project

### Which component renders?
**Legacy VendorProjectCreator form** - NOT handoff composer components

### Exact import lines:
- **File**: `src/app/vendor/create-project/page.tsx` (lines 1-354)
- **No imports** of handoff components (RecipientEmailCard, ProductPickerCard, QuoteAndDeliveryCard)
- **No imports** of VendorProjectCreator component
- **No conditional rendering** between handoff vs legacy UI

### Exact conditional(s) controlling which UI shows:
**NONE FOUND** - The page renders a hardcoded legacy form with no feature flag checks or conditional rendering for handoff components.

### Conclusion: Why the handoff UI is or isn't rendering
The handoff UI is **NOT rendering** because:
1. The page contains a hardcoded legacy project creation form
2. No handoff components are imported or rendered
3. No feature flags control the UI selection
4. The handoff system exists separately but is not integrated into this page

---

## 2) Feature Flags & Environment

### Where flags are defined/read:
- **File**: `src/lib/features.ts` (lines 1-9)
- **Flags defined**:
  ```typescript
  export const features = {
    vendorHandoff: process.env.FEATURE_VENDOR_HANDOFF === '1',
    vendorVisits: process.env.FEATURE_VENDOR_VISITS === '1',
    vendorQuotesVersions: process.env.FEATURE_VENDOR_QUOTES_VERSIONS === '1',
    vendorQuickActions: process.env.FEATURE_VENDOR_QUICK_ACTIONS === '1',
    vendorDashboardV2: process.env.FEATURE_VENDOR_DASHBOARD_V2 === '1',
  } as const;
  ```

### Current default behavior if env is missing:
**All flags default to `false`** when environment variables are not set.

### Which flags gate the handoff UI:
- `FEATURE_VENDOR_HANDOFF` - Controls handoff functionality
- `FEATURE_VENDOR_VISITS` - Controls visit creation (used in dashboard-v2)

### Current evaluated values at runtime:
**UNKNOWN** - No feature flag checks found in the create-project page.

### Actionable note:
- Set `FEATURE_VENDOR_HANDOFF=1` in environment
- Set `FEATURE_VENDOR_VISITS=1` in environment  
- Flags are read server-side and client-side via `src/lib/features.ts`

---

## 3) Permissions / Session Conditions

### Files where vendor role is checked:
- **File**: `src/app/vendor/create-project/page.tsx` (lines 78-90)
- **Code**:
  ```typescript
  if (session.user.role !== 'VENDOR') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Only vendors can create projects</p>
          <p className="text-sm text-gray-500 mt-2">
            Current role: {session.user.role}
          </p>
        </div>
      </div>
    );
  }
  ```

### Role detection mismatch:
**NONE FOUND** - Role checking is consistent between server and client.

### Early return/redirect that would hide UI:
**YES** - Lines 78-90 show early return if user role is not 'VENDOR', but this is correct behavior.

---

## 4) API Health — Handoff Endpoints

### Confirm presence + export of endpoints:

#### ✅ POST /api/vendor/visits
- **File**: `src/app/api/vendor/visits/route.ts`
- **Exported HTTP methods**: `POST`
- **Notable guards**: 
  - Authentication check (line 12-15)
  - Vendor role check via `canVendorCreateHandoff()` (line 30-32)
  - Handoff flow detection (line 28)

#### ✅ GET /api/visit-tokens/[token]
- **File**: `src/app/api/visit-tokens/[token]/route.ts`
- **Exported HTTP methods**: `GET`
- **Notable guards**:
  - Session check (line 11)
  - Visit expiration check (line 27-29)
  - Handoff package detection (line 37)

#### ✅ POST /api/visit-tokens/[token]/choose-destination
- **File**: `src/app/api/visit-tokens/[token]/choose-destination/route.ts`
- **Exported HTTP methods**: `POST`
- **Notable guards**:
  - Authentication check (line 12-15)
  - Visit validation (line 20-34)
  - Designer claim permission check (line 37-39)

### Note any missing/renamed path:
**NONE** - All expected endpoints exist and are properly exported.

---

## 5) Routing Conflicts

### Sibling dynamic routes that collide:
**NONE FOUND** - No routing conflicts detected.

### Token-based route location:
**CORRECT** - Public token routes are properly located under `api/visit-tokens/` (not `api/vendor/visits/`).

### Conflicts found:
**NONE** - Routing structure is clean and properly organized.

---

## 6) UI Visibility Kill-Switches

### Feature flag patterns:
**NONE FOUND** in the create-project page.

### CSS/class conditions that hide content:
**NONE FOUND** - No conditional CSS classes or display:none patterns.

### Suspense/conditional trees that short-circuit:
**NONE FOUND** - No conditional rendering boundaries that would skip handoff components.

### Dashboard feature flag usage:
- **File**: `src/app/vendor/dashboard-v2/page.tsx` (line 119-121)
- **Code**:
  ```typescript
  {features.vendorVisits && (
    <VendorVisitCreator vendorId={user?.id || ''} />
  )}
  ```

---

## 7) Final Diagnosis — Why Handoff Isn't Visible

### Root cause(s) ranked by likelihood:

1. **PRIMARY CAUSE**: The `/vendor/create-project` page renders a **hardcoded legacy form** instead of handoff components
   - **File**: `src/app/vendor/create-project/page.tsx`
   - **Issue**: No handoff components imported or rendered
   - **Impact**: Users see legacy project creation form, not handoff composer

2. **SECONDARY CAUSE**: Missing feature flag integration
   - **File**: `src/app/vendor/create-project/page.tsx`
   - **Issue**: No `features.vendorHandoff` checks
   - **Impact**: Handoff UI never gets conditionally rendered

3. **TERTIARY CAUSE**: Handoff components don't exist
   - **Search Results**: No RecipientEmailCard, ProductPickerCard, QuoteAndDeliveryCard components found
   - **Impact**: Even if integrated, components would be missing

---

## 8) Quick Fix Plan (Non-destructive)

### 3–5 precise steps to make handoff UI appear:

1. **Set environment variables**:
   ```bash
   FEATURE_VENDOR_HANDOFF=1
   FEATURE_VENDOR_VISITS=1
   ```

2. **Create missing handoff components**:
   - Create `src/components/vendor/handoff/RecipientEmailCard.tsx`
   - Create `src/components/vendor/handoff/ProductPickerCard.tsx`
   - Create `src/components/vendor/handoff/QuoteAndDeliveryCard.tsx`

3. **Integrate handoff components into create-project page**:
   - Import handoff components in `src/app/vendor/create-project/page.tsx`
   - Add feature flag check: `{features.vendorHandoff && <HandoffComposer />}`
   - Add conditional rendering to show handoff UI when flag is enabled

4. **Create handoff composer wrapper**:
   - Create `src/components/vendor/handoff/HandoffComposer.tsx`
   - Include RecipientEmailCard, ProductPickerCard, QuoteAndDeliveryCard
   - Handle form submission to `/api/vendor/visits`

5. **Test the integration**:
   - Restart development server after setting environment variables
   - Navigate to `/vendor/create-project`
   - Verify handoff UI appears instead of legacy form

---

## Additional Findings

### Existing Handoff Infrastructure:
- ✅ API endpoints are properly implemented
- ✅ Database schema supports handoff packages
- ✅ Permissions system is in place
- ✅ Visit token system is functional

### Missing Components:
- ❌ Handoff UI components (RecipientEmailCard, ProductPickerCard, QuoteAndDeliveryCard)
- ❌ Feature flag integration in create-project page
- ❌ Handoff composer wrapper component

### Working Examples:
- ✅ `VendorVisitCreator` component shows how to create visits
- ✅ Dashboard-v2 shows proper feature flag usage
- ✅ API endpoints demonstrate handoff flow

The handoff system is **architecturally complete** but **not integrated** into the create-project page UI.





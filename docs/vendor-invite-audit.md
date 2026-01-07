# Vendor Invite Capture Paths - Audit Report

## Phase 0 Audit Results

### A) Tagging Entry Points Identified

#### PRIMARY_TAGGING_PATH ✅
**File:** `src/app/api/tag-product-to-image/route.ts`
- **Route:** `POST /api/tag-product-to-image`
- **Usage:** Main path for designers tagging products to project images
- **Current Status:** ✅ Already has `captureVendorInviteCandidate()` hook
- **Vendor Info Sources:**
  - `vendorResolution.vendorName` (from `resolveOrCreateShadowVendor()`)
  - `repEmail` from request body
  - `tag.product.url` (extracted as vendorWebsite)
- **Used in Demos:** YES - This is the canonical tagging flow

#### SECONDARY_PATHS_TO_HARDEN

1. **Selection Creation (Generic)**
   - **File:** `src/app/api/selections/route.ts`
   - **Route:** `POST /api/selections`
   - **Vendor Info:** `vendorName` from body
   - **Current Status:** ❌ NO capture logic
   - **Action Required:** Add capture hook

2. **Designer Project Selections**
   - **File:** `src/app/api/designer/projects/[id]/selections/route.ts`
   - **Route:** `POST /api/designer/projects/[id]/selections`
   - **Vendor Info:** May include vendorName
   - **Current Status:** ❌ NO capture logic
   - **Action Required:** Add capture hook

3. **Vendor Project Selections**
   - **File:** `src/app/api/vendor/projects/[id]/selections/route.ts`
   - **Route:** `POST /api/vendor/projects/[id]/selections`
   - **Vendor Info:** Vendor attribution via vendorRepId
   - **Current Status:** ❌ NO capture logic (but vendor already exists)
   - **Action Required:** Skip (vendor already onboarded)

4. **Room Selections**
   - **File:** `src/app/api/projects/[id]/rooms/[roomId]/selections/route.ts`
   - **Route:** `POST /api/projects/[id]/rooms/[roomId]/selections`
   - **Vendor Info:** May include vendorName
   - **Current Status:** ❌ NO capture logic
   - **Action Required:** Add capture hook

### B) Current Persistence + Overwrite Risk

#### Current Implementation
**File:** `src/lib/vendor/inviteCandidates.ts`

**Overwrite Risk Identified:**
- **Line 68-70:** In `captureVendorInviteCandidate()`, the `update` block DOES overwrite:
  ```typescript
  update: {
    ...(repEmail && { repEmail: repEmail.trim().toLowerCase() }), // ⚠️ OVERWRITES
    ...(repName && { repName: repName.trim() }), // ⚠️ OVERWRITES
  }
  ```
- **Problem:** If Designer A tags with repEmail1, then Designer B tags with repEmail2, repEmail1 is lost.

#### Current Schema
- `VendorInviteCandidate.repEmail` - Single field (overwritable)
- `VendorInviteCandidate.repName` - Single field (overwritable)
- No separate contact model

## Implementation Plan

### Phase 1: Add VendorInviteContact Model
- Create new model for multi-contact support
- Migrate existing repEmail/repName to contacts
- Add domain extraction

### Phase 2: Update Capture Logic
- Rename/refactor to `captureVendorInviteData()`
- Store contacts as separate rows (no overwrites)
- Extract and store domains

### Phase 3: Update All Paths
- PRIMARY: Already hooked ✅
- SECONDARY: Add hooks to selection creation endpoints

### Phase 4: Admin API & UI
- Add contact aggregates
- Show multi-contact vendors
- Blitz pack generation









# Vendor Signal-Based Affiliate Spend System - Phase 1 Implementation

**Date:** 2025-01-27  
**Status:** ✅ COMPLETE  
**Version:** v1 - Intent Spend Engine (Save + Click only)

---

## Summary

Phase 1 of the vendor-controlled, signal-based affiliate spend system has been implemented. This system allows vendors to allocate capped budgets to designer-generated intent signals (saves and clicks) for active collaborations, without checkout or SKU-level attribution.

---

## What Was Implemented

### Step A: Schema Changes ✅

#### 1. CollaborationStatus Enum
- Added `CollaborationStatus` enum: `PENDING | ACTIVE | PAUSED | ENDED`
- Location: `prisma/schema.prisma`

#### 2. ProjectParticipant Extensions
- Added collaboration spend fields:
  - `collaborationStatus: CollaborationStatus @default(PENDING)`
  - `spendEnabled: Boolean @default(false)`
  - `spendPerSaveUsd: Float?`
  - `spendPerClickUsd: Float?`
  - `budgetCapUsd: Float?`
  - `activatedAt: DateTime?`
  - `pausedAt: DateTime?`
- Added index on `(side, collaborationStatus, spendEnabled)`
- Added relation to `ContextSignal[]`

#### 3. ContextSignal Extensions
- Added collaboration attribution fields:
  - `collaborationParticipantId: String?` (FK → ProjectParticipant.id)
  - `verified: Boolean @default(true)` (v1: true for authenticated users)
  - `valueUsd: Float?` (immutable spend value at creation time)
- Added indexes:
  - `(vendorId, projectId, action, createdAt)`
  - `(collaborationParticipantId, createdAt)`

#### 4. VendorDiscoveryBudget Model
- New model for monthly budget tracking:
  - `orgId: String` (keyed by Organization, not Vendor)
  - `periodStart: DateTime` (first day of month UTC)
  - `periodEnd: DateTime` (last day of month UTC)
  - `budgetCapUsd: Float`
  - `spentUsd: Float @default(0)`
  - `status: BudgetStatus` (ACTIVE | CAPPED | PAUSED)
- Unique constraint on `(orgId, periodStart)`

### Step B: Signal Attribution & Spend Calculation ✅

#### 1. Collaboration Resolution (`src/lib/spend/resolveCollaboration.ts`)
- `resolveCollaboration(vendorOrgId, projectId)` - Finds active collaboration participant
- Returns participant with spend settings if:
  - `side == VENDOR`
  - `collaborationStatus == ACTIVE`
  - `spendEnabled == true`

#### 2. Signal Pricing (`src/lib/spend/priceSignal.ts`)
- `priceSignal(action, participantId, vendorOrgId)` - Calculates spend value
- Checks:
  - Collaboration is active and spend enabled
  - Price configured for signal type
  - Monthly budget availability
  - Clamps to remaining budget if needed

#### 3. Spend Application (`src/lib/spend/applySignalSpend.ts`)
- `applySignalSpend(action, vendorId, projectId, userId)` - Main hook
- Applies rate limiting (100 signals/hour per user+action+project)
- Resolves collaboration
- Calculates spend value
- Updates monthly budget
- Returns `{ collaborationParticipantId, valueUsd, budgetCapped }`

#### 4. Signal Creation Hook (`src/lib/telemetry/context-signal.ts`)
- Updated `logSignal()` to automatically apply spend for save/click signals
- For authenticated users with `action === 'save' | 'add_to_project' | 'click'`:
  - Calls `applySignalSpend()`
  - Sets `collaborationParticipantId`, `valueUsd`, `verified` on ContextSignal

### Step C: Vendor Dashboard ✅

#### 1. API Endpoints

**GET `/api/vendor/collaborations`**
- Returns list of collaborations for vendor org
- Includes signal counts (saves, clicks), spend, budget usage for current month
- Includes monthly budget summary

**PATCH `/api/vendor/collaborations/[participantId]/spend`**
- Updates spend settings:
  - `spendEnabled`
  - `spendPerSaveUsd`
  - `spendPerClickUsd`
  - `budgetCapUsd`
  - `collaborationStatus`
- Validates vendor ownership
- Updates lifecycle timestamps

#### 2. UI Components

**CollaborationsTable** (`src/components/vendor/CollaborationsTable.tsx`)
- Table showing:
  - Project name
  - Designer name
  - Status badge
  - Signal counts (saves, clicks)
  - Monthly spend
  - Budget cap
  - Budget usage % (with progress bar)
  - Last signal date
  - Actions (Edit, Pause/Resume)
- Edit modal for spend settings
- Integrated into vendor dashboard

### Step D: Guardrails ✅

#### 1. Rate Limiting
- Applied to signal creation: 100 signals/hour per `(userId, action, projectId)`
- Prevents signal gaming/abuse
- Returns 0 spend if rate limit exceeded (doesn't fail signal creation)

#### 2. Permission Checks
- API endpoints validate vendor organization membership
- Only vendor org members can edit spend settings
- Collaborations must belong to vendor org

#### 3. Authentication
- Only authenticated users generate paid signals
- `verified: true` for authenticated users (v1)

---

## Files Modified

### Schema
- `prisma/schema.prisma` - Added enum, extended models, created new model

### Utilities
- `src/lib/spend/resolveCollaboration.ts` - NEW
- `src/lib/spend/priceSignal.ts` - NEW
- `src/lib/spend/applySignalSpend.ts` - NEW
- `src/lib/telemetry/context-signal.ts` - MODIFIED

### API Routes
- `src/app/api/vendor/collaborations/route.ts` - NEW
- `src/app/api/vendor/collaborations/[participantId]/spend/route.ts` - NEW

### UI Components
- `src/components/vendor/CollaborationsTable.tsx` - NEW
- `src/app/vendor/dashboard/VendorDashboardClient.tsx` - MODIFIED
- `src/app/vendor/dashboard/page.tsx` - MODIFIED

---

## Files Created

1. `src/lib/spend/resolveCollaboration.ts`
2. `src/lib/spend/priceSignal.ts`
3. `src/lib/spend/applySignalSpend.ts`
4. `src/app/api/vendor/collaborations/route.ts`
5. `src/app/api/vendor/collaborations/[participantId]/spend/route.ts`
6. `src/components/vendor/CollaborationsTable.tsx`

---

## How to Test End-to-End

### Prerequisites
1. Run Prisma migration:
   ```bash
   npx prisma migrate dev --name add_intent_spend_engine_v1
   ```
2. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

### Test Flow

#### 1. Create Collaboration
- As a vendor, create or join a project (creates `ProjectParticipant` with `side=VENDOR`)
- Or manually create via database/API

#### 2. Activate Collaboration & Set Spend
- Navigate to `/vendor/dashboard`
- Find the collaboration in the "Discovery Budget Collaborations" table
- Click "Edit" button
- Set:
  - `spendEnabled: true`
  - `spendPerSaveUsd: 0.50` (example: $0.50 per save)
  - `spendPerClickUsd: 0.10` (example: $0.10 per click)
  - `budgetCapUsd: 100.00` (example: $100 monthly cap)
  - `collaborationStatus: ACTIVE`
- Click "Save"

#### 3. Trigger Save Signal
- As a designer, save a product to the project:
  - Navigate to a product page
  - Click "Save to Project"
  - Select the project
- This creates a `ContextSignal` with `action: 'add_to_project'`
- Spend is automatically calculated and applied

#### 4. Verify Dashboard Updates
- Return to `/vendor/dashboard`
- Check "Discovery Budget Collaborations" table:
  - Saves count should increment
  - Spend (month) should show $0.50
  - Budget usage % should show 0.5%
  - Last Signal should show today's date

#### 5. Trigger Click Signal
- **Note:** Click tracking needs to be implemented separately
- For now, you can manually create a `ContextSignal` with `action: 'click'`:
  ```typescript
  await prisma.contextSignal.create({
    data: {
      userId: designerUserId,
      vendorId: vendorId,
      productId: productId,
      projectId: projectId,
      action: 'click',
      collaborationParticipantId: participantId,
      // ... spend will be calculated automatically
    },
  });
  ```

#### 6. Test Budget Cap
- Trigger multiple saves/clicks until budget is exhausted
- Verify:
  - Spend stops incrementing when cap is reached
  - Budget status changes to `CAPPED`
  - Future signals return `valueUsd: 0`

#### 7. Test Pause/Resume
- In dashboard, click "Pause" button on active collaboration
- Verify:
  - Status changes to `PAUSED`
  - New signals return `valueUsd: 0`
- Click "Resume" button
- Verify:
  - Status changes to `ACTIVE`
  - New signals are counted again

---

## Key Design Decisions

### 1. Organization vs Vendor Model
- **Spend settings** live on `ProjectParticipant` (collaboration-specific)
- **Monthly budget** lives on `VendorDiscoveryBudget` keyed by `Organization` (since reps are org-scoped)
- This avoids "which vendor is this?" ambiguity and permissions bugs

### 2. Save + Click Only (v1)
- Like/view signals not implemented (no individual event tables, fraud risk)
- Can be added in Phase 2+ with proper tracking

### 3. Monthly Budget Period
- Budgets are month-scoped (periodStart = first day of month UTC)
- New budget record created automatically on first spend
- Budget cap can be set per-collaboration or use org default

### 4. Rate Limiting
- 100 signals/hour per `(userId, action, projectId)` - generous to avoid false positives
- Returns 0 spend if exceeded (doesn't fail signal creation)
- Can be tightened in production

### 5. Immutable Accounting
- `valueUsd` stored on `ContextSignal` at creation time
- Cannot be retroactively changed
- Enables audit trail and reconciliation

---

## Known Limitations (v1)

1. **Click Tracking:** Clicks need separate implementation (currently only saves are tracked via existing endpoints)
2. **Budget Creation:** First signal creates budget with default cap (should be configurable)
3. **Like/View Signals:** Not implemented (requires individual event tables)
4. **Payment Integration:** No payment processing (budgets are manually set)
5. **Designer Credibility Weighting:** Not implemented (all designers treated equally)
6. **Diminishing Returns:** Not implemented (no decay for repeated signals)

---

## Next Steps (Phase 2+)

1. Implement click tracking endpoint
2. Add designer credibility weighting
3. Add diminishing returns logic
4. Payment integration (Stripe/PayPal)
5. Advanced analytics (efficiency metrics, ROI)
6. Like/view signal tracking (if individual event tables are added)

---

## Migration Command

```bash
npx prisma migrate dev --name add_intent_spend_engine_v1
```

This will create the migration for:
- `CollaborationStatus` enum
- `ProjectParticipant` extensions
- `ContextSignal` extensions
- `VendorDiscoveryBudget` model
- `BudgetStatus` enum
- All indexes and relations

---

## End of Implementation Summary









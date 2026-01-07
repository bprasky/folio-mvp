# VENDOR SIGNAL-BASED AFFILIATE SPEND SYSTEM - ARCHITECTURE AUDIT

**Date:** 2025-01-27  
**Mode:** AUDIT ONLY — No Implementation  
**Goal:** Identify integration points for vendor-controlled, signal-priced collaboration model

---

## EXECUTIVE SUMMARY

The Folio codebase has **strong foundational infrastructure** for implementing a signal-based affiliate spend system. Key findings:

- ✅ **Signal tracking infrastructure exists** (EngagementEvent, ContextSignal, clicks, saves, views)
- ✅ **Collaboration structure exists** (ProjectParticipant, PendingRepInvite, Organization relationships)
- ✅ **Vendor dashboard framework exists** with analytics components
- ⚠️ **No monetization/billing layer** — requires new models
- ⚠️ **Signals are user-bound but not collaboration-gated** — requires verification layer
- ⚠️ **No budget/spend tracking** — requires new models

**Implementation Readiness:** 70% — Core infrastructure ready, monetization layer needed

---

## 1. DATA MODEL AUDIT

### 1.1 Vendor Models

#### `Vendor` Model
- **Location:** `prisma/schema.prisma:1180-1206`
- **Purpose:** Core vendor entity (separate from User)
- **Key Fields:**
  - `id`, `name`, `website`, `logoUrl`, `primaryEmail`
  - `userId` (optional link to User account)
- **Relationships:**
  - `products` → Product[]
  - `atelierFingerprints`, `atelierSignals`
  - `eventVendorEdges` → EventVendorEdge[]
- **Extension Viability:** ✅ **YES**
  - Can add budget/spend fields directly
  - Can add collaboration settings

#### `User` Model (Vendor Role)
- **Location:** `prisma/schema.prisma:11-87`
- **Purpose:** Unified user model (designers, vendors, reps)
- **Key Fields:**
  - `role: Role` (includes VENDOR)
  - `vendorOrganizationId` (for vendor reps)
  - `isVendorRep: Boolean`
- **Extension Viability:** ⚠️ **RISKY**
  - User model is already large
  - Better to extend Vendor model or create VendorSettings

#### `Organization` Model
- **Location:** `prisma/schema.prisma:482-499`
- **Purpose:** Vendor organizations (and design firms)
- **Key Fields:**
  - `type: OrgType` (includes VENDOR)
  - `name`, `description`, `website`, `logo`
- **Relationships:**
  - `vendorProjects` → Project[]
  - `vendorReps` → User[]
  - `pendingRepInvites` → PendingRepInvite[]
- **Extension Viability:** ✅ **YES**
  - Can add budget/spend settings at org level

### 1.2 Designer Models

#### `User` Model (Designer Role)
- **Location:** `prisma/schema.prisma:11-87`
- **Purpose:** Designer accounts
- **Key Fields:**
  - `role: Role` (includes DESIGNER)
  - `designerProjects` → Project[]
  - `designerActivityProfile` → DesignerActivityProfile?
- **Extension Viability:** ✅ **YES**
  - Can track designer credibility/weighting for merit-based signals

### 1.3 Collaboration Models

#### `ProjectParticipant` Model
- **Location:** `prisma/schema.prisma:923-938`
- **Purpose:** Links designers and vendors to projects
- **Key Fields:**
  - `projectId`, `orgId?`, `userId?`
  - `side: ParticipantSide` (DESIGNER | VENDOR)
  - `role: ParticipantRole` (OWNER | EDITOR | VIEWER)
- **Extension Viability:** ✅ **YES**
  - **PRIMARY GATEKEEPER** for paid signal eligibility
  - Can add `status` enum: PENDING → ACTIVE → PAUSED
  - Can add `spendEnabled: Boolean`

#### `PendingRepInvite` Model
- **Location:** `prisma/schema.prisma:658-690`
- **Purpose:** Vendor rep invitations triggered by designer actions
- **Key Fields:**
  - `designerId?`, `projectId?`, `projectTagId?`
  - `vendorOrganizationId?`
  - `status: PendingRepInviteStatus` (PENDING | CLAIMED | CANCELLED)
- **Extension Viability:** ✅ **YES**
  - Can track "tag-first" vendor intros
  - Can link to collaboration creation

#### `OrganizationUser` Model
- **Location:** `prisma/schema.prisma:501-513`
- **Purpose:** User-organization membership
- **Key Fields:**
  - `userId`, `organizationId`
  - `role: OrgUserRole` (OWNER | ADMIN | MANAGER | MEMBER | VIEWER)
  - `isActive: Boolean`
- **Extension Viability:** ✅ **YES**
  - Can gate collaboration creation permissions

### 1.4 Signal Models

#### `EngagementEvent` Model
- **Location:** `prisma/schema.prisma:535-548`
- **Purpose:** Event-scoped engagement tracking
- **Key Fields:**
  - `userId`, `eventId`, `productId?`
  - `verb: String` (VIEW_EVENT, VIEW_PRODUCT, SAVE_PRODUCT, etc.)
  - `meta: Json?`
- **Extension Viability:** ⚠️ **RISKY**
  - Currently event-scoped (requires eventId)
  - Need to verify if signals can be collaboration-scoped
  - **Recommendation:** Extend or create CollaborationEngagementEvent

#### `ContextSignal` Model
- **Location:** `prisma/schema.prisma:1077-1094`
- **Purpose:** Predictive market layer signals
- **Key Fields:**
  - `userId?`, `vendorId?`, `productId?`, `projectId?`, `eventId?`
  - `action: String` ("view" | "save" | "add_to_project" | "rsvp" | "feature_click" | "search")
  - `tags: String[]`, `meta: Json?`
- **Extension Viability:** ✅ **YES**
  - Already vendor-aware (`vendorId`)
  - Already project-aware (`projectId`)
  - Can add `collaborationId?` to link to ProjectParticipant

#### `clicks` Model
- **Location:** `prisma/schema.prisma:578-586`
- **Purpose:** Event-scoped click tracking
- **Key Fields:**
  - `eventId`, `designerId?`, `target: String`, `meta: Json?`
- **Extension Viability:** ⚠️ **RISKY**
  - Event-scoped only
  - No product/vendor linkage
  - **Recommendation:** Create CollaborationClick model

#### `EventProductStat` Model
- **Location:** `prisma/schema.prisma:550-564`
- **Purpose:** Aggregated product stats per event
- **Key Fields:**
  - `eventId`, `productId`
  - `views: Int`, `saves: Int`
- **Extension Viability:** ⚠️ **RISKY**
  - Event-scoped only
  - **Recommendation:** Create CollaborationProductStat for collaboration-scoped aggregation

#### `Project` Model (Engagement Counters)
- **Location:** `prisma/schema.prisma:201-258`
- **Purpose:** Project-level engagement counters
- **Key Fields:**
  - `views: Int`, `saves: Int`, `shares: Int`
- **Extension Viability:** ❌ **NO**
  - These are aggregate counters, not individual signals
  - Cannot attribute to specific collaborations

### 1.5 Monetization Models

#### Current State: ❌ **NONE FOUND**
- No billing, credits, sponsorships, or payments logic
- No spend tracking
- No budget management

#### Required New Models:

1. **`VendorSpendBudget`** (NEW)
   - `vendorId`, `totalBudgetUsd`, `remainingBudgetUsd`
   - `spendPerClick`, `spendPerLike`, `spendPerSave`
   - `periodStart`, `periodEnd`

2. **`CollaborationSpend`** (NEW)
   - `collaborationId` (ProjectParticipant.id)
   - `signalType` (CLICK | LIKE | SAVE | VIEW)
   - `amountUsd`, `signalCount`
   - `periodStart`, `periodEnd`

3. **`SignalSpendTransaction`** (NEW)
   - `collaborationId`, `signalId` (EngagementEvent/ContextSignal.id)
   - `signalType`, `amountUsd`
   - `verifiedAt`, `status` (PENDING | VERIFIED | REJECTED)

---

## 2. SIGNAL PIPELINE AUDIT

### 2.1 Like Signals

#### Current Implementation:
- **Storage:** `Story.likes: Int` (aggregate counter only)
- **Attribution:** Story-level, not user-specific
- **Location:** `prisma/schema.prisma:394-412`
- **Status:** ❌ **NOT SUITABLE**
  - No individual like records
  - Cannot attribute to specific designers or collaborations

#### Recommendation:
- Create `StoryLike` model with `storyId`, `userId`, `createdAt`
- Or extend `EngagementEvent` to support story likes

### 2.2 Save Signals

#### Current Implementation:
- **Storage:** Multiple locations:
  1. `FolderProduct` (moodboard saves) — `prisma/schema.prisma:382-392`
  2. `Selection` (project saves) — `prisma/schema.prisma:436-467`
  3. `EngagementEvent` (event-scoped saves) — `prisma/schema.prisma:535-548`
  4. `ContextSignal` (predictive market saves) — `prisma/schema.prisma:1077-1094`
- **Attribution:**
  - `FolderProduct`: `folder.designerId` → User
  - `Selection`: `projectId` → Project → can find ProjectParticipant
  - `EngagementEvent`: `userId`, `productId`, `eventId`
  - `ContextSignal`: `userId`, `productId`, `projectId`, `vendorId`
- **Status:** ✅ **PARTIALLY SUITABLE**
  - `ContextSignal` is best candidate (has vendorId, projectId)
  - `Selection` can be linked via Project → ProjectParticipant

#### Signal Flow:
```
Designer saves product
  → ContextSignal created (action: "save" | "add_to_project")
  → Has vendorId, projectId, userId
  → Can query ProjectParticipant where projectId + vendorId match
  → Verify collaboration exists and is ACTIVE
  → Create SignalSpendTransaction
```

### 2.3 Click Signals

#### Current Implementation:
- **Storage:** `clicks` model — `prisma/schema.prisma:578-586`
- **Attribution:**
  - `eventId` (required)
  - `designerId?` (optional)
  - `target: String` (product URL, vendor URL, etc.)
- **Status:** ⚠️ **PARTIALLY SUITABLE**
  - Event-scoped only
  - No direct product/vendor linkage
  - `target` field may contain product/vendor info in meta

#### Signal Flow:
```
Designer clicks product/vendor link
  → clicks record created
  → Parse target/meta to extract productId/vendorId
  → Find ProjectParticipant via projectId (if available in meta)
  → Verify collaboration
  → Create SignalSpendTransaction
```

### 2.4 View Signals

#### Current Implementation:
- **Storage:**
  1. `impressions` model — `prisma/schema.prisma:614-621` (event-scoped)
  2. `Project.views: Int` (aggregate counter)
  3. `EventProductStat.views: Int` (aggregate counter)
- **Attribution:**
  - `impressions`: `eventId`, `designerId?`, `sessionId?`
  - No individual view records for products/projects
- **Status:** ❌ **NOT SUITABLE**
  - No product/project-specific view tracking
  - Only event-level impressions

#### Recommendation:
- Extend `ContextSignal` to track views (action: "view")
- Or create `ProductView` / `ProjectView` models

### 2.5 Signal Attribution Summary

| Signal Type | Storage Location | User-Bound? | Collaboration-Linkable? | Status |
|------------|------------------|-------------|-------------------------|--------|
| **Like** | Story.likes (counter) | ❌ No | ❌ No | ❌ Not suitable |
| **Save** | ContextSignal, Selection, FolderProduct | ✅ Yes | ✅ Yes (via projectId) | ✅ Suitable |
| **Click** | clicks | ⚠️ Partial | ⚠️ Partial (via meta) | ⚠️ Needs enhancement |
| **View** | impressions (event only) | ⚠️ Partial | ❌ No | ❌ Not suitable |

### 2.6 Signal Aggregation Layer

#### Current Implementation:
- `EventProductStat`: Aggregates views/saves per event+product
- `event_metrics`: Aggregates event-level metrics
- No collaboration-scoped aggregation

#### Recommendation:
- Create `CollaborationSignalAggregate` model
- Period-based aggregation (daily/weekly/monthly)
- Tracks: signal counts, spend amounts, efficiency metrics

---

## 3. COLLABORATION STRUCTURE AUDIT

### 3.1 Collaboration Representation

#### Primary Model: `ProjectParticipant`
- **Location:** `prisma/schema.prisma:923-938`
- **Purpose:** Links designers and vendors to projects
- **Current Fields:**
  - `side: ParticipantSide` (DESIGNER | VENDOR)
  - `role: ParticipantRole` (OWNER | EDITOR | VIEWER)
- **Status:** ✅ **CAN ACT AS GATEKEEPER**

#### Extension Path:
```prisma
model ProjectParticipant {
  // ... existing fields ...
  status CollaborationStatus @default(PENDING) // PENDING | ACTIVE | PAUSED | ENDED
  spendEnabled Boolean @default(false)
  spendPerClickUsd Float?
  spendPerLikeUsd Float?
  spendPerSaveUsd Float?
  spendPerViewUsd Float?
  budgetCapUsd Float?
  createdAt DateTime @default(now())
  activatedAt DateTime?
  pausedAt DateTime?
}
```

### 3.2 Collaboration Lifecycle

#### Current State:
- No explicit status enum
- Collaborations exist when `ProjectParticipant` record exists
- No activation/pause mechanism

#### Recommendation:
- Add `status` enum to `ProjectParticipant`
- Add lifecycle timestamps (`activatedAt`, `pausedAt`)
- Add vendor-controlled settings (`spendEnabled`, per-signal pricing)

### 3.3 Collaboration Discovery

#### Current Mechanisms:
1. **ProjectParticipant**: Direct project participation
2. **PendingRepInvite**: Tag-first vendor introductions
   - Triggered by designer tagging product
   - Links: `designerId`, `projectId`, `projectTagId`, `vendorOrganizationId`
3. **VendorPreviewToken**: Vendor preview access
   - Links: `vendorId`, `projectId`, `productId`

#### Status: ✅ **SUFFICIENT**
- Can trace collaboration origin
- Can link signals to collaboration via projectId + vendorId

---

## 4. VENDOR DASHBOARD AUDIT

### 4.1 Dashboard Entry Points

#### Routes:
1. **`/vendor/dashboard`** — `src/app/vendor/dashboard/page.tsx`
   - Main vendor dashboard
   - Shows projects, stats, analytics
2. **`/vendor/dashboard-v2`** — `src/app/vendor/dashboard-v2/page.tsx`
   - Alternative dashboard (client-side)
3. **`/vendor/analytics`** — `src/app/vendor/analytics/page.tsx`
   - Analytics-focused view
4. **`/vendor/page.tsx`** — `src/app/vendor/page.tsx`
   - Vendor profile page with tabs

#### Status: ✅ **MULTIPLE INSERTION POINTS AVAILABLE**

### 4.2 Dashboard Components

#### Existing Components:
1. **`VendorDashboardClient`** — `src/app/vendor/dashboard/VendorDashboardClient.tsx`
   - Main dashboard client component
   - Shows projects table, stats cards
2. **`VendorAnalyticsDashboard`** — `src/components/vendor/VendorAnalyticsDashboard.tsx`
   - Question-led analytics dashboard
   - Uses mock data currently
3. **`VendorAnalyticsHeatmap`**, `VendorAnalyticsTrending`, etc.
   - Various analytics visualization components

#### Status: ✅ **COMPONENT FRAMEWORK EXISTS**

### 4.3 Existing Tables/Charts

#### Current Tables:
- Projects table (in `VendorDashboardClient`)
  - Columns: name, status, designer, last activity, actions
- Product analytics table (`ProductAnalyticsTable`)
  - Shows: views, saves, clicks, saved_together

#### Current Stats Cards:
- Active projects
- Projects sent to designers
- Projects claimed by designers
- Open follow-ups

#### Status: ✅ **CAN EXTEND EXISTING TABLES**

### 4.4 Collaborations Table Insertion Point

#### Best Location:
**`/vendor/dashboard`** — Add new "Collaborations" tab or section

#### Recommended Structure:
```typescript
// New component: CollaborationsTable
interface CollaborationRow {
  designerName: string;
  projectName: string;
  status: 'pending' | 'active' | 'paused';
  signals: {
    likes: number;
    saves: number;
    clicks: number;
    views: number;
  };
  spendAllocated: number;
  budgetConsumed: number; // percentage
  efficiency: number; // signals per $
  lastSignalAt: Date;
}
```

#### Table Columns:
- Designer name
- Project name
- Status (badge)
- Signals (likes, saves, clicks, views)
- Spend allocated ($)
- Budget consumed (%)
- Efficiency (signals/$)
- Last signal
- Actions (pause/resume, adjust budget)

### 4.5 Dashboard Data Sources

#### Current API Endpoints:
- `/api/vendor/projects` — Get vendor projects
- `/api/vendor/analytics` — Get analytics data

#### Required New Endpoints:
- `/api/vendor/collaborations` — Get collaborations with signal/spend data
- `/api/vendor/collaborations/[id]/spend` — Update spend settings
- `/api/vendor/collaborations/[id]/status` — Update collaboration status

---

## 5. MONETIZATION & SAFETY AUDIT

### 5.1 Existing Billing/Payments Logic

#### Current State: ❌ **NONE FOUND**
- No billing models
- No payment processing
- No credits system
- No subscription tiers

#### Search Results:
- No Stripe/PayPal integration
- No billing API routes
- No payment models in schema

### 5.2 Existing Rate Limiting

#### Implementation:
- **Location:** `src/lib/rateLimit.ts`
- **Usage:**
  - Image generation: `src/app/api/projects/[id]/rooms/[roomId]/gen-image/route.ts`
  - Interview generation: `src/app/api/posting/project/[projectId]/interview/generate/route.ts`
  - Admin actions: `src/app/api/admin/*/route.ts`
- **Mechanism:**
  - User-scoped rate limiting
  - Scope-based (e.g., `userId:scope`)
  - Time-window based (e.g., 1 hour)

#### Status: ✅ **CAN BE APPLIED TO SIGNAL TRACKING**
- Can rate-limit signal creation per designer
- Can prevent signal gaming/abuse

### 5.3 Abuse Prevention Gaps

#### Current Gaps:
1. **No signal verification**
   - Signals are created immediately
   - No verification that signal is "real" (not bot/gaming)

2. **No designer credibility weighting**
   - All designers treated equally
   - No merit-based signal weighting

3. **No diminishing returns logic**
   - No cap on signals per designer per period
   - No decay for repeated signals

#### Recommendations:
1. **Signal Verification Layer:**
   - Add `verified: Boolean` to signal models
   - Verify signals meet criteria (e.g., user is authenticated, not bot)
   - Add verification timestamp

2. **Designer Credibility Weighting:**
   - Use `DesignerActivityProfile` (already exists)
   - Weight signals by designer's `proximityToPurchaseScore`, `lifecycleScore`
   - Apply multiplier to spend allocation

3. **Diminishing Returns:**
   - Cap signals per designer per collaboration per period
   - Apply decay factor for repeated signals (e.g., 0.9x for 2nd signal, 0.8x for 3rd)
   - Track in `CollaborationSignalAggregate`

### 5.4 Risk Assessment

#### High Risk Areas:
1. **Signal Gaming:**
   - Designers could create fake accounts to generate signals
   - **Mitigation:** Require verified accounts, rate limiting, credibility weighting

2. **Budget Exhaustion:**
   - Vendors could exhaust budget quickly if signals are expensive
   - **Mitigation:** Budget caps, spend alerts, automatic pausing

3. **Collaboration Abuse:**
   - Vendors could create fake collaborations to generate signals
   - **Mitigation:** Require project participation, verify collaboration legitimacy

#### Medium Risk Areas:
1. **Signal Attribution:**
   - Ambiguity in linking signals to collaborations
   - **Mitigation:** Clear attribution rules, audit trail

2. **Spend Calculation:**
   - Complex pricing (per-signal-type, per-collaboration)
   - **Mitigation:** Transparent calculation, transaction logging

---

## 6. IMPLEMENTATION READINESS VERDICT

### 6.1 What Can Be Implemented Immediately

#### ✅ Ready (No Schema Changes):
1. **Signal Tracking Enhancement:**
   - Extend `ContextSignal` to include `collaborationId`
   - Query existing signals and link to collaborations via projectId + vendorId

2. **Collaboration Status UI:**
   - Add status badges to existing projects table
   - Add collaboration management UI (pause/resume)

3. **Signal Aggregation Queries:**
   - Query signals per collaboration
   - Calculate spend amounts (using hardcoded pricing initially)

#### ✅ Ready (Minor Schema Changes):
1. **ProjectParticipant Extension:**
   - Add `status` enum, `spendEnabled`, per-signal pricing fields
   - Add lifecycle timestamps

2. **Signal Verification:**
   - Add `verified: Boolean` to `ContextSignal`, `EngagementEvent`
   - Add verification logic in signal creation endpoints

### 6.2 What Requires New Models

#### ⚠️ Requires New Models:
1. **Budget Management:**
   - `VendorSpendBudget` model
   - `CollaborationSpend` model
   - `SignalSpendTransaction` model

2. **Spend Tracking:**
   - Transaction logging
   - Budget reconciliation
   - Spend alerts

3. **Signal Aggregation:**
   - `CollaborationSignalAggregate` model (optional, can use queries)

### 6.3 What Should Be Deferred to Phase 2+

#### 🔄 Phase 2+ Features:
1. **Advanced Abuse Prevention:**
   - Designer credibility weighting
   - Diminishing returns logic
   - Bot detection

2. **Advanced Analytics:**
   - Efficiency metrics (signals per $)
   - ROI calculations
   - Predictive spend recommendations (already have `SpendRecommendation` model)

3. **Payment Integration:**
   - Stripe/PayPal integration
   - Automatic budget top-ups
   - Invoice generation

4. **Like/View Signal Tracking:**
   - Individual like records (currently only aggregate)
   - Product/project view tracking (currently only event impressions)

---

## 7. RECOMMENDED IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1-2)
1. Extend `ProjectParticipant` with status and spend settings
2. Add `collaborationId` to `ContextSignal`
3. Create signal verification layer
4. Build collaborations table in vendor dashboard

### Phase 2: Budget & Spend (Week 3-4)
1. Create `VendorSpendBudget`, `CollaborationSpend`, `SignalSpendTransaction` models
2. Implement spend calculation logic
3. Add budget management UI
4. Implement budget caps and alerts

### Phase 3: Enhancement (Week 5-6)
1. Add designer credibility weighting
2. Implement diminishing returns
3. Add efficiency metrics
4. Build spend analytics dashboard

### Phase 4: Advanced Features (Week 7+)
1. Payment integration
2. Advanced abuse prevention
3. Predictive spend recommendations
4. Like/view signal tracking

---

## 8. KEY FINDINGS SUMMARY

### ✅ Strengths:
- Strong signal tracking infrastructure (`ContextSignal`, `EngagementEvent`)
- Collaboration structure exists (`ProjectParticipant`)
- Vendor dashboard framework ready
- Rate limiting infrastructure available

### ⚠️ Gaps:
- No monetization/billing layer
- Signals not collaboration-gated
- No budget/spend tracking
- Like/view signals not individually tracked

### 🎯 Primary Integration Points:
1. **`ProjectParticipant`** — Gatekeeper for paid signals
2. **`ContextSignal`** — Primary signal storage (vendor-aware, project-aware)
3. **`/vendor/dashboard`** — UI insertion point
4. **`src/lib/rateLimit.ts`** — Abuse prevention

### 📋 Required New Models:
1. `VendorSpendBudget`
2. `CollaborationSpend`
3. `SignalSpendTransaction`
4. `CollaborationSignalAggregate` (optional)

---

## END OF AUDIT

**Next Steps:**
1. Review and approve implementation phases
2. Design new models (if proceeding)
3. Create detailed implementation spec for Phase 1









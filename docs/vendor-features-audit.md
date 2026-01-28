# Vendor Features Audit

> Comprehensive audit of all vendor-related features in the Folio MVP codebase.
> Generated: 2026-01-28

---

## Table of Contents

1. [Prisma Schema & Data Models](#1-prisma-schema--data-models)
2. [API Routes](#2-api-routes)
3. [Vendor Dashboard & Analytics](#3-vendor-dashboard--analytics)
4. [Collaboration Features](#4-collaboration-features)
5. [Editorial & Content Features](#5-editorial--content-features)
6. [Product Features](#6-product-features)
7. [Event Features](#7-event-features)
8. [Notifications & Signals](#8-notifications--signals)
9. [Feature Completeness Matrix](#9-feature-completeness-matrix)

---

## 1. Prisma Schema & Data Models

**Schema file:** `prisma/schema.prisma`

### Core Vendor Models

| Model | Lines | Status | Description |
|-------|-------|--------|-------------|
| **Organization** | 596-690 | Complete | Core org model; `type` field uses `OrgType` enum (VENDOR, DESIGN_FIRM, MANUFACTURER, SHOWROOM, etc.). Includes `vendorTier`, `status` (UNCLAIMED/CLAIMED/PROFESSIONAL), profile fields, and verification. |
| **VendorSubscription** | 1940-1972 | Complete | SaaS billing model. Tiers: STARTER, GROWTH, PROFESSIONAL, ENTERPRISE. Stripe integration fields, SKU/rep-seat limits, affiliate fee (default 18%), trial/billing period tracking. |
| **VendorTradeAccount** | 2223-2278 | Complete | Vendor trade credential management. Account types: LOGIN, QUOTE, REP, API. Dual-write encryption migration (plaintext to AES-256-GCM). Discount/payment terms, rep info, verification status. |
| **VendorVisit** | 1019-1034 | Complete | Designer handoff token system. Unique access tokens, expiry dates, links to projects. |
| **VendorInviteSignal** | 3189-3202 | Complete | Tracks mentions of vendors not yet on platform. Signal types: TESTIMONIAL_AVAILABLE, PRODUCT_TAG. Used for vendor recruitment outreach. |
| **VendorRepContact** | 3260-3297 | Complete | Designer's personal vendor rep directory. One rep per vendor per designer. Tracks trade account info, contact preferences, last contacted date. |
| **VendorContentOpportunity** | 3723-3757 | Complete | Auto-generated monetization opportunities based on engagement metrics (likes, saves, designer tags). Status pipeline: available -> in_progress -> published -> expired. 7-day expiration. |
| **OrgVendorPartnership** | 3462-3479 | Complete | Design firm <-> vendor partnership management. Status: PENDING, CONFIRMED, DECLINED. Unique constraint per firm-vendor pair. |

### Boost & Monetization Models

| Model | Lines | Status | Description |
|-------|-------|--------|-------------|
| **BoostOpportunity** | 3108-3145 | Complete | Vendor opportunity to boost designer testimonials. Includes full answer text, suggested pull quote, product IDs, sentiment analysis. Status: PENDING -> NOTIFIED -> VIEWED -> BOOSTED/DECLINED/EXPIRED. 14-day expiration. |
| **Boost** | 3147-3185 | Complete | Executed boost record. Display options: showInArticle, showOnVendorPage, showInFeed. Billing tiers: included, premium, featured. Tracks impressions and clicks. |
| **ShopBoost** | 4020-4044 | Complete | Vendor boost of designer shop products. Revenue split: 70% designer credit, 30% Folio revenue. Status: PENDING -> APPROVED -> ACTIVE -> DECLINED/EXPIRED/CANCELLED. |

### Models with Vendor Foreign Keys

| Model | Vendor Fields | Status | Description |
|-------|---------------|--------|-------------|
| **User** | vendorVisibility, vendorVisibilityEnabledAt | Complete | Controls whether vendors can see designer specifications. Relations to vendor quotes, selections, products, boosts. |
| **Product** | vendorId (FK to User) | Complete | Vendor product linking. Relations to content opportunities, shop products, testimonials. |
| **Selection** | vendorName, vendorRepId | Complete | Designer's product selection with vendor/rep assignment. |
| **Quote** | vendorRepId | Complete | Quote from vendor rep to designer. |
| **Order** | vendorOrgId, tradeAccountId, attributedRepId | Complete | Commerce model linking designer orders to vendor org and trade accounts. Financial split: repCreditCents. |
| **QuoteAttachment** | vendorId | Complete | Quote file storage linked to vendor. |
| **HandoffPackage** | vendorId | Complete | Lightweight staging for vendor handoff with items JSON. |
| **CollaborationStory** | vendorOrgId | Complete | Dual-interview collaboration between vendor and designer. Vendor rounds 1-3 JSON storage. |
| **ContextSignal** | vendorId | Complete | Analytics signal tracking. Actions: view, save, add_to_project, click. |
| **SpendRecommendation** | vendorId | Complete | AI-generated spend recommendations per vendor by scope (event, product, category). |
| **AtelierFingerprint** | vendorId | Complete | Vendor aesthetic fingerprinting with completeness scores and snapshot data. |
| **AtelierSignal** | vendorId | Complete | Vendor aesthetic signal tracking for fingerprint computation. |
| **DirectoryRanking** | vendorOrgId | Complete | Merit-based vendor directory ranking. Scores: designerTags, taggedProjects, vendorDiversity. |

### Vendor-Related Enums

| Enum | Values | Description |
|------|--------|-------------|
| **OrgType** | VENDOR, DESIGN_FIRM, MANUFACTURER, SHOWROOM, CONTRACTOR, ARCHITECTURE_FIRM, DEVELOPER | Organization type classification |
| **OrgStatus** | UNCLAIMED, CLAIMED, PROFESSIONAL | Verification/tier status |
| **VendorTier** | STARTER, GROWTH, PROFESSIONAL, ENTERPRISE | Subscription tier |
| **VendorSubscriptionStatus** | TRIALING, ACTIVE, PAST_DUE, CANCELED, PAUSED | Billing status |
| **TradeAccountType** | LOGIN, QUOTE, REP, API | Trade account access method |
| **BoostStatus** | PENDING, NOTIFIED, VIEWED, BOOSTED, DECLINED, EXPIRED | Boost opportunity lifecycle |
| **ShopBoostStatus** | PENDING, APPROVED, ACTIVE, DECLINED, EXPIRED, CANCELLED | Shop boost lifecycle |
| **PartnershipStatus** | PENDING, CONFIRMED, DECLINED | Vendor-firm partnership status |
| **ParticipantSide** | DESIGNER, VENDOR, ARCHITECT, BUILDER | Project participant role type |

**Total vendor-related models: 24** | **Vendor-specific enums: 9**

---

## 2. API Routes

### Core Vendor Project Routes

| Method | Path | File | Status | Description |
|--------|------|------|--------|-------------|
| GET/POST | `/api/vendor/projects` | `src/app/api/vendor/projects/route.ts` | Complete | List vendor projects with designer enrichment; create new projects with optional rooms |
| GET/PATCH | `/api/vendor/projects/[id]` | `src/app/api/vendor/projects/[id]/route.ts` | Complete | Fetch/update specific project. Note: missing access control validation |
| POST | `/api/vendor/projects/[id]/selections` | `src/app/api/vendor/projects/[id]/selections/route.ts` | Complete | Create selection (tagged product) with vendor attribution |
| GET/POST | `/api/vendor/projects/[id]/selections/bulk` | `src/app/api/vendor/projects/[id]/selections/bulk/route.ts` | Complete | Bulk operations on selections |
| GET | `/api/vendor/projects/[id]/rooms` | `src/app/api/vendor/projects/[id]/rooms/route.ts` | Complete | List rooms within a vendor project |
| GET | `/api/vendor/projects/[id]/visits` | `src/app/api/vendor/projects/[id]/visits/route.ts` | Complete | Track visits/handoffs for project |
| POST | `/api/vendor/projects/[id]/handoff` | `src/app/api/vendor/projects/[id]/handoff/route.ts` | Complete | Create handoff invitation to designer |

### Quick Actions

| Method | Path | File | Status | Description |
|--------|------|------|--------|-------------|
| POST | `/api/vendor/projects/[id]/quick-actions/invite-to-event` | `src/app/api/vendor/projects/[id]/quick-actions/invite-to-event/route.ts` | Complete | Send event invitation to designer; validates vendor access and event existence |
| POST | `/api/vendor/actions/confirm-spec` | `src/app/api/vendor/actions/confirm-spec/route.ts` | Complete | Confirm spec changes (low_stock, discontinued, alt_suggested) |
| POST | `/api/vendor/projects/[id]/quick-actions/offer-boost` | `src/app/api/vendor/projects/[id]/quick-actions/offer-boost/route.ts` | Listed | Offer boost to designer |
| POST | `/api/vendor/projects/[id]/quick-actions/extend-discount` | `src/app/api/vendor/projects/[id]/quick-actions/extend-discount/route.ts` | Listed | Extend discount to designer |
| POST | `/api/vendor/projects/[id]/quick-actions/request-missing` | `src/app/api/vendor/projects/[id]/quick-actions/request-missing/route.ts` | Listed | Request missing information |

### Visits & Handoffs

| Method | Path | File | Status | Description |
|--------|------|------|--------|-------------|
| GET/POST | `/api/vendor/visits` | `src/app/api/vendor/visits/route.ts` | Complete | Create VendorVisit with handoff package; list recent visits (5-50 per page) |
| POST | `/api/vendor/visits/[visitId]/attach-project` | `src/app/api/vendor/visits/[visitId]/attach-project/route.ts` | Listed | Attach project to existing visit |

### Analytics & Reporting

| Method | Path | File | Status | Description |
|--------|------|------|--------|-------------|
| GET | `/api/vendor/analytics` | `src/app/api/vendor/analytics/route.ts` | Complete | Comprehensive analytics: spec heatmap, trending products, designer influence, pipeline snapshot |
| GET | `/api/vendor/stats` | `src/app/api/vendor/stats/route.ts` | Complete | Simple visit stats (sent, opened, selected counts) |
| GET | `/api/vendor/shop-analytics` | `src/app/api/vendor/shop-analytics/route.ts` | Complete | Shop analytics with boost tracking; respects vendorVisibility privacy settings |
| GET | `/api/vendor/events/kpi` | `src/app/api/vendor/events/kpi/route.ts` | **Stub** | Event KPI data; returns placeholder null values |
| GET | `/api/vendor/qbr` | `src/app/api/vendor/qbr/route.ts` | **Partial** | Quarterly Business Review AI bundle; uses demo state |

### Boost Operations

| Method | Path | File | Status | Description |
|--------|------|------|--------|-------------|
| POST | `/api/vendor/boosts/[opportunityId]/boost` | `src/app/api/vendor/boosts/[opportunityId]/boost/route.ts` | Complete | Create boost from testimonial opportunity; validates vendor org ownership and tier |
| POST | `/api/vendor/boosts/[opportunityId]/decline` | `src/app/api/vendor/boosts/[opportunityId]/decline/route.ts` | Listed | Decline boost opportunity |
| GET | `/api/vendor-boost/inbox` | `src/app/api/vendor-boost/inbox/route.ts` | Complete | Designer inbox for boost requests from vendors |
| POST | `/api/vendor-boost/request` | `src/app/api/vendor-boost/request/route.ts` | Complete | Vendor requests designer testimonial; Zod-validated, deduplication, expiry (1-90 days) |
| POST | `/api/vendor-boost/[id]/accept` | `src/app/api/vendor-boost/[id]/accept/route.ts` | Listed | Designer accepts boost request |
| POST | `/api/vendor-boost/[id]/decline` | `src/app/api/vendor-boost/[id]/decline/route.ts` | Listed | Designer declines boost request |

### Collaboration & Spend

| Method | Path | File | Status | Description |
|--------|------|------|--------|-------------|
| GET | `/api/vendor/collaborations` | `src/app/api/vendor/collaborations/route.ts` | Complete | List collaborations with signal counts, spend metrics, budget usage |
| PATCH | `/api/vendor/collaborations/[participantId]/spend` | `src/app/api/vendor/collaborations/[participantId]/spend/route.ts` | Complete | Update spend settings (per-save/click pricing, budget cap, status) |

### Discovery & Invites

| Method | Path | File | Status | Description |
|--------|------|------|--------|-------------|
| POST | `/api/vendor/invite-designer` | `src/app/api/vendor/invite-designer/route.ts` | Complete | Mark designer as invited to vendor event |
| GET | `/api/vendor/smart-invites` | `src/app/api/vendor/smart-invites/route.ts` | Complete | AI-ranked designer recommendations (product saves 15pts, location 20pts, engagement 10pts) |
| POST | `/api/vendor/claim-product` | `src/app/api/vendor/claim-product/route.ts` | Complete | Vendor claims product ownership via preview token |

### Subscription & Access

| Method | Path | File | Status | Description |
|--------|------|------|--------|-------------|
| GET | `/api/vendor/subscription` | `src/app/api/vendor/subscription/route.ts` | Complete | Returns tier, feature flags (designer profiles, fingerprint matching, event attribution, analytics, SKU uploads, product boosting, etc.) |

### Rep Dashboard

| Method | Path | File | Status | Description |
|--------|------|------|--------|-------------|
| GET | `/api/vendor/rep/dashboard` | `src/app/api/vendor/rep/dashboard/route.ts` | Complete | Personalized feed of projects where vendor products tagged; designer following list |

### AI & Actions

| Method | Path | File | Status | Description |
|--------|------|------|--------|-------------|
| POST | `/api/vendor/ai-actions` | `src/app/api/vendor/ai-actions/route.ts` | **Stub** | Non-destructive task logging from AI insights; returns demo task ID |
| POST | `/api/vendor/ai-analyst` | `src/app/api/vendor/ai-analyst/route.ts` | **Partial** | Contextual AI answers; deterministic demo responses by sectionId |
| POST | `/api/vendor-actions/create-discovery-lunch` | `src/app/api/vendor-actions/create-discovery-lunch/route.ts` | Complete | AI-generated discovery lunch plan; targets hungry-middle designers; $2.5-9k budgets, 120-130x ROI projections |
| POST | `/api/vendor-actions/create-appreciation-dinner` | `src/app/api/vendor-actions/create-appreciation-dinner/route.ts` | Complete | AI-generated appreciation dinner plan; composite scoring (70% pipeline, 30% engagement); $6-30k budgets |
| POST | `/api/vendor-analytics/chat` | `src/app/api/vendor-analytics/chat/route.ts` | Listed | Chat interface for vendor analytics |

### Directory & Admin

| Method | Path | File | Status | Description |
|--------|------|------|--------|-------------|
| GET | `/api/directory/vendors` | `src/app/api/directory/vendors/route.ts` | Complete | Public vendor directory with ranking, stats, pagination. Views: overall/rising |
| GET | `/api/directory/vendors/[vendorId]` | `src/app/api/directory/vendors/[vendorId]/route.ts` | Listed | Individual vendor directory profile |
| GET/POST | `/api/admin/vendors` | `src/app/api/admin/vendors/route.ts` | Complete | Admin vendor CRUD (file-based JSON storage for demo) |
| GET | `/api/admin/vendor-analytics` | `src/app/api/admin/vendor-analytics/route.ts` | Partial | Admin-level vendor analytics aggregation |

**Total vendor API endpoints: 44+** | **Complete: 22** | **Partial/Stub: 4** | **Listed (not fully reviewed): 18+**

---

## 3. Vendor Dashboard & Analytics

### Dashboard Versions

| Feature | Route | File | Status | Description |
|---------|-------|------|--------|-------------|
| **Main Dashboard (v1)** | `/vendor/dashboard` | `src/app/vendor/dashboard/page.tsx` | Complete | Project stats, projects table with search/filtering, AI summaries, next-action suggestions, follow-up queue, quick actions menu, recent activity feed, KPI snapshot (5 metric cards) |
| **Dashboard v2** | `/vendor/dashboard-v2` | `src/app/vendor/dashboard-v2/page.tsx` | Partial | Feature-flagged alternative with heatmap, trending products, influence metrics, pipeline snapshot widgets |
| **Dashboard v3 (New)** | Component | `src/components/vendor/VendorDashboardNew.tsx` | Complete | Dual-tab (Events/Projects), KPI summary bar, AI summary ribbon, bridge metrics (event-to-project conversion) |
| **Rep Dashboard** | `/vendor/rep/dashboard` | `src/app/vendor/rep/dashboard/page.tsx` | Complete | Personalized feed of tagged projects, designer following list, product counts per project |

### Analytics Pages

| Feature | Route | File | Status | Description |
|---------|-------|------|--------|-------------|
| **Analytics Dashboard** | `/vendor/analytics` | `src/app/vendor/analytics/page.tsx` | Complete | Summary strip, Net Engagement Index, Conversion Ladder (Saves->Boards->Tags->Value), Room x Phase Heatmap, Spec Momentum, Saves Over Time, Opportunity Map, Time to Spec, Performance Benchmarks. All include action pills. |
| **Shop Analytics** | `/vendor/shop-analytics` | `src/app/vendor/shop-analytics/page.tsx` | Complete | Products in shops, unique designers, testimonials, boost requests (with $ invested), boost status (pending/approved/declined), top products/designers, recent activity, time range filters |
| **Event Analytics** | `/vendor/my-events/[eventId]` | `src/app/vendor/my-events/[eventId]/ProAnalyticsDashboard.tsx` | Complete | 5-tab pro dashboard: Overview (funnel + AI breakdown), Engagement (heatmap + saves timeline), Markets (geo distribution), Accounts & Products (top clients, product performance), Benchmarks |

### Intelligence & Insights

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **Question-Led Analytics** | `src/components/vendor/VendorAnalyticsDashboard.tsx` | Complete | Global question input, 3 hero insight cards (Influence Value, Top Engaged Designers, Events That Moved Metal), dynamic insight panel with AI conversation |
| **AI Insights Panel** | `src/components/vendor/ai/AIInsightsPanel.tsx` | Partial | AI-computed insight bundles with impact levels; locked/gated behind feature flag |
| **Dynamic Insight Panel** | `src/components/vendor/DynamicInsightPanel.tsx` | Complete | Multi-turn conversation UI, visualization support (stat, bar, heatmap), follow-up suggestions, action workflow drawers |
| **Quick Insights Grid** | `src/components/vendor/QuickInsightsGrid.tsx` | Complete | Configurable grid of insight cards with mini-visualizations (bar charts, sparklines, metrics with deltas) |

### Charts & Visualizations

| Component | File | Status | Description |
|-----------|------|--------|-------------|
| **Spec Heatmap** | `src/components/vendor/VendorAnalyticsHeatmap.tsx` | Complete | Regional spec heatmap with intensity bars and badges (top 8 regions) |
| **Trending Products** | `src/components/vendor/VendorAnalyticsTrending.tsx` | Complete | Top 5 trending products by recent specs with hot badges |
| **Designer Influence** | `src/components/vendor/VendorAnalyticsInfluence.tsx` | Complete | Top 5 designers by engagement, projects, specs, influence scores |
| **Pipeline Snapshot** | `src/components/vendor/VendorAnalyticsPipeline.tsx` | Complete | 3-stage pipeline (Specified, Awaiting Approval, Quoted) with progress bars |
| **Product Analytics Table** | `src/components/vendor/ProductAnalyticsTable.tsx` | Complete | Views, Saves, Designers Saved, Events Featured, Outbound Clicks, Save Velocity (7d), Saved Together |
| **Event Metrics Panel** | `src/components/vendor/EventMetricsPanel.tsx` | Complete | Per-event: Views, Saves, QR Scans, Designers Engaged |
| **Save Velocity Chart** | `src/components/vendor/charts/SavesOverTimeDemo.tsx` | Complete | Time series with cumulative saves tracking |
| **Room Phase Heatmap** | `src/components/vendor/charts/RoomPhaseHeatmapDemo.tsx` | Complete | Matrix visualization (rooms x design phases) |
| **Compact Funnel** | `src/components/vendor/charts/CompactFunnelDemo.tsx` | Complete | Conversion funnel: Saves -> Boards -> Tags -> Value |

### Hero Insight Cards

| Card | File | Status | Metrics Shown |
|------|------|--------|---------------|
| **Influence Value** | `src/components/vendor/insight-cards/InfluenceValueCard.tsx` | Complete | Total vendor influence value ($M), 30-day change, active projects, % of total budget |
| **Top Engaged Designers** | `src/components/vendor/insight-cards/TopEngagedDesignersCard.tsx` | Complete | Count of top designers, high-budget designers ($500k+), total saves and tags |
| **Events That Moved Metal** | `src/components/vendor/insight-cards/EventsThatMovedMetalCard.tsx` | Complete | Pipeline influenced ($M), top event value, designer check-ins, product saves |

---

## 4. Collaboration Features

### Collaboration Story System

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **CollaborationStory Model** | `prisma/schema.prisma:1974-2020` | Complete | Dual-interview format between vendors and designers. Status: INVITED -> ACCEPTED -> IN_PROGRESS -> PUBLISHED. Three rounds per side (vendorRound1/2/3, designerRound1/2/3). AI narrative generation. |
| **Story Creation API** | `src/app/api/collaboration/stories/route.ts` | Complete | Vendor creates invitation (Pro+ tier required). Prevents duplicate pending invites. |
| **Interview Rounds API** | `src/app/api/collaboration/stories/[id]/round/[round]/` | Complete | Submit per-round responses. Validates participant role. Tracks completion timestamps. |
| **Narrative Generation** | `src/app/api/collaboration/stories/[id]/generate/` | Complete | AI weaves vendor + designer responses into cohesive narrative. |
| **Publishing** | `src/app/api/collaboration/stories/[id]/publish/` | Complete | Publishes to `/magazine/collaborations`. Sets publishedAt. |
| **Invitation UI** | `src/components/collaboration/CollaborationInvite.tsx` | Complete | Styled invitation card with accept/decline, decline reason capture (500 char). |
| **Story View UI** | `src/components/collaboration/CollaborationStoryView.tsx` | Complete | Public view with gradient header, participant profiles, content blocks (heading, paragraph, blockquote, pull quote, image, divider). |

### Project Participant System

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **ProjectParticipant Model** | `prisma/schema.prisma:1076-1100` | Complete | Links vendors to projects. Side: VENDOR. Roles: OWNER, EDITOR, VIEWER. Extended with spend fields: spendEnabled, spendPerSaveUsd, spendPerClickUsd, budgetCapUsd, collaborationStatus. |
| **Collaborations Dashboard** | `src/components/vendor/CollaborationsTable.tsx` | Complete | Lists active collaborations, signal counts (saves, clicks), spend metrics, budget usage %. Edit modal for spend settings. |
| **Collaborations API** | `src/app/api/vendor/collaborations/route.ts` | Complete | Fetches vendor's ProjectParticipant records, calculates monthly signals from ContextSignal, queries VendorDiscoveryBudget. |
| **Spend Update API** | `src/app/api/vendor/collaborations/[participantId]/spend/route.ts` | Complete | PATCH to update spend settings with validation. |

### Signal & Spend Tracking

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **Resolve Collaboration** | `src/lib/spend/resolveCollaboration.ts` | Complete | Finds active vendor-project collaboration with spend enabled. |
| **Apply Signal Spend** | `src/lib/spend/applySignalSpend.ts` | Complete | Rate-limits signals (100/user/hour/project), prices signals, updates VendorDiscoveryBudget, clamps to remaining budget. |
| **Price Signal** | `src/lib/spend/priceSignal.ts` | Complete | Determines spend amount per signal. Returns valueUsd with reason (budget_capped, no_price_configured, etc.). |

### Handoff Workflows

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **Handoff Types** | `src/types/handoff.ts` | Complete | HandoffProductItem, HandoffQuotePayload (file-based PDF or structured JSON), CreateHandoffRequest. |
| **Handoff Composer UI** | `src/components/vendor/handoff/HandoffComposer.tsx` | Complete | Email input, product picker, quote/delivery card, optional note, copy-link modal on success. |
| **Designer Inbox** | `src/app/api/designer/inbox/handoffs/` | Complete | Queries VendorVisit records by designer email. Returns pending handoffs with project info. |

### Vendor Recruitment Capture

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **Invite Candidate Capture** | `src/lib/vendor/inviteCandidates.ts` | Complete | Captures vendor info when designers tag products. Multi-contact support, domain extraction, vendor name normalization. |
| **Tagging Hook** | `src/app/api/tag-product-to-image/route.ts` | Complete | Primary capture entry point (hooked). Secondary paths (selections, rooms) not yet hooked. |
| **OrgVendorPartnership** | `prisma/schema.prisma:3462-3479` | Complete | Formal design firm <-> vendor partnership management. |

---

## 5. Editorial & Content Features

### Contributor/Voice System

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **ArticleTopic Model** | `prisma/schema.prisma:3812+` | Complete | Admin-created prompts for articles. Status: QUEUED -> GATHERING -> THRESHOLD_MET -> WRITING -> REVIEW -> PUBLISHED. |
| **Contribution Model** | `prisma/schema.prisma:3812+` | Complete | User submissions. Types: QUICK_TAKE, EXPERTISE, PREDICTION, REFLECTION, ENDORSEMENT, CONSUMER_VOICE. Text or voice (audioUrl + voiceTranscript). Status: PENDING -> APPROVED -> SELECTED -> PUBLISHED. |
| **Smart Targeting** | `src/lib/contributions/targeting.ts` | Complete | Role-based targeting (DESIGNER, VENDOR, INDIVIDUAL), material/style category matching, user save history. |
| **Badge System** | `src/lib/contributions/badges.ts` | Complete | VOICE (1 published), SPECIALIST (5 for vendors), AUTHORITY (15), EDITORIAL_VOICE (30). |
| **Contributions API** | `src/app/api/contributions/route.ts` | Complete | Submit/list contributions with Zod validation. |

### Interview/Recorded Reflection System

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **InterviewSession Model** | `prisma/migrations/add_recorded_reflection_system.sql` | Complete | Audio/video interviews. Status: DRAFT -> UPLOADED -> TRANSCRIBING -> TRANSCRIBED -> EXTRACTING -> EXTRACTED -> CLIPPING -> READY -> PUBLISHED. |
| **Question Generation** | `src/lib/interview/generateQuestions.ts` | Complete | Context-aware questions based on project completeness, rooms, products/materials. AI follow-up generation. |
| **Answer Analysis** | `src/lib/interview/answerAnalysis.ts` | Complete | Detects vendor mentions, product mentions, sentiment (positive/neutral/negative), quotability, pull quote extraction, **boost eligibility detection**. |
| **Transcription Pipeline** | `prisma/schema.prisma` (TranscriptSegment, QuoteHighlight) | Complete | Timestamped transcripts, quotable moment extraction with confidence scores and use cases (EDITORIAL_PULLQUOTE, PRODUCT_PAGE_INSIGHT, SOCIAL_CLIP_HOOK). |
| **Narrative Generation** | `src/lib/interview/narrativeGeneration.ts` | Complete | AI-generated narrative from interview data. |

### Vendor Boost System (Testimonials)

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **Opportunity Creation** | `src/lib/boost/createOpportunity.ts` | Complete | Triggered when interview answer is boost-eligible. Auto-created per positively-mentioned vendor. 14-day expiration. |
| **Vendor Notification** | `src/lib/boost/notifyVendor.ts` | Complete | Email template + in-app notification to vendor org owners/admins. |
| **Boost Acceptance** | `src/app/api/vendor/boosts/[opportunityId]/boost/route.ts` | Complete | Vendor reviews, customizes pull quote, selects display options. Validates org ownership and tier. |
| **Designer Notification** | (in boost route) | Complete | Designer receives in-app notification when testimonial is boosted. |
| **Cron Processing** | `src/app/api/cron/process-boost-opportunities/route.ts` | Complete | Auto-expires unactioned opportunities after 14 days. |

### Vendor Boost Request System

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **Request Creation** | `src/app/api/vendor-boost/request/route.ts` | Complete | Vendor targets specific designer + product + project. Validates ownership and tagging. Configurable expiry (1-90 days). |
| **Designer Inbox** | `src/app/api/vendor-boost/inbox/route.ts` | Complete | Shows pending boost requests with product/project/vendor details. |
| **Interview Trigger** | `src/app/api/interviews/create/route.ts` | Complete | Accepts vendorBoostRequestId; designer records testimonial. On publish, request marked COMPLETED. |

### Editorial Interview System

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **EditorialInterview Model** | `prisma/schema.prisma:1300-1350` | Complete | One per project. Status: IN_PROGRESS -> COMPLETED -> PUBLISHED. |
| **Question Generation** | `src/lib/editorial/generateContextualQuestions.ts` | Complete | Contextual questions linked to products and images. |
| **Answer Processing** | `src/lib/editorial/processInterviewAnswers.ts` | Complete | AI classification of attributes (color, material, style). Quote extraction for vendor boosts. |
| **Chapter Building** | `src/lib/editorial/buildEditorialChapters.ts` | Complete | AI generates editorial chapters from interview data. |

### Designer Shop Testimonials

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **ShopProduct Model** | `prisma/schema.prisma:3995-4018` | Complete | Designers curate vendor products with quotes. Quote approval workflow. |
| **ProductTestimonial Model** | `prisma/schema.prisma` | Complete | Product-level testimonials. isFeatured flag for vendor-boosted testimonials. |
| **Shop Boost** | `prisma/schema.prisma:4020-4044` | Complete | Vendor pays to feature testimonials. 70/30 split (designer/Folio). |

### Trend Content

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **TrendSignal** | `prisma/schema.prisma:3689+` | Complete | Micro-signals about trending products/materials. |
| **TrendInterviewRequest** | `prisma/schema.prisma:3689+` | Complete | Designer micro-interviews about trending products. Triggers vendor content opportunities. |

---

## 6. Product Features

### Product Catalog Management

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **Product Listing** | `src/app/vendor/products/page.tsx` | Complete | Paginated product list (20/page), search by name/brand, filter by vendor/status. |
| **Product Actions** | `src/app/vendor/products/actions.ts` | Complete | Server actions for product CRUD. |
| **Product Components** | `src/components/vendor/products/` | Complete | UI components for product management. |

### Product Creation Wizard

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **URL Scraping** | `src/components/vendor/add-product/StepUrl.tsx` | Complete | Browserless-based HTML scraping. JSON-LD, OpenGraph extraction. Confidence scoring. |
| **Scrape Review** | `src/components/vendor/add-product/StepScrape.tsx` | Complete | Review scraped data, "Apply All High Confidence" bulk import. |
| **Field Mapping** | `src/components/vendor/add-product/StepMap.tsx` | Complete | SKU (min 2 chars), dimensions, weight, materials, finish, care, lead time, compliance, origin. |
| **Media Management** | `src/components/vendor/add-product/StepMedia.tsx` | Complete | Hero media (image/video), gallery, auto color palette extraction. |
| **File Uploads** | `src/components/vendor/add-product/StepFiles.tsx` | Complete | Spec sheets (PDF), 3D models (GLTF/GLB/USDZ/OBJ/FBX), CAD (DWG/DXF), BIM (RVT/IFC), installation guides, warranties, data sheets. |
| **Review & Publish** | `src/components/vendor/add-product/StepReview.tsx` | Complete | Validation: name (3+ chars), hero media required, description (40+ chars), at least one spec, alt text required, PDFs only for spec sheets. |
| **Validation Logic** | `src/lib/vendor/validateProduct.ts` | Complete | Comprehensive validation rules with user feedback. |

### Product Tagging & Attribution

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **Tag-to-Image API** | `src/app/api/tag-product-to-image/route.ts` | Complete | X,Y coordinate tagging on project images. Creates ProductTag records. Captures decision metadata (reasoning, alternatives, conviction). |
| **Advanced Tagging UI** | `src/components/AdvancedTagProducts.tsx` | Complete | Interactive image tagging interface. |
| **Vendor Notification** | `src/lib/email/notifyVendorTagged.ts` | Complete | Notifies vendors when products tagged by designers. |

### Asset Generation

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **3D Asset Generation** | `src/app/api/projects/[id]/generate-3d-assets/route.ts` | Partial | Roboflow SAM3D integration. Formats: GLTF, GLB, USDZ, OBJ, FBX. Note: threeDAssetUrl field not yet in Prisma schema. |
| **2D Cutout Generation** | `src/app/api/projects/[id]/generate-2d-cutouts/route.ts` | Complete | SAM3D-powered transparent PNG cutouts. Idempotent via cutoutImageUrl field. |

### Import & Batch Processing

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **Import Sessions** | `prisma/migrations/20260119000000_add_import_session_tables/migration.sql` | Complete | Multi-source import: presentations (PDF/PPT), websites, bulk images. Status: PROCESSING -> ANALYZED -> READY_FOR_REVIEW -> COMPLETED. |
| **Pending Tag Verification** | Same migration | Complete | Confidence-based tag suggestions. Status: UNREVIEWED -> CONFIRMED/CORRECTED/DISMISSED. |

### Product Claiming

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **Claim Product API** | `src/app/api/vendor/claim-product/route.ts` | Complete | Preview-token-based product ownership claiming. Creates vendor record if needed. |

---

## 7. Event Features

### Event-Vendor Relationship Models

| Model | File Reference | Status | Description |
|-------|----------------|--------|-------------|
| **EventVendorEdge** | `src/app/api/events/[id]/graph/route.ts:69` | **Referenced/Stub** | Tracks vendor participation (exhibitor, sponsor), product views/saves, rep engagements, estimated/actual ROI. Referenced in graph API but may not exist in Prisma schema. |
| **EventDesignerEdge** | `src/app/api/events/[id]/graph/route.ts:52` | **Referenced/Stub** | Tracks designer engagement (views, saves, clicks). Referenced but may not be in schema. |
| **EventProductEdge** | `src/app/api/events/[id]/graph/route.ts:84` | **Referenced/Stub** | Links products to events with conversion rates. Referenced but may not be in schema. |
| **EventRepEdge** | `src/app/api/events/[id]/graph/route.ts:100` | **Referenced/Stub** | Tracks rep activity (connections, presentations, quotes). Referenced but may not be in schema. |

### Event Types & Participation

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **EventType.BOOTH** | `prisma/schema.prisma:935` | Complete | Booth-type events in taxonomy alongside PANEL, PRODUCT_REVEAL, HAPPY_HOUR, LUNCH_AND_LEARN, etc. |
| **isSponsored Flag** | `prisma/schema.prisma:201` | Complete | Boolean flag on Event model for sponsored events. |
| **Event Listing** | `src/app/vendor/my-events/page.tsx` | Complete | Redirects to dashboard; events shown in VendorEventsTab. |
| **Events Tab** | `src/components/vendor/events/VendorEventsTab.tsx` | Complete | Event portfolio grid, portfolio KPIs strip, events comparison bar chart, portfolio momentum line chart, benchmarks strip, AI insights pane. |

### Event Analytics (52 components)

| Category | Key Components | Status | Description |
|----------|---------------|--------|-------------|
| **Pro Analytics Dashboard** | `src/app/vendor/my-events/[eventId]/ProAnalyticsDashboard.tsx` | Complete | 5 tabs: Overview, Engagement, Markets, Accounts & Products, Benchmarks |
| **Data Visualizations** | SavesOverTime, SavesOverTimeDaily, GeoPopularity, RoomPhaseHeatmap, ProjectPhasesPie | Complete | Time series, geographic heatmaps, matrix views, pie charts |
| **Performance Tables** | TopDesignersTable, TopProductsTable, TopProductsPost | Complete | Designer rankings, product performance, featured products |
| **Advanced Analytics** | CompactFunnel, LeakDrivers, OpportunityQuadrant, InfluenceFlow, TimeToSpecChart | Complete | Conversion funnels, drop-off analysis, opportunity matrix, influence tracking |
| **Post-Event (22 components)** | OutcomeSnapshot, AttributionTiming, KeyAccounts, DesignerTimelines, PlaybookSheet, Next7DaysPlan, IntentSegments, MarketMap | Complete | Post-event analysis, attribution (including "Booth QR" channel), action planning |
| **AI Features** | ExecutiveSummary, AnalyticsDrawer, InsightCard, TopFirmsPills, CohortMini, ExportButton, QBRExportButton | Partial | AI-generated insights; structure complete, AI integration incomplete |

### Event Workflow Jobs

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **Vendor Dashboard Update** | `src/app/api/events/[id]/workflow/vendor-dashboard/route.ts` | Partial | Updates vendor dashboards post-event |
| **ROI Tracking** | `src/app/api/events/[id]/workflow/roi/route.ts` | Partial | Attach ROI metrics to events |
| **Follow-ups** | `src/app/api/events/[id]/workflow/follow/route.ts` | Partial | Post-event follow-up workflows |
| **Recaps** | `src/app/api/events/[id]/workflow/recap/route.ts` | Partial | Post-event recap generation |

### Event Action Planning

| Feature | File | Status | Description |
|---------|------|--------|-------------|
| **Discovery Lunch Generator** | `src/app/api/vendor-actions/create-discovery-lunch/route.ts` | Complete | AI-generated lunch plans targeting hungry-middle designers. 10-14 guests, 3 venue options, $2.5-9k budgets, 120-130x ROI. |
| **Appreciation Dinner Generator** | `src/app/api/vendor-actions/create-appreciation-dinner/route.ts` | Complete | AI-generated dinner plans for top partners. Composite scoring. 12-18 guests, $6-30k budgets, 90-95x ROI. |

### Critical Event Gaps

| Gap | Impact | Notes |
|-----|--------|-------|
| EventVendorEdge model possibly missing from schema | Cannot persist vendor-event relationships | Referenced in code but not confirmed in schema |
| EventWorkflowJob model possibly missing | Post-event automation workflows may fail | Referenced in 5 workflow endpoints |
| Real event KPI API not wired | Analytics use mock data | Multiple TODO comments in eventsAdapter.ts |
| Booth cost tracking is mock-only | No real cost tracking | vendorAnalyticsMock.ts only |
| Sponsorship management UI missing | Cannot purchase sponsorships | isSponsored flag exists but no management flow |

---

## 8. Notifications & Signals

### Notification Types

| Notification | Trigger | Email | In-App | Status | File |
|-------------|---------|-------|--------|--------|------|
| **Product Tagged** | Designer publishes project with vendor products | Template ready | Working | Partial (email service TODO) | `src/lib/email/notifyVendorTagged.ts` |
| **Boost Opportunity** | Interview detects positive vendor mention | Template ready | Working | Partial (email service TODO) | `src/lib/boost/notifyVendor.ts` |
| **Testimonial Boosted** | Vendor boosts a designer's testimonial | N/A | Working | Complete | `src/app/api/vendor/boosts/[opportunityId]/boost/route.ts` |
| **Product Preview** | Vendor product featured in project | Template ready | N/A | Partial (email service TODO) | `src/lib/email/sendVendorProductPreviewEmail.ts` |
| **Contribution Published** | User's editorial contribution goes live | N/A | Working | Partial | `src/lib/notifications/contribution.ts` |
| **Badge Earned** | User earns contributor badge | N/A | Working | Partial | `src/lib/notifications/contribution.ts` |
| **New Topic Available** | Editorial topic matches user interests | N/A | Working | Partial | `src/lib/notifications/contribution.ts` |

### Signal Systems

| Signal | File | Status | Description |
|--------|------|--------|-------------|
| **VendorInviteSignal** | `prisma/schema.prisma:3189-3202` | Schema complete, no notification | Tracks vendor mentions for future outreach. Types: TESTIMONIAL_AVAILABLE, PRODUCT_TAG. 30-day dedup window. |
| **VendorInviteCandidate** | `src/lib/vendor/inviteCandidates.ts` | Data capture complete | Captures vendor info from designer tagging. Multi-contact support, domain extraction, name normalization. |
| **VendorInviteContact** | Same file | Complete | Multi-contact per vendor. Sources: TAGGING, SCRAPE, MANUAL_ADMIN, LEGACY. |
| **ContextSignal** | `prisma/schema.prisma` | Complete | Per-action signals: view, save, add_to_project, click. With vendorId and valueUsd. |

### Notification Infrastructure

| Component | File | Status | Description |
|-----------|------|--------|-------------|
| **Notification Model** | `prisma/schema.prisma:3205-3221` | Complete | Central in-app notification storage. String-based type (extensible). Read/unread tracking. |
| **Manual Trigger UI** | `src/components/projects/NotifyVendorsButton.tsx` | Complete | Designer-initiated batch vendor notifications with deduplication. |
| **Rate Limiting** | `src/lib/email/notifyVendorTagged.ts` | Complete | 1 email per vendor per 24 hours. |
| **Preview Token System** | `src/lib/email/sendVendorProductPreviewEmail.ts` | Complete | UUID-based, 14-day expiration. |

### Cross-Cutting Gap: Email Service

All email notifications have fully designed HTML templates but log to console instead of sending. The email service integration is marked as TODO across:
- `notifyVendorTagged.ts`
- `notifyVendor.ts` (boost)
- `sendVendorProductPreviewEmail.ts`
- `contribution.ts`

---

## 9. Feature Completeness Matrix

### By Domain

| Domain | Complete | Partial | Stub | Total |
|--------|----------|---------|------|-------|
| **Data Models** | 24 | 0 | 0 | 24 |
| **API Routes** | 22 | 4 | 18+ listed | 44+ |
| **Dashboard/Analytics** | 3 versions + analytics | 1 (AI insights gated) | 0 | 4+ pages |
| **Charts/Visualizations** | 8+ types | 0 | 0 | 8+ |
| **Collaboration** | 6 features | 1 (invite capture paths) | 0 | 7 |
| **Editorial/Content** | 7 systems | 1 (trend content) | 0 | 8 |
| **Product Management** | 12 features | 2 (3D assets, variants) | 0 | 14 |
| **Events** | Event types, listing, 52 UI components | Analytics (mock data), workflows | Edge models possibly missing | Many |
| **Notifications** | 4 in-app types | 3 email (service TODO) | 0 | 7 |

### By Implementation Status

| Status | Count | Examples |
|--------|-------|---------|
| **Production-Ready** | ~70% | Subscription management, boost system, collaboration stories, product catalog, handoffs, signal tracking |
| **Partial/Demo** | ~20% | Event KPIs (mock data), AI analyst (deterministic), QBR (demo state), 3D assets (API complete, schema pending) |
| **Stub/TODO** | ~10% | AI actions (demo task ID), email service integration, event edge models, notification center UI |

### Key Architectural Strengths

1. **Comprehensive data model** - 24 vendor models with proper relations, indexes, and status tracking
2. **Multi-tier subscription** - STARTER through ENTERPRISE with granular feature flags
3. **Dual-sided marketplace** - Both vendor and designer workflows with balanced incentives
4. **Signal-based monetization** - Per-save/click pricing with budget caps and rate limiting
5. **AI-powered insights** - Question-led analytics, interview analysis, narrative generation
6. **Privacy-aware** - vendorVisibility controls, anonymization in analytics

### Key Gaps to Address

1. **Email service integration** - All email templates designed but not sending
2. **Event edge models** - EventVendorEdge, EventDesignerEdge, EventProductEdge referenced but possibly not in schema
3. **Notification center UI** - No bell icon or notification drawer component found
4. **Real event analytics** - KPIs and metrics using mock data; TODO comments for real API wiring
5. **3D asset schema field** - threeDAssetUrl referenced in code but not in Prisma schema
6. **Secondary tagging capture** - Vendor invite capture only hooked into tag-product-to-image, not selections/rooms
7. **Auth inconsistency** - Some vendor routes missing access control validation

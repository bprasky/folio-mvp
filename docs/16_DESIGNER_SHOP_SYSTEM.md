# 16_DESIGNER_SHOP_SYSTEM

## Spotlight revision 1.1 override — 9 September 2026

The [founder specification](Folio-Spotlight-and-Social-Publishing-Spec.md) replaces the immediate-activation tagging flow below. Offer **Spotlight this piece**, off by default, on creation and editing of tags. Explain the interview, Shop, social-story and optional vendor-contribution benefits before selection, plus attributed product-page use. No quote is required during tagging; an optional private steering note is allowed.

Selection creates a canonical draft per publishing identity/project/product/confirmed room, deduplicating linked photo tags while preserving distinguishing finish/variant. Resolve room IDs, not display names or optional Selection backfills. Show pending questions and room assignment. Removing selection preserves the tag.

Only an approved published spotlight activates new Shop and product-page content. Preserve independent explanations from multiple rooms/projects and an explicitly chosen lead source. Exact approval is version-specific; draft edits do not overwrite the currently approved public wording. Withdrawal removes only affected sources, and parent unpublishing removes dependent visibility. Existing public Shop records remain labeled legacy until reviewed; never infer selection or bulk-withdraw them.

Vendor payment, enrollment, silence, decline or opt-out never gates this designer value. Saving contacts or tagging sends no invitation. Invitations require public content plus explicit reviewed send authorization. Boosts and possible future payouts are separate; launch promises no guaranteed income. The older immediate-Shop toggle, automatic effects and revenue statements below are historical proposals where they conflict with this override. See the [foundation audit](SPOTLIGHT_FOUNDATION_AUDIT_2026-09-09.md) for runtime gaps.

## Purpose
This document defines the Designer Shop feature—a shoppable storefront on every designer profile showcasing products they've tagged, with testimonial content, vendor boost monetization, and closed-loop attribution economics.

## Core Concept

Every designer profile becomes a curated storefront. Products they tag and choose to feature create a shoppable experience that:

- Gives individuals a trusted path to purchase
- Gives vendors Shopify-level analytics across thousands of micro-storefronts
- Gives designers passive income through boost revenue
- Creates testimonial content that benefits product pages
- Closes the attribution loop with monetizable action levers

---

## Designer Profile Structure

```
[Designer Profile]
├── Feed (default landing) ← Main activity stream
├── Portfolio (projects)
├── Shop ← Product storefront
├── About
└── Contact
```

**Note**: Designers can rearrange tab order from default. Shop can be promoted to primary position if desired.

### Feed Integration

New or boosted products from Shop can surface in the designer's Feed tab:
- "Just added to my shop: [Product]"
- Boosted products get Feed placement during boost period
- Creates natural promotion without separate action

**Audit Flag**: Review Feed content mixing rules—how much shop content vs. project content in the feed algorithm.

---

## Adding Products to Shop

### During Post Creation

When tagging products in a project post:

```
┌─────────────────────────────────────────────────┐
│ Tagged: Apparatus Studio - Cloud Chandelier     │
│                                                 │
│ ☑️ Add to my Shop                               │
│                                                 │
│ [Optional] Add a quote about this product:      │
│ ┌─────────────────────────────────────────────┐ │
│ │ "This lamp ended up being the thing we      │ │
│ │  couldn't live without..."                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [ ] I'll add thoughts later                     │
│                                                 │
│ [Continue Tagging]                              │
└─────────────────────────────────────────────────┘
```

### Toggle Behavior

| Toggle State | Result |
|--------------|--------|
| ON + Quote provided | Product added to Shop immediately with quote |
| ON + "Add later" | Product added to Shop, quote prompt in dashboard |
| OFF | Product tagged for attribution only, not in Shop |

### The Single Action Value

One toggle accomplishes:
- Product appears in designer's Shop
- Quote captured for testimonial
- Quote eligible for product page aggregation
- Vendor sees Shop placement in analytics
- Product eligible for vendor boost
- Attribution chain complete

This compresses five potential steps into one decision point.

---

## Shop Tab Experience

### Grid View

```
┌─────────────────────────────────────────────────────────┐
│ [Filter: All ▾]  [Sort: Recent ▾]                       │
│                                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ 🔥      │ │         │ │         │ │ ⭐      │        │
│ │ [img]   │ │ [img]   │ │ [img]   │ │ [img]   │        │
│ │         │ │         │ │         │ │         │        │
│ │ Product │ │ Product │ │ Product │ │ Product │        │
│ │ Vendor  │ │ Vendor  │ │ Vendor  │ │ Vendor  │        │
│ │ 3 proj  │ │ 1 proj  │ │ 2 proj  │ │ 5 proj  │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                                                         │
│ 🔥 = Boosted   ⭐ = Featured by Designer               │
└─────────────────────────────────────────────────────────┘
```

### Filters

| Filter | Options |
|--------|---------|
| Product Type | Lighting, Furniture, Textiles, Tile, Hardware, etc. |
| Vendor | All vendors tagged by this designer |
| Room | Living, Kitchen, Bath, Bedroom, etc. |
| Project | Filter by specific project |

### Sort Options

- Recent (default)
- Popular (saves + clicks)
- Featured (designer-pinned first)

---

## Product Modal

Clicking a product opens detailed view:

```
┌─────────────────────────────────────────────────────────┐
│                                                    [X]  │
│ ┌─────────────────────┐  ┌───────┐ ┌───────┐           │
│ │                     │  │context│ │context│           │
│ │   [Product Image]   │  │ photo │ │ photo │           │
│ │                     │  │   1   │ │   2   │           │
│ └─────────────────────┘  └───────┘ └───────┘           │
│                                                         │
│ Cloud Chandelier                                        │
│ by Apparatus Studio                                     │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ "This lamp ended up being the thing we couldn't     │ │
│ │  live without. The way it catches afternoon light   │ │
│ │  transforms the entire room."                       │ │
│ │                                                     │ │
│ │                           — Sarah Chen, Designer    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Featured in: Tribeca Loft Renovation →                  │
│              Pacific Heights Residence →                │
│                                                         │
│ [Request Quote]    [Save]    [View Full Product Page]   │
└─────────────────────────────────────────────────────────┘
```

### Modal Contents

| Element | Source |
|---------|--------|
| Product image | Vendor catalog or designer upload |
| Context photos | Project images where product appears |
| Quote | Designer-provided during tagging or later |
| Project links | All projects featuring this product |
| Actions | Quote request, save, product page link |

---

## Testimonial System

### Quote Flow

```
Designer tags product →
Toggles "Add to Shop" →
Provides quote (or defers) →
Quote appears in designer's Shop modal →
Quote aggregates to product page testimonials →
Vendor can feature/boost specific testimonials
```

### Quote Approval

Designers maintain control:
- Edit quote anytime from Shop management
- Remove quote (removes from product page too)
- Approve/reject vendor feature requests for their quotes

### Product Page Testimonial Display

```
┌─────────────────────────────────────────────────────────┐
│ PRODUCT PAGE: Cloud Chandelier by Apparatus            │
│                                                         │
│ ...                                                     │
│                                                         │
│ What Designers Are Saying                               │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ ⭐ "This lamp ended up being the thing we couldn't     │
│    live without..."                                     │
│                           — Sarah Chen [View Shop →]    │
│                                                         │
│ "The scale is perfect for double-height spaces."        │
│                           — Marcus Rivera [View Shop →] │
│                                                         │
│ "Clients always ask about this piece first."            │
│                           — Jennifer Walsh [View Shop →]│
│                                                         │
│ ⭐ = Featured testimonial (vendor boosted)              │
└─────────────────────────────────────────────────────────┘
```

---

## Vendor Boost System

### What Vendors Can Boost

| Boost Type | Description | Placement |
|------------|-------------|-----------|
| Shop Placement | Elevate product in designer's Shop grid | 🔥 badge, priority position |
| Testimonial Feature | Highlight specific quote on product page | ⭐ badge, top placement |
| General Promotion | Elevate across multiple designer shops | Scaled by engagement tier |

### Pricing Model

**Per-Designer, Per-Month Subscription**

Vendors purchase boost access to specific designers:

| Designer Tier | Criteria | Monthly Boost Rate |
|---------------|----------|-------------------|
| Top | Influence score 80+ | Premium ($X) |
| Trending | Score growth >20% in 30 days | Growth ($Y) |
| Standard | Active, posting regularly | Base ($Z) |

**General Promotions**

Vendors can also run promotions across multiple shops:
- Select by tier, category, or region
- Higher cost for higher-engagement designers
- Campaign-style pricing (weekly/monthly)

### Revenue Split

| Recipient | Share | Form |
|-----------|-------|------|
| Designer | 70% | Folio Credit |
| Folio | 30% | Revenue |

**Why Folio Credit for Designer Share**:
- Keeps value in ecosystem
- Prevents extraction leakage
- Builds Credit balance that incentivizes on-platform purchases
- Aligns with Tier 2 compensation model

### Designer Approval Flow

```
┌─────────────────────────────────────────────────────────┐
│ 🔔 Boost Request                                        │
│                                                         │
│ Apparatus Studio wants to boost "Cloud Chandelier"      │
│ in your Shop for January 2026.                          │
│                                                         │
│ You'll earn: $XX in Folio Credit                        │
│                                                         │
│ [Approve]    [Decline]    [View Product]                │
└─────────────────────────────────────────────────────────┘
```

**Approval should be common**: Designers are getting paid. Decline option exists for brand alignment concerns.

---

## Vendor Analytics Dashboard

Vendors see comprehensive Shop analytics:

### Shop Presence View

```
┌─────────────────────────────────────────────────────────┐
│ Your Products Appear in 147 Designer Shops              │
│                                                         │
│ Top Performing Shops (by engagement)                    │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ 1. Sarah Chen          │ 8 products │ 2.4K views/mo    │
│    Influence: 94       │ Boosted: 2 │ [Manage Boosts]  │
│                                                         │
│ 2. Marcus Rivera       │ 5 products │ 1.8K views/mo    │
│    Influence: 78       │ Boosted: 0 │ [Add Boost]      │
│                                                         │
│ 3. Jennifer Walsh      │ 12 products│ 1.2K views/mo    │
│    Influence: 65       │ Boosted: 1 │ [Manage Boosts]  │
│                                                         │
│ [View All 147 Shops]                                    │
└─────────────────────────────────────────────────────────┘
```

### Per-Shop Analytics

When vendor drills into a specific designer's shop:

- Products featured
- Views per product
- Saves per product
- Quote requests originated
- Conversion to purchase (if through Folio)
- Boost performance (if active)

### The Shopify Comparison

This gives vendors Shopify-level data across thousands of micro-storefronts:
- Every designer is a distribution channel
- Real-time engagement metrics
- Attribution from Shop → Quote → Purchase
- A/B testing via selective boosting

---

## Designer Shop Management

### Dashboard View

```
┌─────────────────────────────────────────────────────────┐
│ My Shop                                        [Edit]   │
│                                                         │
│ 34 Products │ 12.4K views this month │ $XXX earned     │
│                                                         │
│ Pending Actions                                         │
│ ─────────────────────────────────────────────────────── │
│ • 3 products awaiting quotes [Add Quotes]               │
│ • 2 boost requests pending [Review]                     │
│                                                         │
│ Recent Activity                                         │
│ ─────────────────────────────────────────────────────── │
│ • Cloud Chandelier: 142 views, 23 saves this week      │
│ • Waterworks Faucet: Boost approved, live now          │
│                                                         │
│ [Manage Products]  [View Analytics]  [Boost History]    │
└─────────────────────────────────────────────────────────┘
```

### Product Management

Designers can:
- Remove products from Shop (attribution persists separately)
- Edit quotes
- Reorder/feature specific products
- Set products as "Featured" (designer's choice, no vendor payment)
- Approve/decline boost requests

---

## Data Model Additions

### ShopProduct

```prisma
model ShopProduct {
  id              String    @id @default(cuid())
  designerId      String
  productId       String
  projectId       String?   // Source project where tagged

  quote           String?   // Designer testimonial
  quoteApprovedAt DateTime? // When quote was finalized

  isActive        Boolean   @default(true)
  isFeatured      Boolean   @default(false) // Designer-pinned

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  designer        User      @relation(fields: [designerId], references: [id])
  product         Product   @relation(fields: [productId], references: [id])
  project         Project?  @relation(fields: [projectId], references: [id])
  boosts          ShopBoost[]

  @@unique([designerId, productId])
  @@index([designerId])
  @@index([productId])
  @@map("shop_products")
}
```

### ShopBoost

```prisma
model ShopBoost {
  id              String    @id @default(cuid())
  shopProductId   String
  vendorId        String

  status          BoostStatus @default(PENDING)

  startDate       DateTime
  endDate         DateTime

  amountPaid      Decimal   @db.Decimal(10, 2)
  designerCredit  Decimal   @db.Decimal(10, 2) // 70%
  folioRevenue    Decimal   @db.Decimal(10, 2) // 30%

  approvedAt      DateTime?
  declinedAt      DateTime?
  declineReason   String?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  shopProduct     ShopProduct @relation(fields: [shopProductId], references: [id])
  vendor          Organization @relation(fields: [vendorId], references: [id])

  @@index([shopProductId])
  @@index([vendorId])
  @@index([status])
  @@map("shop_boosts")
}

enum BoostStatus {
  PENDING
  APPROVED
  ACTIVE
  DECLINED
  EXPIRED
  CANCELLED
}
```

### ProductTestimonial

```prisma
model ProductTestimonial {
  id              String    @id @default(cuid())
  productId       String
  shopProductId   String    @unique // Links to designer's shop product

  quote           String
  isFeatured      Boolean   @default(false) // Vendor-boosted

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  product         Product   @relation(fields: [productId], references: [id])
  shopProduct     ShopProduct @relation(fields: [shopProductId], references: [id])

  @@index([productId])
  @@map("product_testimonials")
}
```

---

## Implementation Phases

### Phase 1 (Ship with Shop Tab)

| Feature | Priority |
|---------|----------|
| Shop tab on designer profile | P0 |
| "Add to Shop" toggle in tagging flow | P0 |
| Quote input during tagging | P0 |
| Basic product grid with filters | P0 |
| Product modal with context photos | P1 |

### Phase 2 (Testimonials + Vendor View)

| Feature | Priority |
|---------|----------|
| Quotes aggregate to product pages | P0 |
| Vendor "Your Products in Shops" dashboard | P0 |
| Per-shop analytics for vendors | P1 |
| Designer Shop management dashboard | P1 |

### Phase 3 (Boost System)

| Feature | Priority |
|---------|----------|
| Boost request flow | P0 |
| Designer approval UI | P0 |
| Revenue split + Credit allocation | P0 |
| General promotion campaigns | P1 |
| Testimonial featuring (product page boosts) | P2 |

---

## Integration Points

### Feed Tab Integration

- New Shop products can appear in designer's Feed
- Boosted products get Feed placement during active boost
- Configurable: designer can toggle "Show Shop updates in Feed"

### Attribution System (Doc 13)

- Shop products maintain full attribution chain
- Vendor Visibility setting affects whether vendor sees Shop analytics
- Quote approval separate from Visibility toggle

### Compensation System (Doc 12)

- Boost revenue follows 70/30 split to Folio Credit
- Shop engagement contributes to influence score
- Shop-originated purchases count toward Tier 2 transactions

---

## Related Documents

- 12_COMPENSATION_SYSTEM.md — Folio Credit and revenue splits
- 13_ATTRIBUTION_CONSENT.md — Vendor visibility and data access
- 04_USER_SYSTEM.md — Designer profile structure
- 06_EDITORIAL_SYSTEM.md — Quote extraction from interviews

# 16_COMPENSATION_SYSTEM

## Purpose
This document defines Folio's compensation and referral structures for product attribution, influence tracking, and transaction economics across all user types.

## Core Principle

Influence and transaction are decoupled. Designers create marketing value through tagging and engagement. Transaction value varies by purchaser type. These require separate compensation mechanisms.

## The Two-Tier Model

Folio operates a two-tier compensation system:

| Tier | What It Rewards | Funded By | When It Applies |
|------|-----------------|-----------|-----------------|
| **Tier 1: Influence** | Discovery, attribution, engagement | Vendor marketing allocations | Per-post, based on performance |
| **Tier 2: Transaction** | Completed purchases through Folio | Transaction spread or attribution fees | At checkout |

---

## Tier 1: Per-Post Marketing Allocations

### How It Works

Each published post becomes its own micro-campaign. When a designer tags vendor products:

1. Vendor receives notification: "You were tagged in [Designer]'s post"
2. Folio provides engagement data: saves, reach, time-on-image
3. Folio suggests contribution range based on performance
4. Vendor allocates marketing dollars to that specific post

### Folio's Role

Folio acts as marketing partner, not passive platform:

- "This post is performing in the top 20% for your category"
- "Suggested allocation: $75-150 based on engagement"
- "Increase allocation to boost visibility in feed/editorial"

### Distribution

| Recipient | Share | Condition |
|-----------|-------|-----------|
| Posting Designer | 90% | Default |
| Rep | 10% | When rep drove designer to post (attributed) |

### Why Per-Post Matters

- Vendors see direct ROI per post, not vague pooled spend
- High-performing designers naturally earn more
- Vendors can double down on what's working
- Creates ongoing relationship, not annual budget negotiation

### Phase 1 Implementation

Initially manual/email-based:
- Notification email includes suggested range
- Vendor responds with allocation
- Folio tracks and reports

Future: Automated allocation based on pre-set budgets and performance thresholds.

---

## Tier 2: Transaction Compensation

### Scenario Matrix

| Discovery | Purchaser | Spread Available | Model |
|-----------|-----------|------------------|-------|
| Designer A posts | Individual buys | Full (30-50% of retail) | Tier 2A |
| Designer A posts | Designer B buys for client | Near-zero (B expects trade) | Tier 2B |
| Designer A posts | Designer B buys direct from vendor | Zero (bypasses Folio) | Leakage—handled by Tier 1 |

---

### Tier 2A: Individual Checkout

The golden path. Full spread available for distribution.

**Example: $1,000 Retail Product**

```
Retail Price:     $1,000
Trade Price:      $600 (vendor's floor)
Spread:           $400 available

Distribution:
├── Posting Designer:  $200 (50% of spread) → Folio Credit
├── Folio:             $100 (25% of spread) → Revenue
└── Vendor:            $700 (trade + retained spread)
```

Individual pays retail. Everyone wins. This is the transaction to optimize for.

---

### Tier 2B: Designer Checkout (B2B)

Designer B expects trade pricing. No markup margin exists. But influence value still exists.

**The Insight**: Influence-driven B2B transactions are larger and more frequent. Vendors should pay for attribution data they've never had.

**Example: $10,000 Trade Order**

```
Trade Price:      $10,000
Designer B pays:  $10,000 (trade honored, no markup)

Attribution Fees:
├── Folio:             $300-500 (3-5%) → Revenue
├── Posting Designer:  $200-300 (2-3%) → Folio Credit
└── Vendor receives:   $9,200-9,500
```

**The Vendor Pitch**:

"You're paying 5-8% for something you'd pay a showroom 15-20% for, and you're getting attribution data that tells you exactly which designers move your product."

This is not margin capture—it's attribution pricing. The alternative (blind marketing) costs more and tells vendors nothing.

---

## Folio Credit Mechanism

### What It Is

Folio Credit is platform currency earned through influence that converts transactions.

- Earned when posts drive purchases (Tier 2A and 2B)
- Redeemable against designer's own purchases at trade pricing
- Can offset subscription costs
- Cannot be withdrawn as cash

### Why Credit, Not Cash

- Creates closed-loop economy
- Increases platform stickiness
- Aligns incentives: earn by participating, spend by staying
- Reduces cash flow complexity

### The Active Designer's Math

```
Monthly:
├── Subscription:                    -$50
├── Tier 1 allocations (2-3 posts):  +$100-300
├── Tier 2 influence credits:        +$50-200
└── Net:                             +$100-450 in Folio Credit
```

Credit can:
- Offset subscription entirely
- Be redeemed against trade purchases
- Accumulate toward larger purchases

---

## The Extraction Problem

### Worst Case: The Gaming Designer

Designer pays $50/month. They save inspiration, generate finish schedules, call reps directly for quotes and best prices.

### Why This Self-Solves

What extractors lose:
- Folio Credit earnings (could exceed subscription)
- Request Quote convenience (one-click vs. email chains)
- Vendor-driven traffic (vendors pushing TO Folio for attribution)
- Purchasing features (spec sheet generation, order tracking)
- Directory ranking (invisible to vendors, lower search results)
- Influence score (lower marketing allocations from vendors)

What extractors gain:
- ...the satisfaction of gaming a system?

### Gap Detection

Folio can observe:
```
Designer saves → specs in project → doesn't purchase → posts with product installed
```

We don't punish. We just don't reward. Directory position reflects actual ecosystem participation.

### The Status Incentive

"I could game this, but... I want to be #1 in my market. I want individuals to find me. I want vendors to see me as a top specifier."

The status reward for playing ball exceeds the marginal savings from extraction.

---

## Directory Ranking Signals

Designer directory position reflects ecosystem participation:

| Signal | Weight | Rationale |
|--------|--------|-----------|
| Post frequency + engagement | High | Visible contribution |
| On-platform transactions | High | Completing the loop |
| Profile completeness | Medium | Professionalism signal |
| Response rate to inquiries | Medium | Active participation |
| Vendor Visibility status | Low | Engagement willingness |
| Influence-to-transaction ratio | Modifier | Gap detection |

This is not punishment economy. It's boost for participation.

---

## Vendor Traffic Reversal

Once vendors see attribution value, behavior shifts:

- Rep to designer: "Make sure you tag us when you post"
- Vendor to Folio: "Which designers save but don't post our products?"
- Vendor marketing: "Folio-exclusive preview for designers who've tagged us 3+ times"

Vendors become a distribution channel, driving designers TO Folio for attribution. This flips acquisition cost.

---

## Implementation Phases

### Phase 1 (Current)
- Product tagging captures vendor + rep
- "You were tagged" notification with suggested allocation
- Manual allocation via email response
- Vendor Visibility toggle live

### Phase 2
- Checkout rails for Tier 2A and 2B
- Folio Credit ledger and redemption
- Request Quote flow through platform
- Automated allocation based on vendor budgets

### Phase 3
- Influence hierarchy mapping
- Automated gap detection
- Vendor analytics dashboards with specifier data
- Dynamic allocation recommendations

---

## Related Documents

- 13_ATTRIBUTION_CONSENT.md — What data vendors can see and consent requirements
- 04_USER_SYSTEM.md — Designer profile fields including Vendor Visibility
- 11_GO_TO_MARKET_SEQUENCING.md — Phase timing for feature rollout

# 16_ATTRIBUTION_CONSENT

## Purpose
This document defines what attribution data Folio collects, who can see it, and the consent architecture that governs data visibility between designers and vendors.

## Core Principle

A designer should never wonder why a vendor knows about their project. All attribution visibility is either:
1. Inherently public (posted content)
2. Implicit via transaction (purchase data)
3. Explicitly opted into (Vendor Visibility setting)

---

## Data Tiers

Folio categorizes attribution data into four tiers based on sensitivity and consent requirements.

### Tier A: Public Attribution

**What**: Designer posts completed project, tags products publicly.

**Consent**: None required. Designer chose to publish.

**Vendor Sees**:
- Designer name
- Project images and details
- Product tags
- Engagement metrics (saves, views, shares)
- Post reach and performance

**Use Cases**:
- Marketing allocation decisions
- Editorial feature consideration
- Public influence mapping

---

### Tier B: Transaction Attribution

**What**: Designer purchases through Folio checkout.

**Consent**: Implicit via purchase. Standard commerce data.

**Vendor Sees**:
- Designer name
- Product(s) purchased
- Purchase date
- Order amount
- Fulfillment details

**Use Cases**:
- Order fulfillment
- Relationship building
- Loyalty program qualification
- Purchase pattern analysis

**Note**: This is necessary transaction data. Designer understands purchase = vendor knows.

---

### Tier C: Engagement Attribution

**What**: Designer saves, likes, or engages with products without purchasing or posting.

**Consent**: Aggregate only by default. Individual identification requires Tier D opt-in.

**Vendor Sees (Default)**:
- "47 designers saved this product this month"
- "12 designers added to active projects"
- Aggregate engagement trends
- Category and style breakdowns

**Vendor Does NOT See (Default)**:
- Which specific designer saved
- Individual designer's private boards
- Unpublished project contents

**Rationale**: Aggregate is valuable market signal. Individual without consent is surveillance.

---

### Tier D: Specification Attribution

**What**: Designer is mid-project, has added products to private moodboard or spec list.

**Consent**: Explicit opt-in required via Vendor Visibility setting.

**Vendor Sees (When Opted In)**:
- Designer name
- "Actively specifying" flag
- Product(s) in active specification
- Project stage (if shared)

**Vendor Does NOT See**:
- Full project details
- Client information
- Budget or pricing
- Other vendors in same project

**Use Cases**:
- Proactive rep outreach
- Sample and support prioritization
- Appreciation event targeting
- Relationship development

---

## The Vendor Visibility Toggle

### Location
Designer Settings → Privacy → Vendor Visibility

### States

**OFF (Default)**:
- Saves and specs remain private until posted or purchased
- Vendors see aggregate data only (Tier C)
- Designer is invisible to proactive vendor outreach
- Designer does not appear in vendor "Top Specifiers" dashboards

**ON**:
- Vendors can see when designer is actively specifying their products
- Reps can reach out with samples, pricing, support
- Designer is eligible for vendor appreciation programs
- Designer appears in vendor specifier analytics
- Small boost to directory ranking

### UI Copy

Toggle Label: **"Vendor Visibility"**

Description:
> "Let vendors see when you're specifying their products. This unlocks appreciation events, priority samples, and rep support—but means vendors can reach out about your active projects."

### Value Exchange

The toggle makes the trade explicit:
- Designer gets: Appreciation, access, priority support, early previews
- Vendor gets: Warm lead identification, relationship opportunity
- Both understand: This is opt-in visibility, not surveillance

---

## What Vendors See: Summary Matrix

| Designer Action | Visibility OFF | Visibility ON |
|-----------------|----------------|---------------|
| Posts project with tags | Full attribution (Tier A) | Full attribution (Tier A) |
| Purchases through Folio | Transaction data (Tier B) | Transaction data (Tier B) |
| Saves product | Aggregate only | Name + "saved" flag |
| Adds to active project | Aggregate only | Name + "actively specifying" flag |
| Views product page | Aggregate only | Aggregate only |

---

## Vendor Influence Map

For vendors with active attribution data, Folio provides ranked influence visibility.

### Example Dashboard View

```
Your Top Specifiers (Last 90 Days)

1. Sarah Chen — 12 tags, 8 saves, 3 purchases, 847K reach
   Influence Score: 94 | Visibility: ON
   [View Profile] [Send Message]

2. Marcus Rivera — 8 tags, 14 saves, 2 purchases, 234K reach
   Influence Score: 78 | Visibility: ON
   [View Profile] [Send Message]

3. [Anonymous Designer] — 6 tags, 4 saves, 1 purchase, 156K reach
   Influence Score: 71 | Visibility: OFF

4. Jennifer Walsh — 5 tags, 2 saves, 0 purchases, 412K reach
   Influence Score: 65 | Visibility: ON
   ⚠️ High influence, low transaction — consider outreach
   [View Profile] [Send Message]
```

### What This Provides

- WHO is moving their products (with consent)
- WHAT the influence pattern looks like
- WHERE the gaps are (influence without transaction)
- HOW to prioritize relationship investment

### Privacy Protection

- Visibility-OFF designers show as "[Anonymous Designer]"
- Aggregate metrics visible, individual identity protected
- Vendors can see the signal without the name

---

## Transparency Mechanisms

### 1. Clear Toggle Explanation

At opt-in, designer sees full explanation of what visibility enables.

### 2. Attribution Badge on Outreach

When a rep messages through Folio:

```
┌─────────────────────────────────────────┐
│ Message from: Jake Williams             │
│ Rep at: Waterworks                      │
│                                         │
│ ℹ️ Reaching out because you're          │
│   specifying Waterworks products        │
│                                         │
│ [Message content...]                    │
└─────────────────────────────────────────┘
```

Designer sees exactly why vendor knows about their project.

### 3. Visibility Dashboard

Designer can review their exposure:

```
Your Vendor Visibility Status: ON

Your active specs are visible to:
├── Waterworks (3 products)
├── Ann Sacks (2 products)
├── Remains Lighting (1 product)
└── de Le Cuona (4 products)

[Manage Visibility] [Turn Off]
```

### 4. The "How Do They Know?" Prevention

Every vendor touchpoint traces back to explicit action:
- Posted content → Public, designer chose to share
- Purchase → Transaction data, expected
- Active spec → Visibility ON, designer opted in

No surprises. No surveillance feeling.

---

## Vendor Outreach Rules

Vendors with access to Visibility-ON designer data must:

1. **Use Folio messaging** for initial contact (tracked, attributed)
2. **State attribution reason** in outreach ("Reaching out because you're specifying...")
3. **Respect opt-out** if designer turns Visibility OFF
4. **Not export data** for use outside Folio ecosystem

Violations may result in restricted data access.

---

## Future Enhancements

### Per-Vendor Granularity (V2)

Instead of binary ON/OFF:
- "Show my specs to Waterworks but not to Restoration Hardware"
- Relationship-specific visibility
- Premium feature for Pro tier

### Per-Project Settings (V3)

- "This project is visible to vendors, that one isn't"
- Maximum control for sensitive projects
- Client-related privacy needs

### Implementation Priority

Phase 1: Binary toggle (current)
Phase 2: Per-vendor granularity
Phase 3: Per-project settings

Start simple, add sophistication based on demand.

---

## Legal Considerations

### Data Classification

- Tier A & B: Standard platform/commerce data
- Tier C: Aggregate analytics, no PII exposure
- Tier D: PII with explicit consent

### Consent Record

Folio logs:
- Timestamp of Visibility toggle changes
- State changes (ON → OFF, OFF → ON)
- Designer acknowledgment of terms

### GDPR/CCPA Compliance

- Clear consent mechanism
- Easy opt-out (toggle OFF)
- Data portability on request
- Deletion removes from vendor dashboards

---

## Related Documents

- 12_COMPENSATION_SYSTEM.md — How attribution drives compensation
- 04_USER_SYSTEM.md — Designer profile fields
- 09_LANGUAGE_AND_TASTE.md — Copy guidelines for consent UI

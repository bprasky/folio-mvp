# Data Flywheel Architecture

## Overview

Folio collects product usage data at multiple points in the design lifecycle. Each data point serves a different purpose in the platform flywheel, creating value for vendors, designers, and clients simultaneously.

```
                    ┌─────────────────────────────────────┐
                    │         PRESENTATION UPLOAD         │
                    │      (Original Design Intent)       │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   │
│   │    DESIGNER     │    │     PROJECT     │    │     FINAL       │   │
│   │   FINGERPRINT   │◄───│    EVOLUTION    │───►│    OUTCOME      │   │
│   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘   │
│            │                      │                      │             │
│            ▼                      ▼                      ▼             │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   │
│   │ Client Matching │    │ Journey Insights│    │ Vendor Analytics│   │
│   │ (Intent-Based)  │    │ (Who Changed    │    │ (Aggregate Data)│   │
│   │                 │    │  What & Why)    │    │                 │   │
│   └─────────────────┘    └─────────────────┘    └─────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The Three Data Layers

### 1. Original Design Intent (Presentation Layer)

**What it captures:** The designer's original vision before client feedback, budget constraints, or availability issues.

**Tables:**
- `presentation_products` - Products extracted from uploaded presentations
- `project_design_intent` - Style goals, material preferences, mood keywords

**Key insight:** This represents the designer's TRUE aesthetic preference, uncorrupted by external factors.

```
┌─────────────────────────────────────────────────────────┐
│ PRESENTATION UPLOAD                                     │
├─────────────────────────────────────────────────────────┤
│ • Products the designer WANTED to use                   │
│ • Style direction they were aiming for                  │
│ • Material palette they proposed                        │
│ • Budget tier they designed to                          │
└─────────────────────────────────────────────────────────┘
```

---

### 2. Designer Fingerprint (Pattern Layer)

**What it captures:** Accumulated patterns from a designer's body of work - their signature style, preferred brands, and typical product combinations.

**Tables:**
- `designer_product_affinity` - Products/brands/materials they use repeatedly
- `designer_pairings` - What products THIS designer combines together
- `designer_style_profile` - Aggregated style fingerprint

**Key insight:** The fingerprint reveals what a designer NATURALLY gravitates toward across many projects.

```
┌─────────────────────────────────────────────────────────┐
│ DESIGNER FINGERPRINT                                    │
├─────────────────────────────────────────────────────────┤
│ • Top brands: Artistic Tile (15%), Waterworks (12%)...  │
│ • Material mix: 35% stone, 25% tile, 20% wood...        │
│ • Style: 45% modern, 30% transitional...                │
│ • Signature pairings: Products they combine uniquely    │
│ • Delta from average: How unique is their style?        │
└─────────────────────────────────────────────────────────┘
```

---

### 3. Final Outcome (Result Layer)

**What it captures:** The actual products that ended up in completed projects, after all revisions.

**Tables:**
- `selections` - Final product selections
- `cached_products` - Product catalog with usage counts
- `product_pairings` - Aggregate pairing data across all designers
- `swap_patterns` - Common substitutions and why they happen

**Key insight:** Final outcomes reflect the COMPROMISE between designer intent, client preferences, and practical constraints.

```
┌─────────────────────────────────────────────────────────┐
│ FINAL OUTCOME                                           │
├─────────────────────────────────────────────────────────┤
│ • What actually got specified                           │
│ • Products that survived client review                  │
│ • Budget-adjusted selections                            │
│ • Engagement metrics (likes, saves, shares)             │
└─────────────────────────────────────────────────────────┘
```

---

## How Data Flows to Different Functions

### For Vendors: Aggregate Analytics

**Data sources:** Final outcomes + swap patterns + engagement metrics

Vendors don't need to know individual designer preferences. They need market-level intelligence:

| Metric | Source | Value to Vendor |
|--------|--------|-----------------|
| Total usage count | `cached_products.use_count` | Product popularity |
| Pairing data | `product_pairings` | "Often used with..." |
| Swap patterns | `swap_patterns` | Competitive insights |
| Engagement | `cached_product_stats` | Quality signal |
| Budget swaps | `swap_patterns.common_reasons` | Price sensitivity |

**Example insights for vendors:**
- "Your product was specified 47 times this quarter"
- "Designers often pair it with [Product X] in kitchens"
- "It gets swapped out for [Competitor Y] 30% of the time, usually for budget"
- "Projects using your product get 2.3x more saves than average"

---

### For Designer-Client Matching: Intent-Based

**Data sources:** Original design intent + designer fingerprint (NOT final outcomes)

**Why intent matters more than outcomes:**

```
┌─────────────────────────────────────────────────────────┐
│ THE MATCHING PROBLEM                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Designer A's Portfolio (Final Outcomes):               │
│  └─► Shows: Mid-range traditional kitchens              │
│                                                         │
│  Designer A's Fingerprint + Intent:                     │
│  └─► Shows: Luxury modern preference, often compromised │
│             by budget-conscious clients                 │
│                                                         │
│  Client B wants: Luxury modern kitchen                  │
│                                                         │
│  ❌ Portfolio matching: No match (wrong style shown)    │
│  ✅ Intent matching: Perfect match (hidden capability)  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Matching algorithm inputs:**
1. `project_design_intent.style_goals` - What style do they propose?
2. `project_design_intent.budget_tier` - What tier do they design to?
3. `designer_style_profile.material_breakdown` - Natural material preferences
4. `designer_style_profile.top_brands` - Quality/tier indicator
5. `designer_pairing_deltas` - Unique design voice

**NOT used for matching:**
- Final project images (corrupted by client influence)
- Engagement metrics (popularity ≠ fit)
- Final selections (may reflect constraints, not ability)

---

### For Journey Insights: Decision Attribution

**Data sources:** All three layers compared

By comparing presentation → fingerprint → final, we can infer:

| Comparison | Inference |
|------------|-----------|
| Presentation ≠ Final, Fingerprint = Final | Designer adjusted to their comfort zone |
| Presentation ≠ Final, Fingerprint ≠ Final | Client pushed for changes |
| Presentation = Final, cheaper products | Budget constraint |
| Common swap pattern | Known substitution (availability, budget) |

**Tables:**
- `selection_history` - Changelog when changes are tracked
- `project_design_journey` - Aggregated journey summary

**Example insights:**
- "40% of changes in this project were budget-driven"
- "Client influenced 6 of 12 product decisions"
- "Designer's original vision was 85% preserved"

---

## The Flywheel in Action

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           THE FOLIO FLYWHEEL                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐                              ┌──────────────┐        │
│  │   DESIGNER   │                              │    VENDOR    │        │
│  │   uploads    │                              │    claims    │        │
│  │ presentation │                              │   products   │        │
│  └──────┬───────┘                              └───────▲──────┘        │
│         │                                              │               │
│         ▼                                              │               │
│  ┌──────────────┐    Intent-based matching    ┌───────┴──────┐        │
│  │   INTENT     │◄────────────────────────────│   AGGREGATE  │        │
│  │   captured   │                             │     DATA     │        │
│  └──────┬───────┘                             └───────▲──────┘        │
│         │                                              │               │
│         ▼                                              │               │
│  ┌──────────────┐    Fingerprint builds       ┌───────┴──────┐        │
│  │   PROJECT    │────────────────────────────►│    FINAL     │        │
│  │   evolves    │                             │   OUTCOMES   │        │
│  └──────┬───────┘                             └───────▲──────┘        │
│         │                                              │               │
│         ▼                                              │               │
│  ┌──────────────┐    Journey insights         ┌───────┴──────┐        │
│  │   CLIENT     │◄────────────────────────────│   DECISION   │        │
│  │   matched    │    (who changed what)       │  ATTRIBUTION │        │
│  └──────────────┘                             └──────────────┘        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Each rotation creates more value:

1. **Designer uploads** → Intent captured → Better client matching
2. **Project evolves** → Fingerprint sharpens → More accurate recommendations
3. **Products specified** → Aggregate data grows → Vendor insights improve
4. **Vendor claims products** → Better product data → Improved matching
5. **Better matching** → Happier clients → More projects → More data

---

## Database Tables by Function

### Vendor Analytics (Aggregate)
```
cached_products          → Product catalog with usage metrics
product_pairings         → What products are used together
cached_product_stats     → Engagement aggregates
swap_patterns            → Substitution intelligence
brand_registry           → Vendor claiming & brand data
```

### Designer Fingerprint (Individual)
```
designer_product_affinity → Brand/material/style preferences
designer_pairings         → Individual pairing patterns
designer_style_profile    → Computed fingerprint
designer_pairing_deltas   → Comparison to aggregate (view)
```

### Design Intent (Original)
```
presentation_products     → Products from uploaded presentations
project_design_intent     → Style goals, mood, budget tier
```

### Journey Tracking (Evolution)
```
selection_history         → Changelog of all changes
project_design_journey    → Summary: original vs final
swap_patterns.common_reasons → Why substitutions happen
```

---

## Key Principles

1. **Intent ≠ Outcome**: A designer's portfolio shows compromises, not capabilities. Match on intent.

2. **Individual ≠ Aggregate**: Designer fingerprints are private intelligence. Vendor data is anonymized aggregate.

3. **Changes reveal truth**: The delta between presentation and final tells us who influenced the design.

4. **Every data point serves multiple masters**: One product import feeds vendor analytics, designer fingerprints, AND journey tracking simultaneously.

5. **The flywheel compounds**: More usage → better matching → more projects → more data → better matching.

---

## Privacy & Data Boundaries

| Data | Visible to Designer | Visible to Vendor | Visible to Client |
|------|--------------------|--------------------|-------------------|
| Their own fingerprint | ✅ Full detail | ❌ Never | ❌ Never |
| Aggregate patterns | ✅ Anonymized | ✅ Anonymized | ❌ No |
| Their project journey | ✅ Full detail | ❌ Never | ⚠️ Summary only |
| Product usage counts | ✅ Yes | ✅ Yes (their products) | ❌ No |
| Swap patterns | ✅ Anonymized | ✅ Their products only | ❌ No |

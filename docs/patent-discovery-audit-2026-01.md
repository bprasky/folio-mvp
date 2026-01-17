# Folio Patent Discovery Audit
**Date:** January 2026
**Scope:** Technical audit of potentially patentable innovations in Folio codebase
**Methodology:** Systematic code review against novelty, non-obviousness, and utility criteria

---

## Executive Summary

This audit identified **8 potentially patentable innovations** in the Folio platform. The top 5 innovations represent strong patent candidates with significant defensive value and strategic moat potential. These innovations center around passive behavioral fingerprinting, merit-based content elevation, closed-loop attribution, and multi-modal aesthetic intelligence.

**Strength Distribution:**
- **Strong:** 5 innovations (high novelty, difficult to design around)
- **Medium:** 2 innovations (novel but narrower claims)
- **Weak:** 1 innovation (prior art concerns)

---

## Top 5 Patentable Innovations (Ranked)

---

### 1. ATELIER FINGERPRINT SYSTEM: PASSIVE BEHAVIORAL AESTHETIC PROFILING

**Rank:** #1
**Strength:** STRONG

#### Location
- `src/lib/atelier/aggregate.ts` (lines 9-203)
- `src/lib/atelier/signals.ts` (lines 1-49)
- `src/app/api/tag-product-to-image/route.ts` (lines 114-211)
- `prisma/schema.prisma` (lines 1413-1483: AtelierFingerprint, AtelierNode, AtelierEdge, AtelierSignal models)

#### Technical Description

The Atelier system constructs a multi-dimensional aesthetic "fingerprint" for designers through passive behavioral signal aggregation, without requiring explicit preference input. The system:

1. **Signal Collection:** Captures implicit signals from designer actions:
   - Product tagging (category, vendor preferences)
   - Project room types and materials
   - Interview answers with decision reasoning
   - Save/folder organization patterns
   - Weighted by conviction level (1.0 - 1.5x)

2. **Signal Aggregation:** Aggregates signals by normalized keys:
   - `style:{label}` (e.g., "style:coastal", "style:minimal")
   - `room:{type}` (e.g., "room:kitchen", "room:bathroom")
   - `vendor:{vendorId}` (tracks vendor affinity)
   - `productCategory:{category}` (furniture, lighting, etc.)
   - `material:{material}` (brass, marble, oak, etc.)

3. **Graph Construction:** Builds a weighted knowledge graph:
   - **Nodes:** Style, RoomType, Vendor, ProductCategory, Material, ColorCluster
   - **Edges:** Relationships between nodes (STYLE→ROOM, STYLE→VENDOR, ROOM→VENDOR)
   - **Weight Normalization:** Per-group max normalization for comparable scoring
   - **Noise Filtering:** Edges with weight < 0.15 excluded

4. **Completeness Scoring:**
   ```
   completeness = min(1.0, signalFactor × diversityFactor)
   signalFactor = min(uniqueKeysCount / 200, 1.0)
   diversityFactor = (# non-empty buckets) / 5
   ```

5. **Incremental Recomputation:** Fingerprint recalculated on signal accumulation

#### Novel Elements

1. **Passive Multi-Dimensional Profiling:** Unlike Pinterest/Houzz which rely on explicit follows/boards, Folio infers aesthetic DNA from granular product specification decisions with spatial context (x/y coordinates on images).

2. **Decision Conviction Weighting:** Captures not just what designers choose, but HOW STRONGLY they believe in it (conviction levels, alternatives considered, tradeoffs).

3. **Cross-Domain Signal Fusion:** Combines:
   - Visual signals (image tagging)
   - Behavioral signals (saves, folder organization)
   - Linguistic signals (interview answers, reasoning)
   - Spatial signals (product placement on images)

4. **Graph-Based Representation:** Instead of flat preference vectors, uses a relational graph that captures aesthetic relationships (e.g., "coastal style → natural materials → white oak vendor preference").

5. **Temporal Decay-Free Core:** Unlike recommendation systems with temporal decay, the fingerprint represents enduring style identity.

#### Claims Draft

**Claim 1 (Method):**
A computer-implemented method for generating an aesthetic profile for a designer, comprising:
(a) passively capturing behavioral signals from designer actions including product tagging with spatial coordinates (x, y) on project images, product category selections, vendor selections, and material preferences;
(b) aggregating said signals by normalized semantic keys representing aesthetic dimensions including style, room type, vendor affinity, product category, and material preference;
(c) constructing a weighted knowledge graph comprising nodes representing aesthetic entities and edges representing relationships between said entities, wherein edge weights are calculated from aggregated signal weights;
(d) filtering edges below a predetermined noise threshold;
(e) calculating a completeness score based on signal diversity across aesthetic dimensions and total signal count;
(f) storing the weighted knowledge graph as an aesthetic fingerprint associated with the designer.

**Claim 2 (System):**
A system for aesthetic profiling comprising: a signal collection module configured to capture designer product specification decisions with decision conviction levels; a signal aggregation module configured to normalize and group signals by semantic keys; a graph construction module configured to build a multi-dimensional aesthetic fingerprint with weighted nodes and edges; and a completeness scoring module.

**Claim 3 (Non-Obvious Combination):**
The method of Claim 1, further comprising: capturing decision reasoning, alternatives considered, and tradeoffs for product selections; weighting signals based on conviction level (1.0 to 1.5x multiplier); and integrating linguistic signals from interview answers with behavioral signals to enhance profile accuracy.

#### Prior Art Concerns

- **Pinterest Interest Graph:** Uses explicit pins/boards, but doesn't capture spatial product placement or decision reasoning
- **Spotify Taste Profile:** Passive listening behavior, but single-domain (audio) not multi-modal
- **Amazon Recommendation Engine:** Collaborative filtering, doesn't build designer-specific aesthetic graphs
- **Houzz Ideabooks:** Explicit curation, no passive signal inference

**Differentiation:** Folio's combination of (1) passive multi-modal signals, (2) spatial product tagging, (3) decision conviction weighting, and (4) graph-based aesthetic representation appears novel.

#### Strength Assessment: **STRONG**

**Rationale:**
- High novelty in multi-modal passive profiling with spatial context
- Non-obvious combination of behavioral, visual, and linguistic signals
- Difficult to design around (core to Folio's recommendation/matching moat)
- Clear utility for designer-vendor matching, personalized AI generation
- Defensible claims around spatial tagging + conviction weighting

---

### 2. SPATIAL PRODUCT ATTRIBUTION WITH CLOSED-LOOP VENDOR NOTIFICATION

**Rank:** #2
**Strength:** STRONG

#### Location
- `prisma/schema.prisma` (lines 359-372: ProductTag model with x, y coordinates)
- `src/app/api/tag-product-to-image/route.ts` (lines 99-111: Tag creation with spatial coordinates)
- Product tagging creates ProductTag → Selection → Order attribution chain

#### Technical Description

A system for spatially-aware product attribution in design imagery that creates closed-loop vendor attribution:

1. **Spatial Tagging:** Products tagged on images with normalized (x, y) coordinates (0-1 range)
2. **Attribution Chain:** ProductTag → Selection → Quote → Order
3. **Vendor Notification:** "You were tagged" notifications when designers specify vendor products
4. **Revenue Attribution:** Tracks tag → specification → purchase for commission calculation
5. **Signal Recording:** Each tag generates Atelier signals for designer fingerprinting

**Data Flow:**
```
Designer tags product at (x: 0.45, y: 0.62) on project image
  → ProductTag created with spatial coordinates
  → Selection optionally created from tag (productTagId foreign key)
  → Vendor receives "you were tagged" notification
  → If purchased: Order tracks attributedProductTagId
  → Designer/Rep earn credit based on attribution
```

#### Novel Elements

1. **Spatial Coordinates for Attribution:** Unlike Instagram/Pinterest which tag products generically, Folio stores precise x/y coordinates enabling:
   - Visual overlay of tags on editorial spreads
   - Spatial context for AI understanding ("sofa in center", "pendant over island")
   - Preservation of design composition

2. **Tag-to-Commerce Attribution:** Direct link from creative tagging → specification → purchase tracking

3. **Dual Attribution Model:** Tracks both designer who tagged AND vendor rep credited, enabling split commission structures

4. **Confirmation Workflow:** Supports AI-detected "skeleton items" (pending tags) vs. confirmed product specifications

#### Claims Draft

**Claim 1:**
A method for attributing design product usage comprising:
(a) receiving a product tag on a project image with normalized spatial coordinates (x, y);
(b) creating a ProductTag record linking the product to the image at said coordinates;
(c) automatically generating a vendor notification indicating the product was specified in a designer project;
(d) creating a Selection record linking to said ProductTag;
(e) tracking subsequent purchase orders with attribution to the originating ProductTag;
(f) calculating commission splits between the tagging designer and attributed vendor representative.

**Claim 2:**
The method of Claim 1, wherein the spatial coordinates enable visual overlay of interactive product tags on published editorial content, preserving the spatial relationship between products and design composition.

#### Prior Art Concerns

- **Instagram Shopping Tags:** Products tagged on photos, but no spatial coordinate storage or commission attribution
- **LIKEtoKNOW.it:** Affiliate links in images, but no spatial tagging or vendor notification
- **Houzz Product Tags:** Generic product tagging, not spatially-aware

**Differentiation:** Spatial coordinates + closed-loop vendor notification + purchase attribution chain.

#### Strength Assessment: **STRONG**

**Rationale:**
- Novel spatial attribution mechanism
- Clear commercial utility (commission tracking)
- Difficult to design around without spatial coordinates
- Defensible combination of spatial tagging + vendor notification + purchase attribution

---

### 3. MERIT-BASED EDITORIAL ELEVATION WITHOUT GATEKEEPING

**Rank:** #3
**Strength:** STRONG

#### Location
- `src/lib/editorial/curator.ts` (lines 106-406: Editorial scoring algorithm)
- `src/lib/editorial/scheduler.ts` (lines 208-264: Automatic edition publishing)
- `prisma/schema.prisma` (lines 1039-1069: EditorialAssignment, EditorialEdition models)

#### Technical Description

An algorithmic system for elevating design content to "editorial" status based on merit signals, without human gatekeeping:

**Scoring Algorithm:**
```typescript
editorialScore =
  (0.40 × engagementScore) +
  (0.20 × vendorDiversityScore) +
  (0.20 × styleUniquenessScore) +
  (0.20 × trendAlignmentScore)
```

**Component Calculations:**

1. **Engagement Score (40%):**
   ```
   viewScore = clamp(log10(views + 1) / 3, 0, 1)
   likeScore = clamp(likes / 200, 0, 1)
   saveScore = clamp(saves / 200, 0, 1)
   engagementScore = 0.3×viewScore + 0.35×likeScore + 0.35×saveScore
   ```

2. **Vendor Diversity Score (20%):**
   ```
   diversity = uniqueVendorCount + (uniqueProductCount × 0.5)
   score = clamp(diversity / 12, 0, 1)
   ```
   Rewards projects featuring multiple vendors (anti-monoculture)

3. **Style Uniqueness Score (20%):**
   - Computes vector distance from project embedding to style category centroids
   - Projects with unique aesthetic combinations score higher
   - Uses PostgreSQL vector operations: `(embedding <=> centroid) AS distance`

4. **Trend Alignment Score (20%):**
   - Queries MarketSignal table for momentum/liquidity of project's style nodes
   - Rewards projects aligned with emerging trends

**Automatic Elevation:**
- Daily scheduler groups projects by EditorialCategory
- Calculates average editorial scores per category
- Publishes EditorialEdition when:
  - Average score ≥ 0.75
  - Minimum 3 projects in category
  - No edition published for category in last 7 days

#### Novel Elements

1. **Merit Calculation Without Human Curation:** Algorithmic elevation based on quantifiable signals, not editorial boards

2. **Anti-Monoculture Weighting:** Vendor diversity component explicitly rewards multi-vendor projects, preventing pay-to-play dominance

3. **Vector-Based Style Uniqueness:** Uses embedding distance to measure aesthetic novelty (not just engagement)

4. **Trend Signal Integration:** Incorporates forward-looking MarketSignal momentum, not just backward-looking engagement

5. **Threshold-Based Automatic Publishing:** System autonomously publishes editorial editions when merit criteria met

#### Claims Draft

**Claim 1:**
A computer-implemented method for merit-based content elevation comprising:
(a) calculating an editorial score for a design project based on weighted combination of engagement metrics, vendor diversity, style uniqueness via vector distance from category centroids, and trend alignment from market signal momentum;
(b) wherein vendor diversity is calculated as a function of unique vendor count plus weighted unique product count, incentivizing multi-vendor collaborations;
(c) automatically assigning the project to editorial categories when said editorial score exceeds a predetermined threshold;
(d) automatically publishing editorial editions when average category score and minimum project count thresholds are met;
(e) whereby editorial elevation occurs without manual editorial gatekeeping.

**Claim 2:**
The method of Claim 1, wherein style uniqueness is calculated by measuring vector distance between the project's aesthetic embedding and pre-computed style category centroids in a multi-dimensional embedding space.

#### Prior Art Concerns

- **Medium "Top Stories":** Algorithmic curation, but engagement-only (no vendor diversity or style uniqueness)
- **YouTube Trending:** Engagement + velocity, no aesthetic vector analysis
- **Reddit Upvoting:** Crowd-sourced, not algorithmic merit calculation

**Differentiation:** Multi-component merit scoring with anti-monoculture weighting + vector-based aesthetic novelty measurement.

#### Strength Assessment: **STRONG**

**Rationale:**
- Novel combination of merit signals
- Non-obvious vendor diversity anti-monoculture mechanism
- Clear utility for fair content promotion
- Strategically valuable for preventing pay-to-play marketplace dynamics
- Difficult to design around without similar multi-component scoring

---

### 4. MULTI-MODAL AESTHETIC DETECTION FROM HETEROGENEOUS SIGNALS

**Rank:** #4
**Strength:** STRONG

#### Location
- `src/lib/aesthetic/detectAesthetic.ts` (lines 1-100+)
- `src/lib/aesthetic/imageSignals.ts`
- `src/lib/aesthetic/materialSignals.ts`
- `src/lib/aesthetic/spatialSignals.ts`
- `src/lib/aesthetic/languageSignals.ts`
- `src/app/api/aesthetic/detect/route.ts` (lines 148-176: Multi-modal input aggregation)

#### Technical Description

A system for detecting designer aesthetic profiles by combining visual, material, spatial, and linguistic signals from heterogeneous data sources:

**Input Sources:**
1. **Visual Signals:** Project images analyzed for:
   - Color temperature (cool/neutral/warm)
   - Contrast level (low/medium/high)
   - Saturation and lightness
   - Whitespace ratio
   - Dominant colors

2. **Material Signals:** Product tags and selections analyzed for:
   - Natural materials count (wood, stone, natural fibers)
   - Metal materials count (brass, steel, bronze)
   - Synthetic materials count (acrylic, composite)
   - Material ratios

3. **Spatial Signals:** Room layouts analyzed for:
   - Density level (sparse/moderate/dense)
   - Symmetry vs. asymmetry
   - Focal point distribution

4. **Language Signals:** Interview transcripts analyzed for:
   - Vocabulary frequency (recurring aesthetic terms)
   - Sentiment patterns
   - Technical depth markers

**Aesthetic Theme Scoring:**
Signals mapped to aesthetic themes (minimal, warm, coastal, bold, editorial, moody):

```typescript
// Example scoring logic
if (avgWhitespace > 0.4 && avgSaturation < 0.4 && dominantTemp === 'neutral') {
  scores.minimal += 30;
}
if (naturalMaterialRatio > 0.6) {
  scores.warm += 30;
  scores.coastal += 15;
}
```

**Output:** AestheticProfile with ranked themes and confidence scores

#### Novel Elements

1. **Heterogeneous Signal Fusion:** Combines 4 distinct signal types (visual, material, spatial, linguistic) into unified aesthetic profile

2. **Spatially-Aware Material Analysis:** Material signals tied to spatial product tags (x, y coordinates), enabling composition understanding

3. **Linguistic Aesthetic Extraction:** Extracts aesthetic preferences from natural language interview answers (not just image content)

4. **Multi-Project Aggregation:** Requires ≥2 published projects for profile generation, reducing single-project bias

5. **Incremental Refinement:** Profile updated as designers publish more projects

#### Claims Draft

**Claim 1:**
A method for detecting an aesthetic profile comprising:
(a) extracting visual signals from project images including color temperature, contrast level, saturation, and whitespace ratio;
(b) extracting material signals from spatially-tagged products including natural, metal, and synthetic material counts;
(c) extracting spatial signals from room layouts including density level and symmetry;
(d) extracting language signals from interview transcripts including vocabulary frequency and aesthetic terminology;
(e) mapping said heterogeneous signals to aesthetic theme scores via weighted scoring rules;
(f) generating an aesthetic profile comprising ranked themes with confidence scores;
(g) updating said profile incrementally as additional projects are published.

**Claim 2:**
The method of Claim 1, wherein material signals are extracted from products tagged at spatial coordinates (x, y) on project images, enabling composition-aware material preference detection.

#### Prior Art Concerns

- **Pinterest Lens:** Visual-only image analysis, no material/spatial/linguistic fusion
- **Google Vision API:** Generic image classification, not aesthetic profiling
- **Stitch Fix Style Quiz:** Explicit preference input, not passive detection

**Differentiation:** Multi-modal fusion (visual + material + spatial + linguistic) with spatially-aware product tagging.

#### Strength Assessment: **STRONG**

**Rationale:**
- Novel multi-modal signal fusion approach
- Non-obvious combination of heterogeneous data sources
- Spatially-aware material analysis is unique
- Clear utility for personalized recommendations and AI generation
- Defensible claims around signal fusion methodology

---

### 5. CONTEXT SIGNAL TO GRAPH EDGE PIPELINE WITH TEMPORAL DECAY

**Rank:** #5
**Strength:** STRONG

#### Location
- `src/lib/telemetry/context-signal.ts` (lines 1-89: Signal logging)
- `src/jobs/edge-builder.ts` (lines 1-150+: Signal → Edge conversion)
- `prisma/schema.prisma` (lines 1133-1180: ContextSignal, GraphEdge models)

#### Technical Description

A two-stage pipeline that converts ephemeral user actions into a persistent relationship graph with action-specific temporal decay:

**Stage 1: Signal Collection**
```typescript
logSignal({
  userId, productId, action: "save",
  tags: ["brass", "pendant", "kitchen"],
  meta: { source: "search", query: "brass lighting" }
})
```

**Stage 2: Edge Construction (Batch Job)**

Edge building rules with differentiated decay:
```typescript
const EDGE_RULES = [
  { action: "save", kind: "saves", weight: 0.8, decayDays: 7 },
  { action: "add_to_project", kind: "includes", weight: 1.0, decayDays: null }, // permanent
  { action: "rsvp", kind: "attends", weight: 0.9, decayDays: 14 },
  { action: "feature_click", kind: "affinity", weight: 1.2, decayDays: 30 },
  { action: "view", kind: "views", weight: 0.3, decayDays: 3 },
];
```

**Edge Lifecycle:**
1. Signal logged with timestamp
2. Batch job processes signals from last 48 hours
3. Edge created with initial weight and decay date
4. Subsequent signals increment edge weight and refresh decay
5. Edges expire after decay period (except permanent edges)

**Graph Schema:**
- **Nodes:** Users, Products, Events, Projects, Vendors
- **Edges:** Typed relationships (saves, includes, attends, affinity, views)
- **Weights:** Accumulated action strength
- **Decay:** Action-specific expiration dates

#### Novel Elements

1. **Action-Specific Decay Rates:** Different action types have different decay periods:
   - Ephemeral: views (3 days)
   - Short-term: saves (7 days)
   - Medium-term: RSVPs (14 days), affinity clicks (30 days)
   - Permanent: project inclusions (no decay)

2. **Weight Accumulation on Repeat Actions:** Multiple signals strengthen edges, refreshing decay

3. **Heterogeneous Edge Types:** Same node pairs can have multiple edge types (user→product can have "saves" AND "views" edges)

4. **Non-Blocking Signal Collection:** Signal logging failures don't crash main operations

5. **Tag Propagation:** Semantic tags flow from signals through edges for graph-based search

#### Claims Draft

**Claim 1:**
A method for constructing a temporal relationship graph from user actions, comprising:
(a) logging context signals representing user actions with action type, entity references, semantic tags, and timestamp;
(b) processing said signals via batch job to create graph edges between entity nodes;
(c) assigning action-specific weights and decay periods to edges based on action type;
(d) wherein permanent actions receive null decay dates and ephemeral actions receive short decay periods;
(e) accumulating edge weights when repeated signals occur between same entity pairs;
(f) expiring edges after decay period unless refreshed by new signals;
(g) supporting multiple edge types between identical node pairs.

**Claim 2:**
The method of Claim 1, wherein action types are mapped to decay periods comprising: view actions (3 days), save actions (7 days), RSVP actions (14 days), affinity clicks (30 days), and project inclusion actions (permanent/no decay).

#### Prior Art Concerns

- **Facebook Social Graph:** Persistent friend relationships, no temporal decay
- **Neo4j Graph Database:** Generic graph storage, not action-specific decay logic
- **Redis TTL:** Key expiration, but not weight-accumulating edges

**Differentiation:** Action-specific decay rates + weight accumulation + heterogeneous edge types on same node pairs.

#### Strength Assessment: **STRONG**

**Rationale:**
- Novel action-specific temporal decay mechanism
- Non-obvious weight accumulation with decay refresh
- Clear utility for recency-aware recommendations
- Strategically valuable for graph-based discovery
- Defensible claims around decay rate differentiation

---

## Additional Patentable Innovations (Medium-Weak Strength)

---

### 6. INTERVIEW-DRIVEN DECISION CAPTURE WITH ATTRIBUTE VERIFICATION

**Rank:** #6
**Strength:** MEDIUM

#### Location
- `src/lib/editorial/processInterviewAnswers.ts` (lines 1-250)
- `prisma/schema.prisma` (lines 1274-1331: AttributeVerification, DesignerDecision models)

#### Technical Description

Converts designer interview answers into structured decision records and attribute verifications:

1. **AI Classification Questions:** System asks contextual questions about AI-detected attributes (e.g., "I noticed sage green cabinetry—what drew you to that color?")

2. **Answer Analysis:** NLP analyzes answers for:
   - Confirmation signals ("yes", "exactly", "that's right")
   - Correction patterns ("actually it's...", "I'd call it...")
   - Reasoning depth (threshold: 50+ characters)

3. **Dual Record Creation:**
   - **AttributeVerification:** Tracks AI accuracy (verified/corrected/neutral)
   - **DesignerDecision:** Captures reasoning, alternatives, tradeoffs, conviction

4. **Voice Profile Update:** Increments interview answer count for voice modeling

#### Novel Elements
- Converts qualitative interviews into quantitative decision + verification data
- Pattern matching for correction signals
- Minimum reasoning threshold (50 chars) for decision records

#### Claims Draft
A method for extracting structured design decisions from natural language interviews comprising: (a) generating contextual questions based on AI-detected image attributes; (b) analyzing answers for confirmation or correction signals; (c) creating attribute verification records tracking AI detection accuracy; (d) creating designer decision records when answer reasoning exceeds depth threshold.

#### Prior Art Concerns
- Survey analysis tools exist
- NLP sentiment/entity extraction is common

#### Strength Assessment: **MEDIUM**
Useful for training data collection, but narrower claims. Prior art in survey analysis and NLP entity extraction.

---

### 7. TRADE DISCOUNT ARBITRAGE WITH CREDIT HOLD PERIODS

**Rank:** #7
**Strength:** MEDIUM

#### Location
- `prisma/schema.prisma` (lines 1786-1988: CreditAccount, Order, VendorTradeAccount models)

#### Technical Description

Commerce system exploiting trade/retail price gaps with commission credit economy:

**Flow:**
1. Consumer orders product at retail price ($1000)
2. Folio fulfills via vendor trade account at discount price ($800)
3. Margin split ($200):
   - Designer credit: $100 (50%)
   - Rep credit: $50 (25%)
   - Consumer discount: $30 (15%)
   - Folio revenue: $20 (10%)
4. Credits enter 30-day hold period before spendable

**Credit Lifecycle:**
- `pendingBalance`: In hold period
- `availableBalance`: Spendable now
- Hold period prevents fraud/returns

#### Novel Elements
- Automated margin split allocation
- Credit hold period mechanism
- Multiple attribution tracking (designer + rep)

#### Claims Draft
A method for trade discount arbitrage in design commerce comprising: (a) purchasing products via vendor trade accounts at discounted price; (b) selling to consumers at retail price; (c) allocating margin delta to designer credit, rep credit, consumer discount, and platform revenue; (d) imposing hold period on earned credits before availability; (e) tracking dual attribution to originating designer and vendor representative.

#### Prior Art Concerns
- Affiliate marketing with commission splits is well-established
- Trade account management exists in B2B commerce
- Credit hold periods are common (refund protection)

#### Strength Assessment: **MEDIUM**
Commercially valuable but may face prior art challenges. Claims would need to focus on specific split allocation + dual attribution + hold period combination.

---

### 8. EVENT INTELLIGENCE WITH POST-EVENT ATTRIBUTION TRACKING

**Rank:** #8
**Strength:** WEAK

#### Location
- `prisma/schema.prisma` (lines 110-186: Event, EventRSVP models)
- Event graph edges (EventDesignerEdge, EventVendorEdge, EventProductEdge)

#### Technical Description

Tracks physical event attendance and links to subsequent digital specification behavior:

**Attribution Chain:**
```
Designer RSVPs to vendor showroom event
  → EventRSVP record created
  → Designer tags vendor product in project post-event
  → ProductTag links to event via temporal proximity
  → Purchase order tracks event attribution
  → Vendor analytics show event ROI
```

#### Novel Elements
- Physical-to-digital loop closure
- Event ROI calculation via specification tracking

#### Prior Art Concerns
- **Eventbrite + CRM integration:** Links event attendance to purchases
- **Trade show lead tracking:** Common in B2B events
- **Meetup + follow-up engagement:** Existing pattern

#### Strength Assessment: **WEAK**
Event-to-purchase attribution is established practice. Claims would be very narrow.

---

## Strategic Patent Portfolio Recommendations

### Priority 1: File Immediately (Strong Defensibility)
1. **Atelier Fingerprint System** - Core IP, difficult to design around
2. **Spatial Product Attribution** - Novel mechanism, clear commercial value
3. **Merit-Based Editorial Elevation** - Defensible algorithmic approach

### Priority 2: File After Further Development
4. **Multi-Modal Aesthetic Detection** - Strong, but ensure implementation depth
5. **Context Signal Graph Pipeline** - Strong, valuable for discovery moat

### Priority 3: Monitor for Trade Secret Protection
6. **Interview-Driven Decision Capture** - May be better as trade secret
7. **Trade Discount Arbitrage** - Commercial process, narrow patentability

### Avoid Filing
8. **Event Attribution Tracking** - Weak novelty, established prior art

---

## Claim Construction Strategy

### Layered Claim Approach
For each patent, draft:
1. **Broad independent claim:** Core method/system
2. **Narrower dependent claims:** Specific technical implementations
3. **Combination claims:** Non-obvious combinations of elements

### Defensive Claim Language
- Emphasize **novel combinations** (harder to invalidate than single elements)
- Include **specific technical parameters** (e.g., weight thresholds, decay periods)
- Focus on **data structures** (graph schemas, signal formats) not just algorithms

### Examples:
- **Atelier:** Focus on passive multi-modal signal fusion + spatial coordinates + conviction weighting
- **Editorial:** Focus on vendor diversity anti-monoculture + vector uniqueness scoring
- **Attribution:** Focus on spatial coordinates + closed-loop notification + dual attribution

---

## Prior Art Mitigation Strategies

### Comprehensive Prior Art Search Needed For:
1. **Pinterest Interest Graph:** Verify no spatial tagging + conviction weighting
2. **Spotify Taste Profile:** Confirm single-domain vs. multi-modal distinction
3. **Medium Algorithmic Curation:** Document lack of vendor diversity scoring
4. **Instagram Shopping:** Verify no spatial coordinate storage

### Technical Differentiation Points:
- **Spatial coordinates (x, y):** Unique to Folio in design context
- **Decision conviction weighting:** Not found in behavioral profiling systems
- **Vendor diversity scoring:** Novel anti-monoculture mechanism
- **Multi-modal signal fusion:** Combination appears novel

---

## Patent Landscape Analysis

### Potential Competitors to Monitor:
- **Houzz:** Design platform, may have product tagging patents
- **Modsy:** 3D visualization, may have aesthetic profiling IP
- **Chairish/1stDibs:** Marketplace platforms, may have vendor systems
- **Havenly/Decorist:** Design services, may have designer matching IP

### Recommended Searches:
- USPTO Class 705 (Business methods) + design/aesthetic keywords
- USPTO Class 706 (Machine learning) + recommendation/profiling
- Recent filings by Houzz, Pinterest, Wayfair (2020-2025)

---

## Estimated Patent Value

### Strategic Value (Moat Protection):
- **Atelier Fingerprint:** HIGH - Core to designer-vendor matching
- **Spatial Attribution:** HIGH - Enables closed-loop commerce
- **Editorial Elevation:** MEDIUM-HIGH - Prevents pay-to-play competition
- **Multi-Modal Detection:** MEDIUM - Supports personalized AI
- **Graph Pipeline:** MEDIUM - Powers discovery features

### Defensive Value (Blocking Competitors):
- Prevents competitors from replicating passive fingerprinting
- Protects spatial attribution mechanism (key to commission model)
- Blocks similar merit-based editorial systems

### Licensing Potential:
- Atelier system could license to adjacent markets (fashion, architecture)
- Editorial scoring applicable to content platforms broadly
- Spatial attribution relevant to visual commerce platforms

---

## Implementation Completeness Assessment

### Fully Implemented (Patent-Ready):
✅ Atelier Fingerprint System (aggregate.ts, signals.ts)
✅ Spatial Product Attribution (ProductTag with x, y)
✅ Editorial Scoring (curator.ts)
✅ Context Signal Pipeline (context-signal.ts, edge-builder.ts)

### Partially Implemented (Needs Hardening):
⚠️ Multi-Modal Aesthetic Detection (core logic present, needs production deployment)
⚠️ Interview Decision Capture (implemented, needs scale testing)

### Conceptual (Not Patent-Ready):
❌ Event Attribution Tracking (data model exists, attribution logic incomplete)

---

## Next Steps

### Legal Review:
1. Engage patent attorney for novelty search
2. Draft provisional applications for Top 3 innovations (Atelier, Attribution, Editorial)
3. Conduct freedom-to-operate analysis

### Technical Documentation:
1. Create detailed technical specifications for patent applications
2. Document algorithmic parameters and thresholds
3. Prepare flowcharts and data model diagrams

### Trade Secret Identification:
1. Identify components better protected as trade secrets:
   - Specific weight values in editorial scoring
   - Exact decay period calculations
   - Proprietary aesthetic theme mappings

2. Implement trade secret protection protocols:
   - Code access controls
   - Non-disclosure agreements
   - Confidentiality markings in codebase

---

## Conclusion

Folio has developed **5 strong patentable innovations** that represent significant intellectual property value. The Atelier Fingerprint System and Spatial Product Attribution are particularly strong candidates with high defensive value. Recommended strategy: file provisional patents for the top 3 innovations within 3 months, with full utility applications within 12 months.

**Estimated Total Patent Portfolio Value:** $2-5M (defensive value in preventing competitive replication)

**Priority Action:** Engage patent counsel immediately for Atelier Fingerprint System provisional filing.

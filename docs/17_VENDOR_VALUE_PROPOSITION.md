# 17_VENDOR_VALUE_PROPOSITION

## Purpose
This document defines Folio's vendor value proposition, tier structure, and the intelligence pipeline that transforms vendor questions into organic insights. It serves as the foundation for vendor deck creation and sales positioning.

## The Vendor Problem

Vendors have operated blind for decades:

- **No attribution**: They cannot see which designers specify their products
- **Lagging indicators**: By the time sales data arrives, trends have shifted
- **Trade show gambling**: $50k-$500k per event with no measurable ROI
- **PR uncertainty**: Retainers paid without feedback loops
- **Product launch risk**: Collections launched without demand validation
- **Competitive opacity**: No understanding of relative market position

Material Bank charges ~$10,000/month for sample logistics. That's a commodity—fulfillment. Folio offers something that has never existed: **visibility into the world vendors have been blind to.**

## The Folio Value Stack

Folio's vendor offering operates across five distinct value layers:

### Layer 1: Attribution
**What it is**: Notification when designers tag, save, or specify vendor products.

**Why it matters**: For the first time, vendors know *who* is using their products, not just *how many* sold.

**What it enables**:
- Identify high-influence designers driving demand
- Understand which products resonate with which aesthetics
- Build relationships with designers who genuinely align with the brand

### Layer 2: Analytics
**What it is**: Dashboard intelligence on product performance, designer engagement, regional trends, and event ROI.

**Why it matters**: Transforms scattered signals into actionable strategy.

**What it includes**:
- Product performance heatmaps
- Designer engagement metrics
- Regional adoption signals
- Seasonal trend patterns
- Event-to-specification attribution
- Competitive market context (aggregate, not competitor-specific)

### Layer 3: Voice
**What it is**: Vendor rep contribution to trend articles and collaboration pieces within Folio's editorial system.

**Why it matters**: Positions the vendor as a thought leader within the ecosystem, not through advertising but through earned perspective.

**How it works**:
- Reps can contribute quotes and insights to Folio-generated trend articles
- Collaboration articles feature vendor perspectives alongside designer narratives
- Voice appears within Folio's editorial standards—credible, not advertorial

**Critical distinction**: This is not pay-for-placement. Higher tiers *earn the right* to contribute perspective. Folio controls framing and maintains editorial integrity.

### Layer 4: Editorial
**What it is**: Product-focused articles, featured placement in editions, and narrative coverage of vendor collections.

**Why it matters**: Visibility that feels earned and editorial, not purchased.

**What it includes**:
- Product spotlight articles
- Collection launch coverage
- Material studies featuring vendor products
- Edition inclusion based on merit + subscription tier

### Layer 5: Research Intelligence
**What it is**: Vendors ask questions → Folio gathers answers through organic intelligence collection → Vendors receive insights.

**Why it matters**: Market research without surveys. Continuous signal, not one-shot studies.

**How it works**: See "The Research Intelligence Pipeline" section below.

---

## Complete Feature Inventory

The following features exist in the codebase and should be mapped to appropriate tiers.

### Boost & Monetization Systems

**Three distinct boost mechanisms:**

| System | How It Works | Revenue Model |
|--------|--------------|---------------|
| **Testimonial Boost** | Designer interview mentions vendor positively → auto-creates BoostOpportunity → vendor notified → vendor pays to feature the quote | Billing tiers: included, premium, featured |
| **Boost Request** | Vendor proactively requests testimonial from specific designer about specific product → designer records response → published | Per-request or included in tier |
| **Shop Boost** | Vendor pays to feature their product in designer's curated shop | 70% designer credit, 30% Folio revenue |

**Testimonial Boost Pipeline:**
1. Designer completes interview about project
2. AI analyzes answers for vendor mentions, sentiment, quotability
3. Positive mentions auto-generate BoostOpportunity (14-day expiration)
4. Vendor receives notification with full answer text + suggested pull quote
5. Vendor reviews, customizes, selects display options (showInArticle, showOnVendorPage, showInFeed)
6. Designer notified when testimonial boosted

**Boost Request Pipeline:**
1. Vendor identifies designer + product + project combination
2. Submits request with configurable expiry (1-90 days)
3. Request appears in designer's inbox
4. Designer accepts → records testimonial via interview flow
5. On publish, request marked COMPLETED

### Collaboration Story System

**Dual-interview editorial content:**

- Vendor invites designer to collaboration story (Pro+ tier required)
- Three rounds of questions per side (vendorRound1/2/3, designerRound1/2/3)
- AI weaves responses into cohesive narrative
- Published to `/magazine/collaborations`
- Status flow: INVITED → ACCEPTED → IN_PROGRESS → PUBLISHED

**Tier requirement:** Pro/Amplify and above

### Content Opportunity System

**Auto-generated monetization based on engagement:**

- System monitors product engagement metrics (likes, saves, designer tags)
- When thresholds met, creates VendorContentOpportunity
- Status: available → in_progress → published → expired
- 7-day expiration window
- Vendors can act on opportunities to create sponsored content

### Contributor Voice & Badge System

**Contribution types vendors can submit:**
- QUICK_TAKE (brief perspective)
- EXPERTISE (technical knowledge)
- PREDICTION (market forecasting)
- REFLECTION (industry observation)
- ENDORSEMENT (product/designer endorsement)

**Badge progression:**
| Badge | Requirement | Benefit |
|-------|-------------|---------|
| VOICE | 1 published contribution | Basic contributor recognition |
| SPECIALIST | 5 published (vendor-specific) | Category expertise recognition |
| AUTHORITY | 15 published | Industry authority status |
| EDITORIAL_VOICE | 30 published | Top-tier editorial access |

**Smart targeting:** System matches topics to vendors based on material/style categories and engagement history.

### Rep Dashboard & Tools

**Dedicated interface for vendor representatives:**
- Personalized feed of projects where vendor products are tagged
- Designer following list with engagement metrics
- Product counts per project
- Quick actions: invite to event, offer boost, extend discount, request missing info

### Smart Invites System

**AI-ranked designer recommendations for events:**

Scoring algorithm:
- Product saves: 15 points
- Location match: 20 points
- Recent engagement: 10 points

Enables targeted outreach to designers most likely to convert.

### Action Planning Tools

**AI-generated relationship-building plans:**

| Tool | Target | Output |
|------|--------|--------|
| **Discovery Lunch Generator** | "Hungry middle" designers (high potential, not yet engaged) | 10-14 guest list, 3 venue options, $2.5-9k budget, 120-130x ROI projection |
| **Appreciation Dinner Generator** | Top existing partners | Composite scoring (70% pipeline, 30% engagement), 12-18 guests, $6-30k budget, 90-95x ROI projection |

### Handoff System

**Vendor-to-designer project handoff:**

- VendorVisit model with unique access tokens
- Handoff packages (products, quotes, notes)
- Token expiration management
- Designer inbox for pending handoffs
- Project attachment workflow

### Trade Account Management

**VendorTradeAccount capabilities:**
- Account types: LOGIN, QUOTE, REP, API
- Credential storage (AES-256-GCM encryption)
- Discount/payment terms tracking
- Rep information management
- Verification status

### Partnership Management

**OrgVendorPartnership model:**
- Formal design firm ↔ vendor relationships
- Status: PENDING → CONFIRMED / DECLINED
- Unique constraint per firm-vendor pair
- Enables preferential treatment, custom terms

### Signal-Based Spend Tracking

**Collaboration monetization:**
- Per-save pricing (configurable $/save)
- Per-click pricing (configurable $/click)
- Budget caps (monthly/total)
- Rate limiting (100 signals/user/hour/project)
- Real-time budget tracking and clamping

### Directory & Rankings

**Merit-based vendor directory:**
- DirectoryRanking model with composite scores
- Factors: designerTags, taggedProjects, vendorDiversity
- Views: overall / rising
- Public visibility with pagination

### Product Management

**Product creation wizard:**
1. URL scraping (Browserless-based, JSON-LD/OpenGraph extraction)
2. Confidence-scored field suggestions
3. Field mapping (SKU, dimensions, materials, finish, care, lead time, compliance, origin)
4. Media management (hero image/video, gallery, auto color palette extraction)
5. File uploads: spec sheets (PDF), 3D models (GLTF/GLB/USDZ/OBJ/FBX), CAD (DWG/DXF), BIM (RVT/IFC)
6. Validation and publish

**Product claiming:** Preview-token-based ownership claiming for products already in system.

### Event Analytics (52 Components)

**Pro Analytics Dashboard (5 tabs):**

| Tab | Contents |
|-----|----------|
| **Overview** | Conversion funnel, AI breakdown, executive summary |
| **Engagement** | Heatmap, saves timeline, room-phase matrix |
| **Markets** | Geographic distribution, regional performance |
| **Accounts & Products** | Top clients, product performance tables |
| **Benchmarks** | Industry comparisons, historical performance |

**Post-Event Tools (22 components):**
- OutcomeSnapshot
- AttributionTiming (including "Booth QR" channel)
- KeyAccounts identification
- DesignerTimelines
- PlaybookSheet
- Next7DaysPlan
- IntentSegments
- MarketMap

**Event Action Workflow:**
- Vendor dashboard updates
- ROI tracking and attribution
- Follow-up automation
- Recap generation

### Question-Led Analytics Interface

**Open-ended intelligence:**
- Global question input field
- 3 hero insight cards:
  - Influence Value (total $M, 30-day change, active projects)
  - Top Engaged Designers (count, high-budget designers $500k+, saves/tags)
  - Events That Moved Metal (pipeline influenced, top event, check-ins, saves)
- Dynamic insight panel with multi-turn conversation
- Visualization support (stat, bar, heatmap)
- Follow-up suggestions
- Action workflow drawers

### Notification Systems

**Vendor notifications:**
| Trigger | Email | In-App |
|---------|-------|--------|
| Product tagged by designer | ✓ (24hr rate limit) | ✓ |
| Boost opportunity created | ✓ | ✓ |
| Testimonial boosted | — | ✓ |
| Product featured in project preview | ✓ (14-day token) | — |

**VendorInviteSignal:** Tracks mentions of vendors not yet on platform for recruitment outreach.

---

## Tier Structure

| Tier | Monthly | Annual | Core Value |
|------|---------|--------|------------|
| **Discover** | Free | Free | Attribution notifications, basic profile, limited catalog (25 SKUs) |
| **Grow** | $3,500 | $38,000 | Full dashboard, designer engagement, product performance, 3 research questions/quarter |
| **Amplify** | $9,000 | $100,000 | Trend forecasting, event ROI, rep voice in trend articles, collaboration articles (2/month), 6 research questions/quarter |
| **Enterprise** | $22,000 | $240,000 | Product-focused editorial, priority research queue, unlimited questions, API access, custom reports, early demand signals, dedicated strategist |

### Tier Feature Matrix

#### Core Platform Access

| Feature | Discover | Grow | Amplify | Enterprise |
|---------|----------|------|---------|------------|
| Attribution notifications | ✓ | ✓ | ✓ | ✓ |
| Basic vendor profile | ✓ | ✓ | ✓ | ✓ |
| Directory listing | ✓ | ✓ | ✓ | Featured |
| SKU catalog limit | 25 | 250 | Unlimited | Unlimited |
| Rep seats | 1 | 3 | 10 | Unlimited |
| Trade account storage | — | ✓ | ✓ | ✓ |

#### Analytics & Intelligence

| Feature | Discover | Grow | Amplify | Enterprise |
|---------|----------|------|---------|------------|
| Product performance dashboard | — | ✓ | ✓ | ✓ |
| Designer engagement metrics | — | ✓ | ✓ | ✓ |
| Regional trend data | — | Basic | Full | Full |
| Event ROI attribution | — | — | ✓ | ✓ |
| Trend forecasting | — | — | ✓ | ✓ |
| Competitive market context | — | — | ✓ | ✓ |
| Question-led analytics | — | Basic | Full | Full + Priority |
| Pro Analytics Dashboard (events) | — | — | ✓ | ✓ |
| Post-event tools (22 components) | — | — | ✓ | ✓ |
| Early demand signals | — | — | — | ✓ |
| Custom reports | — | — | — | ✓ |
| API access | — | — | — | ✓ |

#### Research Intelligence

| Feature | Discover | Grow | Amplify | Enterprise |
|---------|----------|------|---------|------------|
| Research questions | — | 3/quarter | 6/quarter | Unlimited |
| Priority research queue | — | — | — | ✓ |
| Research wizard access | — | ✓ | ✓ | ✓ |

#### Voice & Editorial

| Feature | Discover | Grow | Amplify | Enterprise |
|---------|----------|------|---------|------------|
| Contributor submissions | — | QUICK_TAKE only | All types | All types |
| Rep voice in trend articles | — | — | ✓ | ✓ |
| Collaboration stories | — | — | 2/month | 4/month |
| Product-focused editorial | — | — | — | ✓ |
| Badge progression | — | ✓ | ✓ | Accelerated |

#### Boost & Monetization

| Feature | Discover | Grow | Amplify | Enterprise |
|---------|----------|------|---------|------------|
| Testimonial boost (respond) | — | ✓ | ✓ | ✓ |
| Testimonial boost display options | — | Basic | Full | Full |
| Boost requests (proactive) | — | 2/month | 10/month | Unlimited |
| Shop boost | — | — | ✓ | ✓ |
| Content opportunities | — | View only | Act on | Priority access |

#### Relationship Tools

| Feature | Discover | Grow | Amplify | Enterprise |
|---------|----------|------|---------|------------|
| Rep dashboard | — | ✓ | ✓ | ✓ |
| Smart invites | — | — | ✓ | ✓ |
| Discovery lunch planner | — | — | ✓ | ✓ |
| Appreciation dinner planner | — | — | — | ✓ |
| Partnership management | — | — | ✓ | ✓ |
| Handoff system | — | ✓ | ✓ | ✓ |

#### Product Management

| Feature | Discover | Grow | Amplify | Enterprise |
|---------|----------|------|---------|------------|
| URL scraping wizard | ✓ | ✓ | ✓ | ✓ |
| 3D/CAD/BIM uploads | — | ✓ | ✓ | ✓ |
| Bulk import | — | — | ✓ | ✓ |
| Product claiming | ✓ | ✓ | ✓ | ✓ |

#### Collaboration Spend

| Feature | Discover | Grow | Amplify | Enterprise |
|---------|----------|------|---------|------------|
| Signal-based spend tracking | — | — | ✓ | ✓ |
| Per-save/click pricing | — | — | ✓ | ✓ |
| Budget caps | — | — | ✓ | ✓ |
| Dedicated strategist | — | — | — | ✓ |

### Pricing Philosophy

**Why these price points:**

- **Discover (Free)**: The attribution hook. Gets vendors into the ecosystem, experiencing value before paying.
- **Grow ($3,500)**: Entry point for serious vendors. Comparable to a single trade show booth day, but delivers continuous intelligence.
- **Amplify ($9,000)**: Premium positioning. Less than Material Bank's logistics-only offering, but delivers intelligence + voice + research.
- **Enterprise ($22,000)**: Full intelligence partnership. For vendors who want to lead their categories. Still less than a single trade show booth at major events.

**The comparison frame:**

| Spend | What It Buys |
|-------|-------------|
| $100,000 | One High Point Market booth |
| $50,000 | One regional trade show presence |
| $10,000/mo | Material Bank sample logistics |
| $9,000/mo | Folio Amplify: attribution + analytics + voice + research |

**Founding Vendor Program:**

First 20 vendors to commit receive:
- 24-month rate lock at 40% discount
- Priority onboarding support
- Direct influence on roadmap
- "Founding Vendor" recognition

Example: Enterprise tier at $13,200/month ($145,000/year) instead of $22,000/month for 24 months.

---

## The Research Intelligence Pipeline

### The Concept

Traditional market research is broken:
- Surveys produce self-reported data (unreliable)
- Focus groups are small samples in artificial contexts
- Studies are one-shot snapshots (stale within months)
- Costs run $15-50k per study

Folio's research pipeline offers:
- **Continuous signal** instead of one-shot
- **Behavioral data** instead of self-reported
- **Organic gathering** instead of artificial
- **Compounding answers** where each question enriches the model

### How It Works

**Step 1: Vendor Submits Question**

Vendor asks through the dashboard:
> "Are designers moving away from statement backsplashes toward full-height slabs?"

**Step 2: Research Wizard Processes**

The system (human-assisted initially, AI-assisted at scale) identifies:
- What signals would answer this question
- What related questions could be bundled
- How to gather organically without survey fatigue

**Step 3: Intelligence Gathering**

Multiple channels activate:
- **Editorial angles**: "Kitchen trends designers are watching in 2026"
- **Feed engagement**: Track specification patterns on backsplash-tagged projects
- **Interview prompts**: Designer conversations touch on material transitions
- **Polling**: Tasteful, infrequent polls that feel like community engagement
- **Behavioral analysis**: What's being saved vs. specified vs. featured

**Step 4: Synthesis**

Folio aggregates signals and delivers insight:
> "Based on 847 kitchen projects tagged in the past 6 months, full-height slab backsplashes have increased from 23% to 41% of designer specifications. Regional variance: strongest in Pacific Northwest (52%), weakest in Southeast (28%). Designer sentiment in interviews suggests durability and maintenance concerns driving the shift, not aesthetics."

**Step 5: Feedback Loop**

Each answered question:
- Enriches Folio's intelligence model
- Identifies new questions worth exploring
- Creates editorial content that benefits all users
- Teaches Folio what vendors actually need to know

### The Research Wizard

The wizard is the interface through which vendors submit and refine questions.

**Wizard Flow:**

1. **Question Entry**: Free-form or template-guided
2. **Clarification**: System asks follow-ups to scope the question
3. **Bundling**: System identifies related questions from other vendors (anonymized) that could be answered together
4. **Timeline**: Estimated delivery based on data availability
5. **Tracking**: Vendor sees progress as signals accumulate

**Question Templates:**

- "What percentage of [room type] projects feature [product category]?"
- "How is [material/finish] trending vs. [alternative]?"
- "Which designer aesthetics align most strongly with [our product line]?"
- "What are designers saying about [industry trend]?"
- "How did [event] impact awareness of [product type]?"

**Question Refinement Example:**

Vendor submits: "Do designers like our new collection?"

Wizard responds:
> "That's a great starting point. Let's refine:
> - Which collection specifically?
> - Are you most interested in: saves, specifications, or sentiment?
> - Any particular aesthetic segments you want to understand?
> - Timeframe: since launch vs. last quarter vs. all-time?"

Refined question:
> "Among minimalist/modern designers, how does specification rate for the Aurora collection compare to our Classic line since the October launch?"

### Bundling Questions for Efficiency

Multiple vendor questions often point toward the same underlying intelligence need.

**Example Bundle:**

- Vendor A asks: "Is marble losing ground to quartzite?"
- Vendor B asks: "What stone surfaces are trending in luxury kitchens?"
- Vendor C asks: "How do designers perceive engineered vs. natural stone?"

**Bundled Research:**

One editorial + one poll + behavioral analysis answers all three:
- "The State of Stone: What Designers Are Specifying in 2026"
- Engagement patterns across stone categories
- Interview quotes on material selection rationale

Each vendor gets their specific answer. Folio gets rich content. Designers feel heard, not surveyed.

### Guardrails and Ethics

**What vendors can ask:**
- Market-level trends and patterns
- Designer sentiment on categories, materials, aesthetics
- Their own product performance and positioning
- Regional and demographic patterns
- Event impact and attribution

**What vendors cannot ask:**
- Specific competitor performance data
- Individual designer behavior without consent
- Anything that would require surveillance-feeling collection
- Questions that could harm designers or the ecosystem

**How organic gathering stays organic:**

The key principle: **Folio appears curious about the industry, not performing market research for vendors.**

- Editorial content serves the community first
- Polls are infrequent and genuinely interesting
- Interview questions feel like storytelling prompts
- Engagement patterns are observed, not extracted

Designers *want* their voice considered in product decisions. The research pipeline respects this by:
- Never making designers feel extracted from
- Always delivering value back (editorial, visibility, influence)
- Keeping vendor questions invisible to designers
- Framing all gathering as Folio's genuine curiosity

---

## Competitive Market Context (What We Provide vs. What We Don't)

### What We Provide:
- Aggregate market trends (e.g., "marble specification is up 12% YoY")
- Category-level benchmarks (e.g., "your product category averages X saves per month")
- Share of specification by material type
- Regional adoption patterns at market level
- Trend direction indicators

### What We Don't Provide:
- Competitor-specific performance data
- Individual competitor sales or specification rates
- Ranking of competitors by performance
- Any data that would directly expose another vendor's performance

**The framing:**

Vendors receive enough context to understand where the market is moving. They can deduce competitive positioning through their own analysis, but Folio never provides data that directly exposes another vendor's performance.

---

## The Open-Ended Dashboard

Unlike closed dashboards with fixed charts and filters, Folio's vendor dashboard includes an open-ended interface where vendors can **ask what they want to know**.

**How it works:**

1. Vendor types a question in natural language
2. System checks if existing data can answer it
3. If yes: generates insight immediately
4. If partially: shows available data + suggests research question submission
5. If no: queues for research pipeline

**Why this matters:**

- Positions Folio as an intelligence partner, not a reporting tool
- Learns what vendors actually need (shapes product roadmap)
- Creates personalized value (each vendor's dashboard becomes uniquely useful)
- Identifies gaps in Folio's intelligence layer

**Example interactions:**

> Vendor: "Which designers have saved our products in the last 30 days?"
> Dashboard: [Immediate list with designer profiles and aesthetic fingerprints]

> Vendor: "Why are specifications down in the Southeast?"
> Dashboard: "I don't have enough signal to answer definitively. Based on available data, here's what I see: [partial analysis]. Would you like to submit this as a research question?"

> Vendor: "What should we launch next?"
> Dashboard: "That's a strategic question that requires deeper research. Based on your existing catalog performance and designer affinity patterns, here are three directions showing early demand signals: [suggestions]. Shall I explore any of these further?"

---

## Sales Positioning

### The Core Narrative

"For the first time in the history of interior design, vendors can see who is specifying their products, understand why, and shape what happens next."

### The Comparison Frame

| What You Get | Trade Show | PR Retainer | Material Bank | Folio |
|--------------|------------|-------------|---------------|-------|
| Designer awareness | Maybe | Maybe | No | Yes (measured) |
| Attribution | No | No | No | Yes |
| Event ROI | No | No | No | Yes (52 analytics components) |
| Product intelligence | No | No | No | Yes |
| Trend forecasting | No | Maybe | No | Yes |
| Market research | No | Expensive add-on | No | Yes (built-in) |
| Editorial voice | Pay-to-play | Maybe | No | Earned + Boosted |
| Designer testimonials | No | Expensive | No | Yes (3 boost systems) |
| Rep tools | No | No | No | Yes (dashboard, smart invites) |
| Action planning | No | No | No | Yes (AI lunch/dinner planners) |
| Cost | $50-500k/event | $10-25k/month | $10k/month | $3.5-22k/month |

### Feature-Led Pitch Points

**For relationship-focused vendors:**
> "Your reps get a personalized dashboard showing every project where your products are tagged. Smart invites use AI to identify which designers to invite to your next event. And our action planning tools generate complete discovery lunch and appreciation dinner plans—guest lists, venues, budgets, projected ROI."

**For content-hungry vendors:**
> "Three ways to get your story told: Collaboration Stories let you co-create editorial content with designers. Testimonial Boosts let you feature positive designer quotes across the platform. And our contributor system lets your team build authority through trend articles—with badges that recognize your expertise."

**For data-driven vendors:**
> "Ask any question through our open-ended analytics interface. If we don't have the answer, we'll research it—gathering signals through editorial, engagement patterns, and designer interviews. You get continuous market intelligence, not one-shot studies."

**For event-heavy vendors:**
> "52 analytics components track every aspect of event performance. Five-tab Pro Dashboard covers overview, engagement, markets, accounts, and benchmarks. Post-event tools give you attribution timing, key accounts, and a 7-day action plan. Finally measure whether that booth was worth it."

### The Pitch Sequence

1. **Hook**: "Do you know which designers drive your revenue?"
2. **Pain**: Review the blind spots (attribution, ROI, forecasting)
3. **Vision**: Describe the world where they have visibility
4. **Proof**: Show existing attribution data (if available) or demo
5. **Tier**: Match their needs to the right tier
6. **Founding**: If early stage, present founding vendor opportunity

### Objection Handling

**"We already do trade shows."**
> "Trade shows are valuable for relationships—but you can't measure them. Folio makes every trade show investment measurable with 52 analytics components and extends your visibility 365 days a year. Plus, our Smart Invites help you identify exactly which designers to bring to your booth."

**"Our products aren't really tagged yet."**
> "That's exactly why now is the time to join. Every product specification builds your intelligence layer. In 12 months, vendors who joined early will have insights their competitors can't access. And our Boost Request feature lets you proactively gather testimonials from designers already using your products."

**"How is this different from advertising?"**
> "Advertising buys impressions. Folio delivers attribution, intelligence, and earned editorial. Our three boost systems let you amplify real designer testimonials—authentic voices, not ad copy. And our contributor system builds your team's authority through genuine expertise, not sponsored content."

**"The enterprise tier is expensive."**
> "It's less than a single High Point Market booth. But instead of 4 days of exposure, you get 365 days of intelligence, unlimited research questions, AI action planning, and a dedicated strategist. The Discovery Lunch planner alone projects 120-130x ROI."

**"We don't have bandwidth to manage another platform."**
> "Your reps get their own dashboard—one view of everything relevant to them. Smart Invites does the targeting work. Action planners generate complete event plans. And our handoff system streamlines vendor-to-designer communication. This saves time; it doesn't add work."

---

## Implementation Notes

### Phase 1 (Current): Attribution Foundation
- "You were tagged" notifications operational
- Basic vendor profiles
- Manual onboarding support

### Phase 2 (Months 6-12): Analytics Layer
- Full dashboard rollout
- Product performance metrics
- Designer engagement tracking
- Event attribution

### Phase 3 (Months 12-18): Voice + Research
- Rep voice contribution system
- Research wizard MVP
- Collaboration article workflow
- Open-ended dashboard questions

### Phase 4 (Months 18-24): Full Intelligence
- Enterprise features complete
- API access
- Custom reports
- Early demand signal modeling

---

## Implementation Status

Based on codebase audit (January 2026):

### Production-Ready (~70%)

| Feature | Status | Notes |
|---------|--------|-------|
| Subscription management | Complete | 4 tiers, Stripe integration, feature flags |
| Boost system (all 3 types) | Complete | Full pipeline, 14-day expiration, display options |
| Collaboration stories | Complete | 3 rounds each side, AI narrative, publishing |
| Product catalog management | Complete | Wizard, validation, file uploads |
| Handoff system | Complete | Tokens, packages, designer inbox |
| Signal-based spend tracking | Complete | Rate limiting, budget caps, pricing |
| Attribution notifications | Complete | 24hr rate limiting, preview tokens |
| Rep dashboard | Complete | Personalized feed, following list |
| Trade account management | Complete | Encryption, multi-type support |
| Directory rankings | Complete | Merit-based scoring, pagination |
| Contributor/badge system | Complete | All types, 4 badge levels |
| Content opportunity system | Complete | Auto-generation, 7-day expiry |
| Partnership management | Complete | Status workflow, unique constraints |
| Smart invites | Complete | AI scoring algorithm |
| Action planning tools | Complete | Lunch/dinner generators with ROI |

### Partial/Demo (~20%)

| Feature | Status | Gap |
|---------|--------|-----|
| Event KPIs | Mock data | Real API not wired |
| AI analyst | Deterministic | Demo responses by sectionId |
| QBR reports | Demo state | Not connected to real data |
| 3D asset generation | API complete | Schema field pending |
| Event analytics | UI complete (52 components) | Some mock data |
| AI insights panel | Structure complete | Gated behind feature flag |

### Needs Work (~10%)

| Feature | Status | Required Action |
|---------|--------|-----------------|
| Email service | Templates ready, not sending | Integrate email provider |
| Event edge models | Referenced but possibly missing | Verify/add to Prisma schema |
| Notification center UI | No component found | Build bell icon + drawer |
| Secondary tagging capture | Only tag-product-to-image hooked | Hook selections/rooms paths |
| Some route auth | Missing validation | Add access control |

### Schema Gaps Identified

Models referenced in code but may need schema verification:
- `EventVendorEdge`
- `EventDesignerEdge`
- `EventProductEdge`
- `EventRepEdge`
- `EventWorkflowJob`
- `threeDAssetUrl` field on Product

---

## Appendix: The Material Bank Comparison

Material Bank is the dominant sampling platform. Their value proposition:
- Consolidated sample ordering
- Fast shipping
- Vendor catalog hosting

Their pricing: ~$10,000/month for active vendor participation.

**What Material Bank provides:**
- Logistics efficiency (samples ship fast)
- Order consolidation (one platform, many vendors)
- Being where designers order samples

**What Material Bank doesn't provide:**
- Attribution (who is specifying, not just ordering samples)
- Designer intelligence (aesthetic fingerprints, influence tiers)
- Event ROI (did that trade show convert?)
- Trend forecasting (what's coming, not what shipped)
- Market research (answers to strategic questions)

**Folio's positioning:**

We are not competing with Material Bank. We are providing the intelligence layer that Material Bank cannot offer. A vendor could (and should) use both:
- Material Bank for sample logistics
- Folio for attribution, intelligence, and research

**The wedge:**

Material Bank owns the transaction. Folio owns the decision. By the time a designer orders a sample, the specification decision is already made. Folio captures the upstream moment—when a designer saves, tags, and specifies. That's where influence lives.

---

## Conclusion

Folio's vendor value proposition is not "another platform." It is the first time vendors gain visibility into the world that has been invisible to them.

The tier structure ensures:
- Easy entry (Discover tier hooks them with attribution)
- Natural progression (features unveil at higher tiers)
- Premium positioning (priced below trade shows but delivers more)
- Research advantage (market intelligence as a service)

Vendors who join early will have compounding advantages: 24 months of attribution data, refined research answers, established relationships with high-influence designers. Vendors who wait will be perpetually behind.

This is not about raising prices. It is about unveiling value.

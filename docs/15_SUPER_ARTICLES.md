# 12_SUPER_ARTICLES

## Purpose
This document defines the Super-Article system: a multi-party collaborative editorial model that unifies Designer, Architect, Contractor, and Vendor perspectives into a single project narrative—creating editorial content no traditional design magazine can match.

## Strategic Vision

### The Core Insight
A completed interior design project involves multiple professionals: designers who envision the space, architects who structure it, contractors who build it, and vendors whose products fill it. Traditional design media captures only one perspective—usually the designer's, occasionally the architect's.

Folio's Super-Article captures all perspectives simultaneously, creating:
- Unprecedented depth of project documentation
- Multiple professional entry points to the platform
- Natural subscription pressure through the "credited vs. voice" distinction
- A quality standard no magazine can replicate

### Merit Redefined
Merit on Folio includes **completeness**. A project with all contributing parties sharing their perspectives represents the highest form of design documentation. This isn't pay-to-play—it's pay-to-contribute.

Anyone can be credited. Only subscribers can have a voice.

---

## New User Types

### Architect Role
**Purpose:** Professionals who design the structural and spatial aspects of built environments.

**Characteristics:**
- Focus on form, structure, light, circulation, envelope
- Different visual priorities than designers (architectural photography vs. styled interiors)
- Often work upstream of designers on the same projects
- Existing professional networks and publications (Dezeen, ArchDaily)

**Platform Behavior:**
- Can be credited on any project without subscribing
- Must subscribe to contribute their perspective to Super-Articles
- Have their own profile, portfolio, and editorial lens
- Interview prompts focus on: spatial concept, structural challenges, site conditions, light strategy, material palette rationale

### Contractor Role
**Purpose:** Professionals who execute the physical construction and installation.

**Characteristics:**
- Focus on craft, logistics, problem-solving, timeline, coordination
- Less digitally native than designers/architects
- Story is process-oriented rather than aesthetic
- Often excluded from design media entirely

**Platform Behavior:**
- Can be credited on any project without subscribing
- Must subscribe to contribute their perspective to Super-Articles
- Interview prompts are contextually generated AFTER designer/architect (so questions can reference specific timeline, special pieces, logistical challenges mentioned)
- Contribution is supporting role—valuable but weighted less heavily in editorial scoring

**Interview Prompt Examples (Contractor):**
- "The designer mentioned the custom steel staircase. Walk us through the fabrication and installation process."
- "What was the most challenging coordination moment on this 18-month project?"
- "How did you solve the structural requirements for the cantilevered deck?"

---

## Super-Article Architecture

### Conceptual Model
A Super-Article is a unified project narrative with multiple professional lenses. It has:

1. **Shared Umbrella** - Hero image, project name, location, and full credits visible to all
2. **Perspective Tabs** - Horizontal navigation between Designer, Architect, Contractor, and Featured Vendors
3. **Individual Editorials** - Each contributing party's perspective is a complete editorial in itself
4. **Progressive Assembly** - The Super-Article builds over time as parties contribute

### Visual Structure
```
┌─────────────────────────────────────────────────────────────┐
│  [HERO IMAGE - Full bleed]                                  │
│                                                              │
│  THE MILLER RESIDENCE                                        │
│  Malibu, California                                          │
│                                                              │
│  Design: Sarah Chen Studio                                   │
│  Architecture: Morphosis Partners                            │
│  Build: Pacific Coast Construction                           │
│  Featured: Holly Hunt, Apparatus, Heath Ceramics             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  [DESIGNER]    [ARCHITECT]    [BUILDER]    [VENDORS ▾]      │
│      ●             ○              ○             ○            │
└─────────────────────────────────────────────────────────────┘

[Selected perspective's editorial content flows below]
```

### Hero Image Hierarchy
The Super-Article hero image follows a priority hierarchy:

1. **Architect** (first priority) - Architectural photography tends toward grand, structural shots that establish context
2. **Designer** (second priority) - Interior photography with styling and detail
3. **Contractor** (third priority) - Process or completion documentation

**Rule:** Hero image is determined by hierarchy, but each party chooses their OWN hero for their individual editorial view and profile display.

### Tab Navigation Behavior
- Swiping left/right moves between perspectives
- The tab indicator shows which perspective is active
- Each perspective is a complete editorial experience
- Users in specific roles (e.g., architects) may see content defaulting to their professional lens
- Clicking a credited but non-contributing party shows: "Morphosis Partners contributed to this project. [Their perspective coming soon]" or "[Claim your profile to add your story]"

---

## Credits vs. Voice Model

### The Core Distinction
| Status | Requirements | Benefits |
|--------|-------------|----------|
| **Credited** | None (free) | Name appears in project credits, profile link, "You were credited" notification |
| **Contributing** | Active subscription | Can add perspective editorial, interview participation, photos, featured in Super-Article |

### Monetization Logic
1. Designer publishes project → credits Architect, Contractor, Vendors
2. Credited parties receive notification: "You were credited on THE MILLER RESIDENCE"
3. They can claim their profile (free) and be shown as credited
4. To add their perspective and voice, they must subscribe
5. When they subscribe and contribute, the Super-Article regenerates with richer content

This creates **natural subscription pressure** without gatekeeping recognition.

### Vendor Credit Model
Vendors operate slightly differently:
- **Tagged vendors** appear in product tags throughout the editorial
- **Featured vendors** (limited slots) can have perspective blurbs in the Super-Article
- **Boost option** - Vendors can pay to boost their feature in the article
- Vendor perspective articles are shorter (blurbs, not full editorials)
- On vendor profile, they can link to projects where they're credited
- Full vendor-perspective article for their product page requires subscription or boost

---

## Progressive Assembly Workflow

### How Super-Articles Build Over Time

**Stage 1: Designer Initiates**
- Designer creates project, uploads images, completes interview
- Credits architect, contractor, and vendors during process
- Publishes → Single-perspective editorial goes live
- Credited parties receive notifications

**Stage 2: Architect Claims & Contributes**
- Architect receives "You were credited" email
- Claims profile (free) → appears as credited collaborator
- Subscribes → unlocks ability to add perspective
- Completes architect-specific interview
- Uploads additional images (their own photography)
- Super-Article **regenerates** with both perspectives
- Project gets re-surfaced in feed with "Updated" flag

**Stage 3: Contractor Claims & Contributes**
- Same flow as architect
- Interview prompts are contextual (generated from designer/architect content)
- Super-Article regenerates again with craft/process layer
- Project re-surfaces with "Complete Build Story" flag

**Stage 4: Vendor Features**
- Tagged vendors can boost for featured blurb
- Featured vendors shown in Vendors tab dropdown
- Each vendor blurb links to product pages

### Regeneration Behavior
Each new contribution triggers:
1. AI regeneration that optimizes overall narrative quality
2. Slight length increase (not exponential—we don't want novels)
3. Cross-referencing between perspectives where relevant
4. Re-surface to feed for users who previously engaged
5. New surface to users who haven't seen it but follow the new contributor

---

## Editorial Scoring Adjustments

### Phase 1 Priorities (Current)
- **Primary weight:** Complete product tagging
- **Secondary weight:** Engagement signals (saves, likes, views)
- **Tertiary weight:** Visual quality and style uniqueness

Super-Articles are NOT heavily weighted in Phase 1. The focus is proving the designer publishing wedge.

### Phase 2+ Scoring Evolution
As multi-party contributions become standard:

| Signal | Weight | Rationale |
|--------|--------|-----------|
| Product tagging completion | 30% | Maintains core value prop |
| Engagement signals | 25% | Community validation |
| Multi-party contribution | 20% | Completeness merit |
| Visual quality / style uniqueness | 15% | Editorial standards |
| Trend alignment | 10% | Timeliness |

**Multi-party contribution scoring:**
- Designer alone: 0%
- Designer + Architect: +10%
- Designer + Architect + Contractor: +15%
- All parties + Vendor features: +20%

### Editorial Edition Qualification (Phase 2+)
For Editorial Edition inclusion, Super-Articles with multi-party contributions receive priority weighting. The goal: **Editorial Editions showcase the most complete project documentation**, which requires collaborative participation.

This creates a positive pressure loop:
- Designers want Editorial status → they pursue complete Super-Articles
- Architects/Contractors want exposure → they subscribe to contribute
- Vendors want product visibility → they boost features
- Everyone wins, and Folio captures subscriptions

---

## Interview Prompt Architecture

### Designer Prompts (Existing)
Focus on: aesthetic vision, client relationship, material choices, spatial decisions, product selection rationale

### Architect Prompts (New)
Focus on:
- Spatial concept and design intent
- Site conditions and constraints
- Structural solutions
- Light strategy and envelope decisions
- Material palette from structural perspective
- Collaboration with designer (how did visions align?)

### Contractor Prompts (New, Contextual)
Generated AFTER designer/architect interviews, referencing specific elements mentioned:
- Timeline and phasing
- Most challenging technical element
- Custom fabrication stories
- Coordination between trades
- Problem-solving moments
- Craft details viewers might miss

### Vendor Prompts (For Boosted Features)
Brief, product-focused:
- Why this product for this space?
- Designer collaboration story
- Technical specifications that mattered
- Behind-the-scenes of the specification

---

## Feed & Discovery Behavior

### User Role Lens
When viewing editorials and Super-Articles, content can be filtered by user role:
- **Architects** see architectural perspective prioritized
- **Designers** see design perspective prioritized
- **Contractors** see build perspective prioritized
- **Individuals** see the unified Super-Article experience

This doesn't hide content—it adjusts default view and surfacing priority.

### Re-Surfacing Logic
Super-Articles re-appear in feed when:
1. New perspective is added
2. User previously engaged (save, like) but hasn't seen update
3. User follows the new contributor
4. Project crosses Editorial threshold with new contribution

Flag indicators:
- "Updated" - Generic new content added
- "Now with Architect's Perspective" - Specific role contribution
- "Complete Build Story" - All parties contributing

---

## Media Generation Possibilities

### The Data Wealth
A complete Super-Article contains:
- 10-30+ high-quality images from multiple perspectives
- Designer narrative (500-1500 words)
- Architect narrative (500-1500 words)
- Contractor narrative (300-800 words)
- Vendor blurbs (100-300 words each)
- Product tags with spatial coordinates
- Pull quotes from each party
- Project metadata (location, timeline, budget band, style)

### Automated Media Outputs

**1. Project Promo Videos**
- Slideshow format using submitted photos
- Text overlays with pull quotes
- Pacing matched to content emotional arc
- Auto-generated for social sharing
- Multiple aspect ratios (16:9, 9:16, 1:1)

**2. Role-Specific Highlight Reels**
- Designer-focused: aesthetic moments + design philosophy quotes
- Architect-focused: structural shots + spatial concept quotes
- Contractor-focused: process shots + craft detail quotes
- Vendor-focused: product beauty shots + specification context

**3. Instagram Carousel Exports**
- 10-slide format optimized for platform
- Hero image → key shots → product features → credits
- Captions auto-generated from editorial content
- CTA slide with Folio link

**4. TikTok/Reels Format**
- 15-60 second clips
- Trending audio integration options
- Quick-cut between perspectives
- Text overlay storytelling

**5. Case Study PDFs**
- Professional document format
- Complete project documentation
- Product specification sheets
- Before/after sequences (if available)
- Ideal for designer portfolios, vendor sales materials

**6. Presentation Decks**
- Auto-generated from editorial content
- Client-presentation-ready format
- Role-specific versions available

### AI-Powered Media Features (Future)

**Narrated Videos**
- AI voice narration using editorial text
- Designer/architect quotes as spoken narrative
- Background music selection based on style

**Comparison Media**
- Before/after sequences
- Design evolution timelines
- Material palette breakdowns

**Interactive Experiences**
- Hotspot-enabled images (existing tag data)
- Shoppable video overlays
- AR product placement previews

---

## Conflict Resolution

### Potential Conflicts
- Disagreement on facts (timeline, budget, decisions)
- Disagreement on framing (who contributed what)
- Disagreement on credits (parties feel excluded)
- Disagreement on hero image selection

### Resolution Principles

**Rule: Omit over Alter**
When factual disputes arise, the system smooths language rather than changing facts. If resolution isn't possible, contested content is omitted rather than altered.

**Smoothing Feature (Future)**
If a credited party disputes published content:
1. Flag triggers review
2. AI suggests neutral rewording
3. Both parties must approve smoothed version
4. If no agreement, contested section is omitted
5. Each party's individual perspective remains their own—only shared umbrella content is smoothed

**Individual vs. Shared Content**
- Individual perspective editorials: Each party controls their own voice
- Shared umbrella (hero, credits, project description): Follows hierarchy + smoothing rules
- Product tags: Factual, not disputable

---

## Implementation Sequencing

### Phase 1: Foundation (Do Not Build Yet)
- Architect and Contractor roles exist in data model but are not actively onboarded
- Credits field exists in ProjectPost model (already present)
- Designer-only publishing remains primary focus

### Phase 1B: Credits Introduction
- Add "Credit Collaborators" step to publishing flow
- Capture architect/contractor names and emails
- Send "You were credited" notifications (like vendor "you were tagged")
- Display credits on published posts (name only, no perspective)

### Phase 2: Multi-Party Contribution
- Architect and Contractor onboarding flows
- Role-specific interview prompts
- Super-Article progressive assembly
- Regeneration on new contributions
- Tab navigation UI

### Phase 2B: Vendor Features
- Vendor perspective blurbs
- Boost functionality for featured status
- Vendor tab in Super-Article dropdown

### Phase 3: Media Generation
- Automated promo video generation
- Social export formats
- Role-specific highlight reels
- Case study PDF generation

---

## Success Metrics

### Phase 1B Metrics (Credits)
- % of published projects with credited collaborators
- "You were credited" email open rate
- Profile claim rate from credited parties

### Phase 2 Metrics (Super-Articles)
- % of credited parties converting to subscribers
- Average perspectives per Super-Article
- Re-engagement rate on updated Super-Articles
- Time from credit to contribution

### Phase 3 Metrics (Media)
- Auto-generated media downloads
- Social share rate from generated content
- Cross-platform engagement from generated videos

---

## Why This Wins

1. **No magazine can compete** - AD, Dezeen, Dwell can't unify 4 professional perspectives
2. **Natural network expansion** - Every project becomes multi-party acquisition channel
3. **Merit = Completeness** - Defensible, non-pay-to-play positioning
4. **Credits → Subscriptions** - Elegant conversion funnel that honors contribution
5. **Data compounds** - Each perspective adds intelligence to Atelier fingerprints
6. **Media flywheel** - Auto-generated content drives platform visibility

This is how Folio becomes the definitive record of design projects—not just beautiful images, but the complete story told by everyone who brought them to life.

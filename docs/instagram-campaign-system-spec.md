# Instagram Campaign System: Design Specification v2

## The Core Insight

**A Folio post is a content corpus, not a single piece of content.**

Instagram rewards frequency and focus over density. Trying to cram one Folio post into one Instagram post loses context and competes poorly against native content.

**The value proposition to designers:**
> "Upload once to Folio. Generate 8-12 Instagram posts, all project-branded and ready to share."

Framing matters: **post count, not duration.** "8 posts" feels manageable. "6 weeks of content" feels like milking it. Designers control pacing—they might post all 8 in 2 weeks mixed with other work, or stretch it across 6 weeks. That's their call.

---

## Decisions Locked In

| Question | Decision |
|----------|----------|
| Campaign length | Variable, auto-detected, framed as post count |
| Room detection | AI suggests from `aiSpaces`, designer confirms |
| Product card criteria | All tagged with complete data, designer deselects unwanted |
| Designer branding | Text attribution only ("Sarah Chen Design"), no logos |
| Posting cadence | Suggest schedule, number posts, no calendar export |
| Story format | Phase 1—include it |
| Regeneration | Overwrites previous, no versioning |
| Quick vs Campaign | Both available, campaign is default |
| Text card aesthetic | Folio brand (warm neutrals), no designer override |
| OG images | Per-project with designer name, Folio brand consistency |
| Email notifications | Thumbnail grid preview + download link |
| Storage | 30 days, regenerate on demand after expiration |

---

## Campaign Size Presets

Designers choose their campaign density. Default is **Standard**.

| Preset | Posts | What's Included |
|--------|-------|-----------------|
| **Compact** | 4-6 | Launch card + 2 best rooms + closer |
| **Standard** | 8-12 | Launch + all rooms + 2-3 product features + closer |
| **Complete** | 15-20+ | Everything—all rooms, all products, quotes, details |

**Auto-detection formula:**
```
base = 2 (launch + closer)
rooms = count of rooms with ≥3 images
products = count of tagged products with complete data ÷ 2 (rounded)
quotes = count of pull quotes from interview content

total = base + rooms + products + quotes
```

Standard preset shows best content by default (auto-curated). Designer can add more.

---

## Project Branding Layer

Every piece of content carries consistent branding:

```
┌─────────────────────────────────────────┐
│                                         │
│              [Project Image]            │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ MONTCLAIR RESIDENCE             │   │  ← Project name (editorial serif)
│  │ Sarah Chen Design               │   │  ← Designer attribution (sans-serif)
│  │ • 3 of 8                        │   │  ← Series indicator
│  └─────────────────────────────────┘   │
│                                         │
│                          folio ◊        │  ← Subtle watermark
└─────────────────────────────────────────┘
```

**Typography:**
- Project name: Orpheus Pro or similar editorial serif
- Designer name: Clean sans-serif (Inter, Helvetica Neue), smaller weight
- Series indicator: Same sans-serif, lighter weight

**Positioning:**
- Project name + attribution: Bottom-left
- Folio mark: Bottom-right corner, subtle
- Series indicator: Inline with attribution

**Color Treatment:**
- White text with subtle drop shadow for legibility on any image
- Alternative: Semi-transparent dark gradient bar at bottom (magazine caption style)

---

## Content Types

### 1. Launch Card
**Purpose:** "Now on Folio" announcement
**Format:** Single image (square or portrait)
**Always included:** Yes—every campaign starts with this

**Elements:**
- Hero image (designer-selected or auto: highest resolution, best composition)
- "Now on Folio" text treatment
- Project name + designer attribution
- Folio mark

**Caption Template:**
```
[Project Name] is now on Folio.

Every room. Every source. The story behind the design.

→ folio.ad/[slug]

#interiordesign #[style] #[location]
```

---

### 2. Room Spotlight Carousels
**Purpose:** Deep dive into each space
**Format:** 3-7 slide carousel per room
**Included in:** Standard, Complete (Compact gets 2 best rooms)

**Slide Structure:**
```
Slide 1: Wide room shot + room name overlay ("Living Room")
Slide 2: Alternate angle or detail
Slide 3: Key product in context (if tagged)
Slide 4-5: Additional details, textures
Slide 6: "Full sources → Folio" CTA card
```

**Room Selection Logic:**
- Pull room labels from post and project file
- Auto-select best rooms (most images, best quality)
- Designer can add/remove rooms

**Caption Template:**
```
[Room Name] at [Project Name].

[1-2 sentences from interview content about this space, or design decision]

📍 [Location]
✏️ @[designer_instagram]

All sources tagged in full project.

#[room]design #interiordesign #[style]
```

---

### 3. Product Feature Cards
**Purpose:** Highlight specific tagged products
**Format:** Single image or 2-slide carousel
**Included in:** Standard (2-3 best), Complete (all)

**Criteria for inclusion:**
- Product has complete data (name + vendor)
- Product is tagged in project images
- Auto-select most prominent/frequently tagged
- Designer can add/remove products

**Elements:**
- Product in context (original tagged photo)
- Product name + vendor overlay
- Optional slide 2: Product isolated (if cutout exists)

**Caption Template:**
```
[Product Name] by [Vendor Name]

Specified for [Project Name]—anchoring the [room name].

Full sources: folio.ad/[slug]

#[vendorname] #designsourcing #interiordesign
```

---

### 4. Story/Quote Cards
**Purpose:** Share design thinking, interview pull quotes
**Format:** Text on solid/blurred background
**Included in:** Standard (1-2 best), Complete (all available)

**Source:** Pull quotes from interview content, narrative excerpts

**Visual Treatment:**
- Background: Warm neutral from Folio palette (soft ivory, warm gray)
- Typography: Editorial serif for quote, sans-serif for attribution
- Minimal—words are the content

**Layout:**
```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│   "The vision was to create a space     │
│    that felt collected over time,       │
│    not decorated in a weekend."         │
│                                         │
│                   — Sarah Chen           │
│                     Montclair Residence │
│                                         │
│                          folio ◊        │
└─────────────────────────────────────────┘
```

**Caption Template:**
```
On the vision for [Project Name]:

"[Extended quote or additional context from interview]"

The full story: folio.ad/[slug]
```

---

### 5. Detail Moments
**Purpose:** Feed variety, craft appreciation
**Format:** Single square or portrait image
**Included in:** Complete only

**Selection:** Images classified as detail/texture shots, or designer-selected

**Elements:**
- Close-up detail shot
- Minimal branding (Folio mark only, no text overlay)
- Optional product tag if relevant

**Caption Template:**
```
The details at [Project Name].

[Brief observation about material, craft, or moment]

Full project on Folio.
```

---

### 6. Closer Card
**Purpose:** Campaign wrap-up, final CTA
**Format:** Single image or text card
**Always included:** Yes—every campaign ends with this

**Elements:**
- Hero image or text treatment
- "Explore the full project"
- Clear link CTA

**Caption Template:**
```
[Project Name]—the full story is on Folio.

Every room. Every source. The design decisions that shaped it.

→ folio.ad/[slug]
```

---

## Export Formats

All content types generated in multiple formats:

| Format | Dimensions | Use Case |
|--------|------------|----------|
| Feed Square | 1080×1080 | Standard feed posts |
| Feed Portrait | 1080×1350 | Carousels, feature posts |
| Story | 1080×1920 | Instagram/Facebook Stories |

**Story versions generated for:**
- Launch Card (swipe up to full project)
- Room Spotlights (teaser for feed post)
- Product Features (swipe up to shop)

---

## Campaign Wizard UI

### Main Interface

```
┌─────────────────────────────────────────────────────┐
│  Generate Instagram Campaign                        │
│  Montclair Residence                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Campaign Size                                      │
│                                                     │
│  ○ Compact        ● Standard        ○ Complete      │
│    4-6 posts        8-12 posts        15-20+ posts  │
│                                                     │
├─────────────────────────────────────────────────────┤
│  What's Included                           12 posts │
│                                                     │
│  ☑ Launch Card                                  1   │
│                                                     │
│  ☑ Room Spotlights                              4   │
│    ├ ☑ Living Room (6 images)                       │
│    ├ ☑ Kitchen (5 images)                           │
│    ├ ☐ Powder Room (2 images) ⚠️ thin               │
│    └ ☑ Primary Bedroom (7 images)                   │
│                                                     │
│  ☑ Product Features                             3   │
│    ├ ☑ Lawson Sofa — Mitchell Gold                  │
│    ├ ☑ Saarinen Table — Knoll                       │
│    └ ☑ Apparatus Pendant — Apparatus Studio         │
│                                                     │
│  ☑ Story Cards                                  2   │
│    ├ ☑ "The vision was to create..."                │
│    └ ☑ "We chose white oak throughout..."           │
│                                                     │
│  ☐ Detail Moments                               0   │
│                                                     │
│  ☑ Closer                                       1   │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Formats                                            │
│  ☑ Feed (1080×1080, 1080×1350)                      │
│  ☑ Stories (1080×1920)                              │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Suggested pacing: 2 posts/week ≈ 6 weeks           │
│  Mix with other projects for feed variety.          │
│                                                     │
│  [Preview Campaign]      [Generate & Download]      │
└─────────────────────────────────────────────────────┘
```

### Share Button Flow

**Location:** Project page, prominent position

```
┌────────────────────────────────┐
│  Share                     ▾   │
├────────────────────────────────┤
│  📸 Instagram Campaign         │
│  💾 Download Images            │
└────────────────────────────────┘
```

**Instagram Campaign** → Opens campaign wizard (default)
**Download Images** → Quick export (single image or simple carousel)

---

## Open Graph Images (P0)

Every published project at `/p/[slug]` must have dynamic OG images.

**Generated per-project with:**
- Hero image (auto-selected or designer-chosen)
- Project name (editorial serif, prominent)
- Designer name (smaller, beneath project name)
- Folio mark (subtle, corner)

**Dimensions:**
- `og:image` — 1200×630 (Facebook, LinkedIn, Twitter summary_large_image)
- Additional: 1080×1080 for platforms that crop square

**Meta tags required:**
```html
<meta property="og:title" content="[Project Name] | [Designer Name] on Folio" />
<meta property="og:description" content="[Excerpt or first 160 chars of narrative]" />
<meta property="og:image" content="https://folio.ad/api/og/[slug]" />
<meta property="og:url" content="https://folio.ad/p/[slug]" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://folio.ad/api/og/[slug]" />
```

**This is a P0 launch blocker.** Every link share is an advertisement for Folio. Generic or missing previews undermine the entire positioning.

---

## Technical Implementation

### Image Generation Pipeline

**Stack:** Sharp (image manipulation) + Satori (text rendering)

**Process:**
1. User selects preset and confirms selections
2. Server queries project data (images, rooms, products, interview content)
3. For each asset:
   - Load base image from storage
   - Apply branding overlay (Sharp composite)
   - Render text elements (Satori → PNG → composite)
   - Resize to target dimensions
   - Optimize (JPEG 85% for photos, PNG for text cards)
4. Bundle into ZIP with organized folder structure
5. Upload ZIP to temporary storage
6. Return download URL (or stream directly if small)

**ZIP Structure:**
```
montclair-residence-campaign/
├── 01-launch/
│   ├── launch-square.jpg
│   ├── launch-portrait.jpg
│   └── launch-story.jpg
├── 02-living-room/
│   ├── slide-1-portrait.jpg
│   ├── slide-2-portrait.jpg
│   ├── ...
│   └── story-teaser.jpg
├── 03-kitchen/
│   └── ...
├── 04-product-lawson-sofa/
│   └── ...
├── 05-quote-vision/
│   ├── quote-square.jpg
│   └── quote-story.jpg
├── 06-closer/
│   └── ...
├── captions.txt
└── README.txt
```

**Included extras:**
- `captions.txt` — All caption templates, ready to copy-paste
- `README.txt` — Suggested posting schedule, tips for mixing with other content

### API Endpoints

```
POST /api/projects/[id]/campaign/generate
Body: {
  preset: 'compact' | 'standard' | 'complete' | 'custom',
  selections: {
    launch: true,
    rooms: ['living-room', 'kitchen', 'primary-bedroom'],
    products: ['product-id-1', 'product-id-2'],
    quotes: ['quote-id-1'],
    details: false,
    closer: true
  },
  formats: ['feed', 'stories']
}
Response: {
  jobId: 'abc123',
  status: 'processing',
  estimatedTime: 45 // seconds
}

GET /api/projects/[id]/campaign/status/[jobId]
Response: {
  status: 'complete',
  downloadUrl: 'https://...',
  expiresAt: '2026-02-15T...',
  postCount: 12,
  assets: [
    { type: 'launch', formats: ['square', 'portrait', 'story'] },
    { type: 'room', name: 'Living Room', slideCount: 5 },
    ...
  ]
}

GET /api/og/[slug]
Response: Dynamic OG image (1200×630 JPEG)
```

### Storage & Cleanup

- Generated campaigns stored in Supabase Storage (or S3)
- 30-day TTL on generated assets
- Cleanup job runs daily, deletes expired campaigns
- Regeneration creates fresh assets, replaces download URL
- Source project data (images, content) never deleted—only generated derivatives

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**P0 — Launch Blocker:**
- [ ] OG image generation for `/p/[slug]` pages
- [ ] Meta tags on all public project pages

**P1 — Core Campaign:**
- [ ] Campaign wizard UI (presets, selection)
- [ ] Launch Card generation (all 3 formats)
- [ ] Room Spotlight carousel generation
- [ ] Series numbering on all assets
- [ ] ZIP bundling with folder structure
- [ ] Basic caption templates in `captions.txt`
- [ ] Share button with Instagram/Download choice

### Phase 2: Full Campaign (Week 3-4)

- [ ] Product Feature card generation
- [ ] Story/Quote card generation
- [ ] Closer card generation
- [ ] Email notification on completion
- [ ] Quick Export escape hatch

### Phase 3: Polish (Week 5+)

- [ ] `README.txt` with posting guide
- [ ] Preview modal before generation
- [ ] Story format optimization
- [ ] Detail Moments (Complete preset)
- [ ] Analytics: track campaign downloads, regenerations

---

## Success Metrics

**Adoption:**
- % of published projects with campaign generated
- Average posts per campaign (are designers using Standard or trimming?)
- Regeneration rate (indicates iteration/refinement)

**Quality:**
- Do designers actually post the generated content?
- Survey: "Would you be embarrassed or proud to post this?"
- Do posts remain in grid long-term (not deleted)?

**Growth:**
- Click-through from Instagram to Folio
- New visitors attributed to Instagram shares
- Folio link in bio adoption rate

---

**Status:** Phase 1 in progress
**Last Updated:** 2026-01-17

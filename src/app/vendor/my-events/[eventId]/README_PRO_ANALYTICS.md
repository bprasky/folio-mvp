# Pro Analytics Dashboard — Final Polish

## Overview
The vendor event analytics dashboard has been rebuilt into a confident, professional analytics console with:
- **Bold, legible typography** (Inter 600, tabular numerics)
- **High-signal charts** with AI breakdowns
- **Causal WHY** explanations for every recommendation
- **Aggressive revenue plays** with historical lift data

## Structure

### Tabs
1. **Overview** — Flow, Time-to-Spec, Opportunity, Top Insights
2. **Engagement** — Room×Phase Heatmap, Saves Over Time, Trend Materials
3. **Markets** — Geographic distribution with revenue plays
4. **Accounts & Products** — Top clients + aggressive plays, Lowest products with fixes
5. **Benchmarks** — Visual gaps + driver delta analysis

## Key Features

### Influence Flow
- Horizontal bar visualization with cohort benchmarks
- Shaded gaps show expected leakage vs industry median
- Fix suggestions with historical lift data (+9–12 pts typical)
- Color-coded: teal = on track, rose = leak detected

### Room×Phase Heatmap
- **Every cell shows a value** (0-100%)
- Hover tooltip: Saves, Tags, Rate, Δ vs baseline (45%), Asset gap
- Footer legend with clear color scale
- Asset gap icons: 🎨 renders, 📋 specs, 📦 samples, 🖼️ images

### Saves Over Time
- **Daily granularity** (not event-level aggregates)
- Dual lines: Saves (teal) + Tags (emerald)
- Faint cumulative area overlay
- Spike annotations: ⚡ Opening session, ⚡ Booth QR campaign

### Geographic Actions (Revenue Moves)
Replaced generic "regional look-alikes" with:
- 🎯 Host micro-event in [City] with Folio designers
- 🤝 Connect 10 local [City] designers
- 📸 Commission [City] renders/photos
- 🔄 Cross-boost NYC post into [City]
- 🚀 Run designer boost targeted to [City] look-alikes

### Accounts — Aggressive Plays
For high-value firms ($1M+ potential):
- **VIP Dinner** — Past 8 dinners → +7–10 pts tag→spec
- **Boost their post (paid)** — Social proof → +6 pts save→tag
- **Capsule collab board** — Co-created → +10 pts save→tag, +12% AOV
- **Account review** — Timing alignment → +6 pts tag→spec

Each play shows:
- Historical evidence (e.g., "12 campaigns, avg +5.8 pts")
- Expected lift in pts
- Confidence level

### Lowest Products
Table shows:
- **Strong vs Weak markets** — Where product performs well vs poorly
- **Fix-it actions**:
  - Upload missing assets (+12 pts est.)
  - Cross-market boost (leverage strong market assets)
  - Designer case study
  - Bundle into "Starter set"

### Benchmarks with Driver Delta
Visual dual bars showing You | Prev3 | Cohort for:
- Save → Tag conversion
- Tag → Spec completion
- Value Index

**Driver bullets** explain gaps:
- "+12 pts: Kitchen FF&E asset quality" (click to view)
- "−4 pts: Miami share" (click to view)
- "+5 pts: Bath spec sheets" (click to view)

## AI Breakdown Structure
Every chart module includes:
1. **What Happened** — 1-sentence data summary
2. **Why It Matters** — Business impact or causal explanation
3. **Do This Next** — 1-3 action buttons with payload
4. **Supporting Data** — 3-5 data receipts with deep-links
5. **Expected Impact** — Lift ($k), Confidence, Decay (−%/day)

## Typography & Formatting
- Headings: 16px / 600 weight
- Numerics: Tabular-nums, right-aligned in tables
- Tooltips: Include units (%, $, designers, pts)
- Legend: Always present, clear labels

## Historical Lift Data (Causality)
From `lib/impact/causality.ts`:
- Spec pack: +8 pts save→tag, +3 pts tag→spec
- Sample kit: +5 pts save→tag, +2 pts tag→spec
- Review meeting: +6 pts tag→spec
- VIP dinner: +1 relationship score, +8 pts tag→spec
- Boost post: +30% reach, +6 pts save→tag
- Capsule collab: +45% reach, +10 pts save→tag, +12% AOV

## Demo Mode (Ready)
Dashboard supports `demoActive` prop for live tweaking. When demo knobs change:
- Charts shimmer and re-render
- AI breakdowns regenerate
- "Demo Impact" badge appears on affected modules

## Testing
Navigate to `/vendor/my-events/event-1` to see the dashboard with mock data.

## Next Steps
- Wire real API data (replace `getEventPostReport` calls)
- Add Demo Mode UI (sheet with sliders/toggles)
- Implement actual playbook execution (toasts + backend calls)
- Add export to PDF functionality










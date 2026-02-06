# Folio UI/UX Design Audit Report

**Date:** 2026-02-06
**Auditor:** Claude Code
**Scope:** Designer-facing UI/UX across all critical paths

---

## Executive Summary

### Overall Design System Health Score: **6.5/10**

The codebase has a **strong design system foundation** that is **inconsistently applied**. A sophisticated neumorphic design language exists with warm colors, editorial typography, and premium interactions — but 1,700+ style overrides bypass it entirely.

### Top 5 Highest-Impact Fixes

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| 1 | **34 modals lack exit animations** | High (feels broken) | Quick |
| 2 | **1,122+ default Tailwind colors** bypass brand system | High (feels generic) | Medium |
| 3 | **616 inline style= attributes** with hardcoded hex colors | High (inconsistent) | Medium |
| 4 | **Projects dashboard feels admin, not portfolio** | High (wrong UX mode) | Significant |
| 5 | **Button hover states missing transforms** | Medium (feels flat) | Quick |

---

## 1. Global Style System

### What Exists and is Working

**Typography System (Excellent)**
- **Headline:** Cormorant Garamond (serif, elegant, editorial)
- **Body:** Instrument Sans (clean sans-serif, modern)
- **Mono:** IBM Plex Mono (technical/code contexts)
- Loaded via `next/font` with `display: swap` (good performance)
- CSS variables: `--font-headline`, `--font-body`, `--font-logo`
- Typography scale: `folio-h1` through `folio-meta` defined in both CSS and Tailwind

**Color System (Well-Defined)**
```css
--bg-base: #FFFFFF          /* Pure white base */
--bg-elevated: #FAFAF9      /* Warm off-white surfaces */
--text-primary: #1A1A1A     /* Near-black text */
--text-secondary: #5C5C5C   /* Medium gray */
--text-tertiary: #8C8C8C    /* Light gray/placeholder */
--accent: #B8845C           /* Warm brown/tan (brand accent) */
--accent-hover: #A67548     /* Darker hover state */
--shadow-dark: #D4CFC8      /* Warm brownish shadow */
--shadow-light: #FFFFFF     /* Light highlight */
```

**Neumorphic Shadow System (Unique & Premium)**
```css
--neu-raised: 4px 4px 10px var(--shadow-dark), -4px -4px 10px var(--shadow-light);
--neu-inset: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
```

**Component Classes (globals.css)**
- `.ridge-card` — Neumorphic card with double-border effect
- `.ridge-btn` — Secondary button with raised shadow
- `.accent-btn` — Primary CTA with warm brown color
- `.ridge-input` — Inset input fields
- `.folio-h1` through `.folio-meta` — Typography classes

### What's Defined But Not Being Used

| Token | Defined In | Actual Usage |
|-------|-----------|--------------|
| `--folio-bg` | globals.css | Rarely used (hardcoded hex instead) |
| `--folio-surface` | globals.css | Rarely used |
| `--folio-accent-200/400/700` | globals.css | Components use `#B8845C` directly |
| `bg-neu-base` | tailwind.config | Rarely used |
| `shadow-folio1/2/3` | tailwind.config | Rarely used |
| `transition-folio` | tailwind.config | Not found in components |

### What's Missing Entirely

1. **Page transition system** — No global AnimatePresence for route changes
2. **Skeleton loading components** — Using `animate-pulse` CSS, not Framer Motion
3. **Design token documentation** — No Storybook or style guide
4. **Dark mode consistency** — Defined in CSS but not systematically applied

---

## 2. Elevation & Depth

### Current State

**Shadow Definitions:**
- `shadow-sm` → `shadow-md` → `shadow-lg` (Tailwind defaults)
- `shadow-neu-raised` / `shadow-neu-inset` (Custom neumorphic)
- `shadow-folio1/2/3` (Custom elevation tokens — underused)

**Background Layering:**
```
Body bg: var(--bg-base) = #FFFFFF
↓
Layout bg: var(--bg-base) = #FFFFFF (SAME - flatness source)
↓
Card bg: var(--bg-base) = #FFFFFF (SAME - flatness source)
↓
Input bg: var(--bg-base) = #FFFFFF (SAME)
```

**Problem:** All layers share the same white background. Depth comes only from shadows, not color contrast.

### Components Needing Depth Treatment

| Component | Current | Recommended |
|-----------|---------|-------------|
| Feed page background | `bg-white` | `bg-[var(--bg-elevated)]` or subtle gradient |
| Dashboard sections | `bg-white` | `bg-[var(--folio-surface)]` |
| Form containers | No background | `bg-[var(--bg-elevated)]` |
| Modal backdrops | `bg-black/50` | `bg-black/60 backdrop-blur-sm` |

---

## 3. Interactive Elements

### Button State Coverage

**Buttons WITH Full States (Hover + Active + Focus):**
- `.accent-btn` (CSS class) — shadow shift + color change + inset active
- `.ridge-btn` (CSS class) — shadow shift + inset active
- `AtelierCTAs.tsx` — Framer Motion scale (1.02/0.98)
- `DesignerCTAs.tsx` — Framer Motion scale (1.02/0.98)

**Buttons WITH Partial States (Hover only):**
- `button.tsx` (base component) — `transition-all` but no transform
- `glass-button.tsx` — `transition-colors` only (no movement)
- `ExportButton.tsx` — `hover:bg-blue-700` only
- `CreateButton.tsx` — `hover:opacity-90` only
- Most other buttons — color change only

**Coverage:** ~15% of buttons have full premium states (hover + active + focus + transform)

### Card Interaction Coverage

| Pattern | Count | Example Components |
|---------|-------|-------------------|
| Shadow elevation on hover | 17 cards | ProjectCard, ProductCard, FestivalCard |
| Image zoom on hover | 15 cards | Most feed cards via `group-hover:scale-105` |
| Overlay fade on hover | 10 cards | InspireCard, MomentCard |
| Text color change on hover | 6 cards | ProjectCard (org-profile) |
| Framer Motion whileHover | 1 card | InspireCard only |

**Coverage:** ~90% of cards have hover states, but only 1 uses Framer Motion for premium feel

### Form Input Polish Level

**Input Component Variants:**
- `default` — Border + blue focus ring (generic)
- `ridge` — Neumorphic inset shadow + warm accent focus (premium)

**Current Usage:** Most forms use `default` variant, not `ridge`

**Focus States:**
- Blue ring (`focus:ring-2 focus:ring-blue-500`) — 80% of inputs
- Warm accent ring (`ring-[var(--accent)]/15`) — 20% of inputs

**Drag-over Feedback:**
- File uploads have blue border + blue background on drag ✓
- Consistent `transition-colors` on drag zones ✓

---

## 4. Motion & Animation

### Where Framer Motion IS Used (40+ components)

**Good Implementations:**
- `ShopProductModal.tsx` — Full AnimatePresence with backdrop fade + modal scale
- `CollapsibleSection.tsx` — Height collapse animation + prefers-reduced-motion support
- `AtelierCTAs.tsx` — whileHover/whileTap scale animations
- `DemoTourOverlay.tsx` — Fullscreen intro sequences

**Animation Patterns:**
- Entry: `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}`
- Hover: `whileHover={{ scale: 1.02 }}`
- Tap: `whileTap={{ scale: 0.98 }}`
- Stagger: `transition={{ delay: index * 0.1 }}`

### Where Framer Motion is NEEDED But Missing

| Component Type | Count | Current Behavior |
|----------------|-------|------------------|
| Modals without exit animations | 34 | Just disappear (`if (!open) return null`) |
| Page transitions | All | No animation between routes |
| List filter changes | All | No transition when filters applied |
| Dropdown menus | All | No entry/exit animation |
| Tooltip entry | All | No animation |
| Accordion panels | Most | CSS-only (except CollapsibleSection) |

### Quick-Win Animation Additions

1. **Modal wrapper component** with built-in AnimatePresence:
```tsx
// Pattern to implement:
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  )}
</AnimatePresence>
```

2. **Button hover lift** (quick CSS fix):
```tsx
// Add to button base classes:
"hover:-translate-y-[1px] active:translate-y-[0.5px] transition-all"
```

3. **List stagger** for feed items:
```tsx
// Pattern for feed cards:
transition={{ duration: 0.3, delay: index * 0.05 }}
```

---

## 5. The Override Problem

### Components Using Design System Correctly

- `src/app/feed/page.tsx` — Uses CSS variables, ridge cards, folio typography
- `src/components/posting/PostCard.tsx` — Uses `[var(--text-primary)]` etc.
- `src/components/ui/button.tsx` — Maps to `.accent-btn` / `.ridge-btn`
- `src/components/inspire/InspireCard.tsx` — Full design system + Framer Motion

### Components Going Rogue

**Inline Styles (616 instances):**
```tsx
// Common pattern found:
style={{ backgroundColor: '#FAF9F7' }}  // Should be var(--bg-elevated)
style={{ color: '#8B8178' }}            // Should be var(--text-secondary)
```

**Top offenders:**
- `/src/app/org/[orgId]/page.tsx` — 20+ inline styles
- `/src/app/professionals/*/page.tsx` — 15+ inline styles
- `/src/app/community/page.tsx` — Hardcoded badge colors

**Default Tailwind Colors (1,122 instances):**

| Color Class | Count | Should Be |
|-------------|-------|-----------|
| `text-gray-600` | 342 | `text-[var(--text-secondary)]` |
| `text-gray-700` | 326 | `text-[var(--text-primary)]` |
| `border-gray-300` | 217 | `border-[var(--ridge-outer)]` |
| `bg-gray-50` | 169 | `bg-[var(--bg-elevated)]` |
| `bg-blue-600` | 109 | `bg-[var(--accent)]` |

### Third-Party Components

- **Sonner** (toast) — Self-contained, styled appropriately
- **React Hot Toast** — Uses default styling (some admin pages)
- **Radix UI** — Custom `dialog.tsx` wrapper exists but lacks animations
- **No MUI/Chakra** — Good (no competing design system)

---

## 6. Critical Path Quality

### Feed Page (`/src/app/feed/page.tsx`)

**Grade: A-**

**Strengths:**
- Editorial-grade card design with `ridge-card` pattern
- Image hover scales (`group-hover:scale-105 duration-500`)
- Proper typography hierarchy (folio-h3 titles, folio-meta bylines)
- Designer attribution prominent
- Trending section creates discovery

**Weaknesses:**
- No engagement UI (save/like buttons) on cards
- No loading skeleton (uses basic spinner)

### Published Post Page (`/src/app/editorials/[id]/page.tsx`)

**Grade: C**

**Strengths:**
- Functional layout with clear sections
- Author bio card included

**Weaknesses:**
- Gray backgrounds (`bg-gray-50`) feel utilitarian
- Generic button styling (not brand buttons)
- No cinematic hero image treatment
- Typography mixing (not using folio-* consistently)
- No related content suggestions

### Project Creation (`/src/app/projects/new/page.tsx`)

**Grade: B-**

**Strengths:**
- Clean form layout
- Progressive disclosure (accordion for advanced)
- Error states functional
- Loading state prevents double-submit

**Weaknesses:**
- No wizard/stepper pattern
- Basic inputs (not premium `ridge` variant)
- No preview before submit
- Footer hint text too small

### Designer Dashboard (`/src/app/projects/ProjectsPageClient.tsx`)

**Grade: C-**

**Strengths:**
- Project lifecycle well-modeled (DRAFT → PUBLISHED → ARCHIVED)
- Search/filter functional
- Responsive grid
- Status badges clear

**Critical Weaknesses:**
- **Feels like admin panel, not portfolio**
- KPI metrics prominent (projects, views, affiliate clicks)
- Internal state leaked to user ("Ready to Publish", "Editorial Candidate")
- No curation/favoriting
- No portfolio showcase mode
- "Folio Index" drawer shows analytics, not narrative

---

## 7. Recommended Fix Order

### Quick Wins (High Impact, Low Effort)

1. **Add AnimatePresence to modals** — Create reusable `AnimatedModal` wrapper
   - Affects 34 modals
   - ~2 hours work
   - Immediate perceived quality improvement

2. **Add button hover transforms** — Update `button.tsx` base classes
   ```tsx
   "hover:-translate-y-[1px] active:translate-y-[0.5px] hover:shadow-md active:shadow-sm"
   ```
   - ~30 minutes work
   - Makes all buttons feel tactile

3. **Replace default blue with accent color** — Global search/replace
   - `bg-blue-600` → `bg-[var(--accent)]`
   - `focus:ring-blue-500` → `focus:ring-[var(--accent)]`
   - ~1-2 hours work

### Medium Effort (High Impact)

4. **Create background layering system**
   - Add `bg-[var(--bg-elevated)]` to cards on `bg-[var(--bg-base)]` pages
   - Creates depth without shadows
   - ~4 hours work

5. **Replace inline styles with CSS variables**
   - Focus on top 5 offending files first
   - ~6 hours work

6. **Upgrade form inputs to `ridge` variant**
   - Change default variant in input.tsx
   - ~2 hours work

### Significant Effort (Strategic)

7. **Redesign Projects Dashboard as Portfolio Gallery**
   - Move metrics to analytics drawer
   - Add "featured projects" section
   - Remove internal state badges
   - ~2-3 days work

8. **Elevate Editorial Post Page**
   - Cinematic hero image
   - Replace gray backgrounds
   - Add related content
   - ~1-2 days work

9. **Add page transitions**
   - Wrap app in AnimatePresence
   - Add shared layout animations
   - ~1 day work

---

## File Reference Table

| Category | Key Files | Status |
|----------|-----------|--------|
| **Global Styles** | `src/app/globals.css` | Well-defined, underused |
| **Tailwind Config** | `tailwind.config.js` | Tokens exist, bypassed |
| **Root Layout** | `src/app/layout.tsx` | Fonts loaded correctly |
| **Button Component** | `src/components/ui/button.tsx` | Needs hover transforms |
| **Input Component** | `src/components/ui/input.tsx` | Has `ridge` variant, not default |
| **Card Pattern** | `.ridge-card` in globals.css | Well-designed, used in feed |
| **Feed Page** | `src/app/feed/page.tsx` | Editorial-grade |
| **Editorial Page** | `src/app/editorials/[id]/page.tsx` | Needs elevation |
| **Dashboard** | `src/app/projects/ProjectsPageClient.tsx` | Admin feel, needs redesign |
| **Modal Base** | `src/components/ui/dialog.tsx` | Needs AnimatePresence |

---

## Architectural Patterns to Preserve

1. **Neumorphic ridge-card pattern** — Unique, premium feel
2. **CSS variable system** — Well-architected, just needs enforcement
3. **Typography pairing** — Cormorant/Instrument Sans works beautifully
4. **Warm color palette** — Matches interior design aesthetic
5. **Group hover patterns** — Coordinated card animations

## Architectural Patterns to Change

1. **Move from gray-* to var(--) colors** — Enforce design system
2. **Default to ridge input variant** — Premium form feel
3. **Require AnimatePresence for modals** — Consistent polish
4. **Add button transforms** — Tactile feedback
5. **Separate portfolio view from admin view** — Context-appropriate UX

---

## Summary

Folio has a **premium design system that's being undermined by inconsistent usage**. The foundation is excellent:
- Warm, editorial color palette ✓
- Sophisticated neumorphic shadows ✓
- Professional typography pairing ✓
- Well-defined CSS variables ✓

But execution leaks quality:
- 1,700+ style overrides bypass the system
- 34 modals lack exit animations
- Dashboard feels admin-grade, not portfolio-grade
- Buttons lack tactile feedback

The hypothesis is confirmed: **global styles exist but are being overridden at the component level**. The fix is enforcement, not redesign.

Focus energy on:
1. Animation polish (quick wins)
2. Design system enforcement (medium effort)
3. Dashboard UX mode shift (strategic)

The platform's brand promise of "quiet elegance, editorial minimalism" is achievable with the existing foundation — it just needs consistent application.

# Audit: Product Detail Page (`/products/[productId]`)

**Date:** 2026-04-06  
**Type:** READ-ONLY audit  
**Scope:** Hardcoded content, design system compliance, day-1 readiness

## Context
Two route variants exist: `/products/[slug]` (cinematic/standard toggle) and `/product/[productId]` (legacy DB-direct). The cinematic layout is gated behind `NEXT_PUBLIC_FEATURE_CINEMATIC_PRODUCT`.

---

## 1. Hardcoded Content Scan

### CRITICAL: Mock Data Spread Into Every Real Product
**File:** `src/lib/products/getProductById.ts:29-60`  
**Issue:** `getProductById()` spreads `MOCK_PRODUCT` as defaults (`...MOCK_PRODUCT`) then overrides with DB fields. This means **every real product** inherits:

| Mock Field | Hardcoded Value | Should Come From |
|---|---|---|
| `inspiration` (line 57) | 4 fake tagged images with "/demo/inspo1-4.jpg", fake designers "Studio Linares", "Atelier North", "Field & Co.", "Arbor Design" | `ProductTag` joins → `ProjectImage` (real tagged appearances) |
| `insights` (line 58) | `{saves: 842, tags: 196, saveToTagPct: 23}`, fake topRooms/topMarkets | `EngagementEvent` / `EventProductStat` aggregations |
| `related` (line 59) | 3 fake products: "Terra Console", "Calacatta Coffee Table", "Oak Ribbon Chair" with "/demo/rel1-3.jpg" | Query by same vendor/category/materials |
| `files` (line 54) | Fake spec sheets and 3D files with `href:"#spec-pdf"`, `"#obj"`, `"#rfa"`, `"#care"` | Real uploaded files or `Product.specsJson` |
| `dimensions` (line 48) | `{w:20, d:20, h:18, units:"in"}` | `Product.specsJson` or dedicated fields |
| `assets` (line 43, fallback) | "/demo/terra1.jpg", "/demo/terra2.jpg", "/demo/terra.mp4" when product has no `imageUrl` | `Product.imageUrls`, `Product.primaryImageUrl` |

**Severity:** P0 — Users will see fake designer names, fake stats, fake related products, and broken `/demo/` image links on every real product page.

### Other Hardcoded Strings

| File | Line | Value | Issue |
|---|---|---|---|
| `src/lib/mock/product.ts:31-68` | Entire file | `MOCK_PRODUCT` with "Terra Travertine Side Table", "Folio Studio" brand, "FS-TERRA-20" SKU | Used as fallback defaults for all products |
| `src/components/product/PrimaryActions.tsx:28` | 28 | `"Material Bank sample requested"` | Hardcoded vendor name — should be generic or dynamic |
| `src/components/product/PrimaryActions.tsx:74` | 74 | `"💡 Connect Material Bank + Folio to auto-log sampling"` | Hardcoded vendor name in info text |
| `src/components/product/EditorialInspirationGrid.tsx:27` | 27 | `"Most-liked affiliate-tagged images from the Folio community"` | Static subtitle, acceptable as UI copy |
| `src/components/product/RelatedFibonacciGrid.tsx:34` | 34 | `"From the same collection or similar materials"` | Static subtitle, acceptable as UI copy |
| `src/components/product/DownloadsPanel.tsx:103` | 103 | `"Updated recently"` | Placeholder timestamp |
| `src/app/product/[productId]/page.tsx:104` | 104 | `"← Back to Magazine"` | Hardcoded navigation destination |
| `src/app/product/[productId]/page.tsx:293` | 293 | `{product.sourceType \|\| "Unknown source"}` | Fallback "Unknown source" — acceptable |
| `src/app/products/[slug]/page.tsx:14` | 14 | `console.log('🎭 Product name in component props:')` | Debug log in production |
| `src/lib/products/getProductById.ts:25` | 25 | `console.log('🧠 Product name from DB:')` | Debug log in production |

---

## 2. Empty/Null State Handling

| Scenario | Behavior | Verdict |
|---|---|---|
| **No image** | Cinematic route: falls back to MOCK_PRODUCT assets (broken `/demo/` paths). Legacy route: resolves via `imageUrls → primaryImageUrl → imageUrl → []` chain | **BROKEN** on cinematic; OK on legacy (uses `SafeImage` fallback) |
| **No vendor** | Shows `"Unknown"` brand from `getProductById:37` | **OK** but generic |
| **No testimonials** | `DesignerTestimonials` returns `null` if empty (line 76) | **OK** — section hides cleanly |
| **No project appearances** | Cinematic: `InspirationGrid` renders with mock data (always shows fake projects). Legacy: grid shows 0 count | **BROKEN** on cinematic (shows fake data) |
| **No description** | Shows empty string, empty `<p>` rendered | **MINOR** — empty container visible |
| **No price** | Legacy route: price section conditionally renders. Cinematic: no price display at all | **OK** |
| **No vendor logo** | Legacy: vendor section renders without image. Cinematic: no vendor logo shown | **OK** |
| **No materials/finish** | Cinematic shows empty strings from `materials: []`, `finish: ""` | **MINOR** — empty rows visible in details grid |
| **Invalid product ID** | Both routes call `notFound()` → proper 404 page | **OK** |

---

## 3. Design System Compliance

### Typography
| Check | Status | Detail |
|---|---|---|
| Headlines use Cormorant Garamond | **PARTIAL** | Cinematic components use `font-serif` (maps to Canela fallback stack, NOT `font-headline`). `ProductPage.tsx:16` uses no font class at all (defaults to body font) |
| Body uses Instrument Sans | **OK** | Root layout applies `--font-body` variable; body text defaults correctly |
| Font imports loading | **OK** | `next/font/google` with `display: 'swap'` in `layout.tsx` |
| Wrong fonts used | **FLAG** | `font-serif` in Tailwind maps to `Canela, Georgia, 'Times New Roman', serif` (see tailwind.config.js:173), NOT Cormorant Garamond. Should use `font-headline` class instead |

**Affected files using `font-serif` instead of `font-headline`:**
- `CinematicHero.tsx:122` — product name in hero
- `EditorialInspirationGrid.tsx:23` — section header
- `RelatedFibonacciGrid.tsx:30` — section header
- `DesignerTestimonials.tsx:127` — quote marks

### Color Palette
| Check | Status | Detail |
|---|---|---|
| No harsh #000000 | **FLAG** | `EditorialInspirationGrid.tsx:76` uses `from-black/80 via-black/20` gradient overlay. `RelatedFibonacciGrid.tsx:106` uses `from-black/80 via-black/40`. These are cold black alphas over images |
| Warm neutrals only | **FLAG** | `ProductPage.tsx` uses cold Tailwind grays: `#1F2937`, `#6B7280`, `#E5E7EB`, `#111827` (Tailwind gray-800, gray-500, gray-200, gray-900). Should use Folio warm tokens |
| `SpecsAccordion.tsx` | **FLAG** | Uses `#E5E7EB` (cold gray border), `#6B7280`, `#111827`, `#2563EB` (blue link) — none match warm palette |
| Gold accent `#c9a96e` | **OK** | Used in glass-badge, accent-btn. Not overused |
| Surface levels correct | **OK** | `bg-surface-canvas`, `bg-surface-ground` used appropriately |

### Glass System
| Check | Status | Detail |
|---|---|---|
| Glass tokens from six-class system | **OK** | `glass-surface` used in GlassPanel, ActionDock; `glass-overlay` in modals |
| Warm mesh + overflow:hidden | **OK** | Defined in `glass-tokens.css` with `overflow: hidden` on pseudo-elements |
| Photos sacred — no overlay | **FLAG** | `EditorialInspirationGrid.tsx:76` applies `bg-gradient-to-t from-black/80` OVER photos. `RelatedFibonacciGrid.tsx:106` same pattern. These violate "photos are sacred" principle |

### Spacing & Layout
| Check | Status | Detail |
|---|---|---|
| Tailwind spacing scale | **OK** | Uses standard `gap-8`, `py-16`, `px-4` etc. |
| No arbitrary px values | **OK** | No inline px spacing found |
| Responsive breakpoints | **OK** | `lg:grid-cols-2`, `lg:col-span-7`, mobile-first patterns |
| Image aspect ratios | **OK** | `object-cover` used consistently, `SafeImage` handles errors |

---

## 4. Data Flow Audit

| Check | Finding |
|---|---|
| **Fetch method** | `/products/[slug]`: Server-side RSC via `getProductById()` → Prisma. `/product/[productId]`: Server-side RSC via direct Prisma query. Testimonials: client-side `useEffect` fetch to `/api/products/[id]/testimonials` |
| **URL param validation** | Product fetched by ID/slug with `findUnique`. No format validation (accepts any string) |
| **404 handler** | Both routes call `notFound()` if product is null — **OK** |
| **N+1 queries** | No N+1 detected. Legacy route uses single Prisma `include` chain. Testimonials are a separate client-side fetch (appropriate) |
| **Sensitive data exposure** | `isPending` field returned in `/api/products` list endpoint (minor info leak). PUT endpoint at `/api/products/[productId]` has **no authentication** — anyone can update any product (**security gap**) |

---

## 5. "Featured In" / Project Appearances

| Check | Finding |
|---|---|
| **Exists?** | Yes — `InspirationGrid` / `EditorialInspirationGrid` in cinematic layout; "Used in X Projects" section in legacy route |
| **Data source (cinematic)** | Pulls from `product.inspiration` which is **always mock data** (see §1) — fake images/designers |
| **Data source (legacy)** | Pulls from `product.projectTags` → real `ProjectImage` + `Project` joins — **real data** |
| **Links functional?** | Legacy: links to `/project/{id}` — questionable (should be `/p/[slug]`?). Cinematic: no links (grid items are decorative) |
| **Empty state** | Cinematic: never empty (mock data always present). Legacy: shows "Used in 0 Projects" with empty grid |

---

## 6. Testimonials / "What Designers Are Saying"

| Check | Finding |
|---|---|
| **Exists?** | Yes — `DesignerTestimonials` component, rendered in legacy route at line 257 |
| **In cinematic layout?** | **NO** — not rendered in `CinematicProductPage.tsx` |
| **Data source** | Client-side fetch from `/api/products/[id]/testimonials` → `ProductTestimonial` model with `ShopProduct` designer join |
| **Empty state** | Returns `null` (hides section) — **OK** |
| **Designer links** | Links to `/designer/{id}?tab=shop` — functional |
| **Featured badge** | Shows gold badge for `isFeatured=true` testimonials |

---

## 7. CTAs and Actions

| Action | Auth Required? | Hardcoded? | Notes |
|---|---|---|---|
| Order Sample | No auth check | `"Material Bank sample requested"` toast — **hardcoded vendor** | Should be generic or vendor-aware |
| Save to Moodboard | No auth check visible | No | Shows toast only |
| Add to Project | No auth check in UI | No | API endpoint requires auth |
| Download Spec | No | `href:"#spec-pdf"` — **mock link** | Points to anchor, not real file |
| Download 3D | No | `href:"#obj"`, `"#rfa"` — **mock links** | Points to anchors, not real files |
| Share | No | No | Shows toast only |

**Auth gap:** None of the `PrimaryActions` buttons check authentication status or redirect to login. The `save-to-project` API does require auth, but the UI doesn't surface this gracefully.

---

## 8. SEO / Meta

| Check | Finding |
|---|---|
| **Dynamic `<title>`** | **MISSING** — neither `/products/[slug]` nor `/product/[productId]` exports `generateMetadata`. Pages use root layout metadata: `"FOLIO \| Next-Gen Interior Design Platform"` |
| **Dynamic `<meta description>`** | **MISSING** — same as above |
| **Open Graph image** | **MISSING** — no OG image set from product data |
| **URL structure** | Two conflicting routes: `/products/[slug]` and `/product/[productId]`. No canonical URL set. **Confusing** — which is canonical? |

---

## Summary: Priority Findings

### P0 — Must Fix Before Launch
1. **Mock data contamination** (`getProductById.ts:31`): Every real product shows fake inspiration images, fake insights stats, fake related products, and broken `/demo/` file links from `MOCK_PRODUCT` spread
2. **No SEO metadata**: Product pages have no dynamic title, description, or OG tags
3. **Unauthenticated PUT endpoint** (`/api/products/[productId]/route.ts:71`): Anyone can update any product

### P1 — Should Fix
4. **Wrong font class**: `font-serif` (Canela stack) used instead of `font-headline` (Cormorant Garamond) in cinematic components
5. **Cold gray colors in standard layout**: `ProductPage.tsx` and `SpecsAccordion.tsx` use Tailwind gray palette (`#1F2937`, `#6B7280`, etc.) instead of warm Folio tokens
6. **Photos not sacred**: Gradient overlays (`from-black/80`) cover photography in `EditorialInspirationGrid` and `RelatedFibonacciGrid`
7. **Testimonials missing from cinematic layout**: `DesignerTestimonials` not rendered in `CinematicProductPage.tsx`
8. **Duplicate routes**: `/products/[slug]` and `/product/[productId]` — no canonical, different data fetching, different UIs
9. **Console.log in production**: Debug logs in `getProductById.ts:25` and `page.tsx:14`

### P2 — Nice to Fix
10. **"Material Bank" hardcoded** in PrimaryActions toast and info text
11. **Empty state for no description/materials**: Renders empty containers
12. **Mock file download links**: Spec sheets and 3D files point to `#anchors`
13. **Dev diagnostic scripts**: 5 audit scripts auto-run in `CinematicProductPage.tsx` dev mode (not a prod issue, but noisy)
14. **"Updated recently" placeholder** in DownloadsPanel
15. **Legacy route links to `/project/{id}`** instead of `/p/[slug]`

---

## Verification
This is a READ-ONLY audit — no changes to verify. Findings can be validated by:
1. Loading any real product at `/products/[realProductId]` and inspecting for mock data (fake designer names, `/demo/` images)
2. Checking page source for `<title>` tag (will show generic root title)
3. Attempting unauthenticated PUT to `/api/products/[anyId]`
4. Inspecting font-family in DevTools on cinematic hero text (will show Canela, not Cormorant Garamond)

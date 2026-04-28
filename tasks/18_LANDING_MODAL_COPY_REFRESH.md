# LANDING MODAL COPY REFRESH — IMPLEMENTATION

## Files Touched

1. `src/components/marketing/WelcomeModal.tsx` — primary refactor.
2. `src/components/landing/LandingModal.tsx` — DELETE (orphan, no imports).
3. `src/app/for-designers/sections.tsx` — sync hero headline + replace 3-step array. (Lockstep with modal. Confirmed in Phase 2.)

## 1. WelcomeModal.tsx

### Remove
- The `steps[]` const array (lines 11–27).
- The `whatYouGet[]` const array (lines 29–35).
- The "How it works" section heading and its rendered block.
- The "What You Get" section heading, the "One platform for the whole studio." line, the rendered `whatYouGet` list, and the "Explore all features →" link. (Link returns in pillar four area, see below.)
- The `<hr>` divider between the removed sections.
- All three em dashes (`&mdash;` in subhead, `—` in steps 1 and 3) — they leave with the copy they sit in.

### Replace hero
**H2:** Your studio, told right and run right.
**Subhead:** Folio is where interior designers publish their work, source their products, and turn vendor conversations into action. Built for the way studios already operate.

(Hero stays as the entrance. Pillars do the heavy lifting.)

### Add single `pillars[]` array (replaces both removed arrays)

```ts
const pillars = [
  {
    title: "Your story, told right every time",
    body: "Folio digs deeper than any reporter can. The portfolio section of your website becomes a publication that keeps writing itself.",
  },
  {
    title: "Price, sample, and specify from one place",
    body: "Every product you've ever speced lives in your Sourcebook. Sourcing stops meaning a morning of old project folders and cold emails.",
  },
  {
    title: "Turn your inbox into action items",
    body: "Connect your accounts and vendor back-and-forth becomes tasks that close with a click. Quotes chased, samples ordered, specs pulled, without leaving Folio.",
  },
  {
    title: "Every project is months of material",
    body: "Upload your work and Folio turns each project into campaigns, articles, and posts that run for weeks. Cross-post, stay consistent, and the reach follows. Folio gives you the content. You run the publication.",
  },
];
```

### Render
Single pillar section. Same numeral ornament pattern the old `steps[]` used (italic 1/2/3/4) is fine to keep — it provides ordering without adding visual weight. Do not introduce icons. Do not italicize pillar titles (Instrument Sans, regular weight, sized larger than body).

Stagger animation (`staggerChildren`/`delayChildren`) reapplies to the new four-pillar list with no logic change.

### Keep
- Founding Designers section verbatim including "If your work is ready, so are we."
- Footer CTAs.
- The "Explore all features →" link to `/for-designers`. Reposition it directly under the four-pillar section as a quiet text link.
- `folio_welcome_dismissed` sessionStorage logic.
- `data-folio-target="for-designers-nav"` fly-to-nav exit animation.

## 2. LandingModal.tsx

Delete the file. Confirm zero imports before deletion (audit confirmed orphan status; re-grep at implementation time as a safety check).

## 3. for-designers/sections.tsx

### Hero headline (line 29)
Replace with: `Your studio, told right and run right.` (matches modal hero H2.)

### steps[] array (lines 46–62)
Replace entirely with the same four-entry `pillars[]` array from the modal. Use identical title+body strings. If the existing render expects `{ number, title, body }` shape, adapt the array shape, not the strings.

### Leave untouched
- `pillarCards[]` (lines 113–149). Richer marketing-page content, not a modal mirror.
- "If your work is ready, so are we." closer (line 228). Same line is in modal — already consistent.
- All other sections.

## Constraints

- No em dashes anywhere in new copy. Use periods or commas.
- Instrument Sans for all UI/body. Cormorant Italic only for the existing numeral ornament (1/2/3/4) if that's the current pattern — do not introduce new italic moments.
- Glass-surface / mesh / photography rules don't engage in this modal (no photography present).
- ADD-only at the schema level (none touched here).

## Acceptance Criteria

- Modal renders four pillars in the order: identity → sourcebook → inbox → campaigns.
- Modal hero copy matches spec verbatim.
- All four pillar title/body strings match spec verbatim.
- No em dashes anywhere in `WelcomeModal.tsx` or the modified portions of `for-designers/sections.tsx`.
- `LandingModal.tsx` no longer exists in the tree.
- `/for-designers` hero headline and 3-step section render the new copy.
- `pillarCards[]` on `/for-designers` unchanged.
- Founding Designers section, CTAs, and animation behavior unchanged in modal.
- No new imports, icons, or assets introduced.

## QA

Chrome agent eval:
1. Visit `/magazine` logged out. Confirm modal renders with four pillars in the specified order, new hero, new closer present.
2. Click "Explore all features →" from the modal. Confirm `/for-designers` hero matches the modal hero, and the 3-step section reads in the new four-pillar voice.
3. Grep the repo for `Editorial Publishing`, `Sourcebook & Actions`, `Project Procurement`, `Unified Communications`, `Directory & Discovery`, `One place for your projects`. Confirm zero remaining hits.
4. Confirm `LandingModal.tsx` removal does not break any build path.

## Out of Scope

- `pillarCards[]` rewrite on `/for-designers`.
- Page `<title>` tags on `/for-designers/communications`, `/procurement`, `/discovery`.
- Modal visual or animation redesign.
- CTA copy or routing.
- Marketing site copy outside the two strings called out above.

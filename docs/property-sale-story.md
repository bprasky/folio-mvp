# Property sale story — first release

## Purpose
Let the people behind a home explain its design while it is for sale. Capture sale intent before room interviews, use the existing question budget, and keep the approved story available after a listing ends.

## This release
- Optional “This property is currently for sale” in both project-creation forms, plus an editor on the project workspace before the interview and on the published project home.
- Listing-first entry: a listing URL is required for public sale status; private sale intent can precede it. Optional asking price/currency, address, agent/brokerage/contact link, and reviewed press links. Publication permission and public-address permission are separate, off by default. Published information requires the firm's publishing permission.
- “Fill from listing” reads explicit structured price, address and agent metadata with address-pinned HTTP, bounded redirects/body/time, then the existing protected render worker for missing JS-populated metadata when configured. Explicit denials/CAPTCHAs stop. Imported values fill empty fields only, require review/save, and never approve publication. No price/currency inference from prose. Unsupported sites have a clear manual fallback.
- One opening question replaces the existing signature/identity question and moves to the front: “What would someone miss if they only looked at the listing photographs?” The other four project obligations remain. Room preparation and adaptive follow-ups use the sale purpose and accepted answers within existing budgets. No separate mandatory closing questionnaire.
- Only a sale-intent boolean enters model context. Private listing details, addresses, prices, and press text never become interview evidence. The article introduction draws from the accepted opening answer, without asserting availability or asking price in evergreen prose.
- An approved property section on the existing permanent project URL includes sale details, current listing/contact links, and press links. Turning off sale status hides price and agent/listing actions while retaining approved address/press and the project story. After 30 days without confirmation the price and “currently for sale” claim are withheld; the source listing remains accessible with a last-confirmed date.
- Store a versioned `propertySale` namespace in existing ProjectPost provenance, using the same full-document compare-and-swap protection as interviews. No schema migration; public serialization explicitly projects approved fields. Creation, interview saves/resets and article generation retain this namespace. Both guided and legacy preparation receive sale intent.

## Next phase
Create an independently owned property record with multiple project chapters, authorized future sellers, address matching and ownership transitions. The first release keeps the existing project's identity and permissions; it does not claim to merge properties or transfer rights. Add permission-based media discovery with source attribution, review, rights checks, and explicit approval before importing third-party media. Screenshot/vision extraction is a later extension of listing import; this release reads HTML metadata only. This release accepts reviewed press links only and never scrapes or republishes press articles/photos.

## Verification
Exercise validation, private/public serialization, inactive/stale listings, publishing authorization, retry/conflict handling, preservation of interview state, sale-specific question count/order/context, and existing non-sale interviews. Run the existing guided suites, TypeScript budget, client boundary and production compilation. Record any unavailable live-provider or signed-in checks in the PR.

## Visual review
Use the existing project hero/mosaic, production Cormorant Garamond and Instrument Sans fonts, and a restrained sale strip directly below the hero. Place View listing beside the price; optional agent and press details stay secondary. The editor uses compact disclosures for optional agent/press fields. The local design review uses actual production components with fictional project data and illustrative photography, not a separate production page or a real listing.

# Tagging review UX — make review accessible + scrape-independent

Branch: claude/clever-volta-83lg4y

## Problem (from founder)
1. The prolonged (BQL) scrape for flagged hard domains (Wayfair, PotteryBarn,
   AllModern) "isn't returning results anyway" — deferred products land as empty
   stubs (brand only) and never fill.
2. Reviewing a tag is convoluted: the only reliable path is to start a new tag,
   hover the previous pin, click the edit pencil. Review should be visible and
   editable directly, not only inside the new-tag flow.

## Root causes (read, not guessed)
- `ProjectImageTagger.tsx` treats `product.scrapeStatus === "pending"` as
  "Fetching…" forever. When a deferred scrape is fired as fire-and-forget and the
  serverless fn dies (user navigates / closes), the DB stays `pending`. On reopen
  nobody polls, so the tag shows a perpetual "Fetching…" with NO edit/confirm
  buttons (gated on `!p.fetching`). That tag is trapped.
- The edit modal (`editTarget`) has only plain fields — no way to autofill when
  the scrape returned nothing, so manual review is slow/unsuccessful.
- The pending-review panel already renders on every screen, but its usefulness is
  killed by the two issues above.

## Plan
- [ ] 1. `fetching`/`isScraping` reflect only ACTIVE polling (`scrapingIds`), not
      DB `pending`. A `pending` product with no live poll = stalled = reviewable
      (amber pin + editable), not "Fetching…".
- [ ] 2. Pending-review panel: show Edit always; show Confirm when not actively
      fetching. Review no longer requires the hover-on-pin dance.
- [ ] 3. Edit modal gains manual autofill (reuses existing endpoints): "Open page"
      link, paste-text → `/api/products/parse-text`, screenshot → `/api/products/
      parse-image`. Makes review productive when the scrape returns nothing.
- [ ] 4. Verify: tsc on the touched file, sanity-check no behavior regressions for
      the happy (catalog-search) path.

## Review

Done — all in `src/components/project/ProjectImageTagger.tsx` (one file, no API/schema
changes), so the happy catalog-search path is untouched.

1. **Stalled-pending = reviewable.** `pendingTags.fetching` and the pin's `isScraping`
   now derive solely from `scrapingIds` (an active in-session poll), not the bare DB
   `scrapeStatus === "pending"`. A deferred scrape whose serverless fn died (navigate
   away / close) leaves the row `pending`; on reopen that tag now reads as needs-review
   (amber pin, editable) instead of a perpetual "Fetching…" with no controls.
2. **Edit always available in the review panel.** The Edit pencil is no longer gated on
   `!fetching`, so the designer can fill details by hand at any time directly from the
   always-visible review panel — no more "start a new tag → hover the old pin → edit".
   Confirm still appears once the best-effort scrape isn't actively polling.
3. **Autofill rescue in the edit modal.** Added an "Open page" link, a paste-text →
   `/api/products/parse-text` autofill, and a screenshot → `/api/products/parse-image`
   vision autofill (reusing the exact endpoints the pre-tag manual capture uses). When
   the prolonged scrape returns nothing, the designer pastes the copy or a screenshot
   and the fields fill — making review productive without depending on the BQL rung.

Note: the BQL scrape itself is best-effort infra (residential proxy + browserless) and
was intentionally left in place as a bonus, not a blocker. The fix decouples review from
it so an empty/slow scrape no longer traps a tag.

Verified: `tsc --noEmit` clean for the touched file.

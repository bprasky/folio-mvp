---
name: Scraping infra (spec 17) escalation fork plus Phase 1 notes
description: The vendor-own-site no-escalation exemption is decided at the wizard entry point from domain ownership, NOT from the consumer enum. Plus two Phase 1 notes (/content status gap is expected, and the row-landing acceptance check).
type: project
---

# Scraping infrastructure (spec 17): escalation fork and Phase 1 notes

The 17_SCRAPING_INFRASTRUCTURE spec is not tracked in this repo (the spec lives
in the working chat, and the docs vault has the 17 slot open). This file is the
authoritative record of the corrections agreed during the Phase 1 review, so
they are not lost before Phase 2 is written.

## Decision 1: the escalation exemption is keyed on domain ownership, not the consumer enum

Spec section 2.4 originally wired the vendor-own-site exemption (no escalation,
route to the supply-your-data handoff) to the VENDOR_WIZARD consumer enum value.
That is wrong. PRODUCT_SCRAPE is what exposes it: wizard-originated scrapes can
land under PRODUCT_SCRAPE through the shared /api/scrape-product route, so the
consumer enum cannot carry the fork.

Corrected rule for Phase 2:

- Escalation (stealth, residential, BQL solve) is allowed for third-party
  targets.
- The exemption, meaning no escalation and a route to the supply-your-data
  handoff, is decided at the wizard entry point BEFORE the client call, using the
  fact that the acting vendor owns the target domain. The wizard already knows
  this at call time. It is never inferred from the consumer enum afterward.
- The ScrapeConsumer enum, PRODUCT_SCRAPE and VENDOR_WIZARD included, is a
  diagnostic axis only. It drives no escalation decision.

**Why:** a single shared scrape route serves more than one entry point, so the
consumer label recorded on a ScrapeAttempt row is descriptive, not a control
signal. Ownership is the real predicate for "do not spend proxy or solve units
on this," and only the calling entry point knows it.

## Decision 2 (note, no action): the /content target-status gap is expected

ScrapeAttempt rows from the /content endpoint leave targetStatus null. This is
accepted. Browserless /content has no docs-confirmable target-status field (the
docs are themselves bot-walled at HTTP 403). The blocking path always reaches
/function, which returns the real status via page.goto, so a known block still
lands a row with a true status and a non-THIN_CONTENT outcome.

The residual /content-only gap closes in Phase 2 when the import and attribution
paths move to smart-scrape, which returns status. The one path that stays
/content-only is import image, which does not escalate, so a null-status
THIN_CONTENT row there is harmless. Do not re-raise this as a defect.

## Decision 3: Phase 1 acceptance gains a row-landing check

The recorder is best effort and swallows writes until the ScrapeAttempt table
exists, so "migration not applied" and "nothing is blocking" produce the
identical empty table. Added to the Phase 1 acceptance: after
`prisma migrate deploy` in an env with DB access, confirm rows actually land by
scraping one known-blocking URL and checking it produced a ScrapeAttempt row,
before trusting the observation window.

## How to apply (Phase 2 gate)

Write no Phase 2 code until the observation window has run. The seed for the
Phase 2 per-domain policy is the distribution:

    select domain, outcome, count(*) from "ScrapeAttempt" group by 1, 2 order by 3 desc

That result is the only thing that unblocks Phase 2. When Phase 2 is written,
fold Decision 1 into section 2.4 of the spec doc if the spec is by then tracked
in the repo.

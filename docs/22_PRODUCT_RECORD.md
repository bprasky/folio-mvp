# 22_PRODUCT_RECORD

## Purpose

This document defines the Product Record: the product page as the design industry's system of record, authored by the designers who specified the product, gated behind vendor participation, and commissioned rather than volunteered.

It supersedes the vendor tier ladder in `15_SUPER_ARTICLES` and extends the testimonial model in `16_DESIGNER_SHOP_SYSTEM`. Deltas are enumerated at the end.

---

## Core Concept

A product page on Folio is not a clone of the vendor's catalog page. It is an editorial article about the product, written by the people who specified it into real projects.

The Super-Article inverts. A project Super-Article is many contributors against one project. A Product Record is many projects against one product. Same block library, same regeneration trigger, same contributor lens structure, different join key. This is the Product entity at Corpus scope in `21_ASSET_MATRIX`. No new production line is introduced. What is new is the query, the gate, and the commission.

Vendors do not buy ad targeting. They buy the right to ask, and the license to use what comes back.

---

## What Cannot Be Gated

The following are never gated, because gating them starves the graph the platform is built on.

Product identity, vendor, category, and specification attributes. Taggability by any designer in any project. Saves, spec sheet inclusion, and lineage edges. Shop placement on designer profiles. Search and directory presence.

A vendor who never claims and never pays still has a fully functional product in the system. Their product is specified, saved, and tracked. They simply have no testimony.

---

## What Is Gated

Testimony and its distribution. Three audiences, three states.

| Audience | Sees record | Sees coverage counts | Sees testimony | Rationale |
|---|---|---|---|---|
| Authenticated Folio designer | Yes | Yes | Yes | They wrote it. Knowing what peers said before specifying is the intelligence product they subscribe for. |
| Public / unauthenticated | Yes | Yes | No | Locked testimony with visible counts drives designer signup and shows the vendor what circulates among specifiers. |
| Vendor, unclaimed | Yes | Yes | No | Enough to price the decision, not enough to satisfy it. |
| Vendor, claimed | Yes | Yes | Yes | Claiming is free and is the conversion moment. |

Public indexability, embedding, and off-platform licensing require Claimed status at minimum. See Licensing below.

---

## Two Classes of Testimony

Volunteer and commissioned content are distinct block classes with distinct gates. Conflating them leaks the gate.

**Volunteer quotes** originate in the tagging flow defined in `16_DESIGNER_SHOP_SYSTEM` (the "Add to Shop" toggle plus optional quote). They are short, unstructured, designer-initiated, and unpaid. They render on the designer's Shop surface always, on the Product Record for authenticated designers always, and publicly only once the vendor is Claimed.

**Commissioned testimony** originates in a paid Collaboration Request. It is a structured follow-up interview producing a public specification-reasoning block and a private signal payload. It is the substance of the article.

A record populated entirely by volunteer quotes never reaches Article tier. Volunteer content is a teaser for the vendor and a courtesy to the designer. It is not the asset.

---

## Record Maturity Ladder

| Tier | Requirement | Presentation |
|---|---|---|
| **Listing** | Product exists in catalog | Identity, attributes, vendor. Taggable. |
| **Record** | 1+ specification event by 1 designer | Coverage counts, in-situ imagery, project links, volunteer quotes per gate |
| **Article** | 3 distinct designers across 3 distinct projects, including 2+ commissioned testimonies | Compiled editorial, contributor lenses, full block projection |

The independence gate is load-bearing. Distinctness is enforced on designer identity and on project, not on tag count. Without it, one friendly designer and one vendor manufacture an article and the merit claim dies.

Commissioned testimony must be elicited through the canonical interviewer, not submitted as free text. Elicitation is what makes it evidence rather than copy.

---

## Vendor States

This table replaces the Tagged / Featured / Boosted ladder in `15_SUPER_ARTICLES`.

| State | Cost | Unlocks |
|---|---|---|
| **Tagged** | Free, automatic | Product in catalog and product bank. Attribution data visible on claim. No testimony. |
| **Claimed** | Free | Sees testimony. Volunteer quotes go public. Richer hover card on tagged project images. One free Collaboration Request. |
| **Collaborating** | Per request | Product tab in the Super-Article where collaboration interviews are posted. Commissioned testimony accrues to the Record. Private signal delivery. Licensing rights. |

Paying to have a product named inside another party's project narrative is removed. It was ad placement wearing editorial clothes, and the Product Record prices higher than it did.

The richer hover card and the Product tab are the visibility purchase. The testimony is the credibility purchase. Both attach to participation, neither attaches to spend alone.

---

## The Claim Email and the Prospective Page

The claim notification is not "your products were tagged 12 times." It is an article that does not exist yet.

> Nine designers specified the Cloud Chandelier across eleven projects. None of them have said anything about it yet. Here is what your product's page looks like, and what it looks like when they do.

The email links to a Prospective Page: the real record, rendered at Article tier, with real designers, real projects, real in-situ photography, and **empty testimony slots**.

**Hard rule: the Prospective Page contains no sample, synthetic, or AI-drafted quotes.** Not as illustration, not greyed out, not labeled as example. A vendor who arrives expecting content that does not exist loses trust in everything downstream, and a synthetic quote attributed to a real designer's slot is indefensible.

The empty slots are the pitch. Absence is the argument.

---

## Collaboration Request Lifecycle

```
Vendor (Claimed) selects designer + product
   ↓
Request created. First request per vendor is free and Folio-funded.
   ↓
Designer notified. Request expires in 21 days.
Reminders at day 7 and day 17.
   ↓
Designer declines ──────────────→ Unbilled. Free grant returns to vendor.
   ↓
Designer completes follow-up interview
   ↓
Completion floor evaluated
   ├── Below floor → Unbilled, unpublished, request returns to vendor
   └── At or above floor
          ↓
   Public block renders to Product Record (specification reasoning, no verdict)
   Private signal payload delivers to vendor
          ↓
   Billing fires. Commission base pays out. Bonus graded after publication.
```

**Billable only on delivery.** No request generates a receivable until an interview clears the completion floor. Folio never owes a commission it has not collected, and a vendor never pays for nothing.

**Expiry returns the grant.** A lapsed free request must not be a dead end, because the free request is the entire conversion moment.

**Proposed completion floor:** 4 of 6 required follow-ups answered, 120 words minimum across public-eligible answers, and at least one specific condition named (dimension, install context, environment, or alternative weighed). Tune against the first cohort.

---

## No Approval, No Preview, No Refund

The vendor is paying for the request, not the answer.

There is no preview before publication. There is no vendor approval gate. There is no refund on unfavorable content. Whatever clears the completion floor publishes as written, and the vendor is billed identically.

This must be stated in the purchase flow in plain language, because it is both the legal firewall and the honest description of the product. If a vendor can see testimony before it goes live and decline it, the entire record is paid endorsement and worth nothing to the designers who trust it.

**Star ratings and score thresholds are rejected as publication gates.** A record where everything under three stars never publishes is review gating, exposes Folio under the FTC rule on consumer reviews and testimonials, and destroys designer trust. This requires review by counsel before implementation. The instinct behind it is served by the dual-output split below.

---

## Dual Output Split

One interview produces two artifacts.

**Public output.** Specification reasoning under the existing rendering contract: arrivals only, no verdicts, no scores, no ratings. Why this was specified, at what scale, against what alternatives, under what conditions, in whose hands. Elicitation may chase contrast and rejected options. Rendering does not emit them as judgment.

**Private output.** Structured signal delivered to the vendor and never published: quality score, failure mode, lead time experienced, finish and batch consistency, packaging and freight condition, rep responsiveness, reorder intent. This is intelligence no vendor can buy anywhere at any price, and it is arguably the better half of what they are purchasing.

Nothing is suppressed, because a verdict was never a publishable object in this architecture.

Low private signal flags to the vendor for direct resolution. Because publication was never conditional on resolution, the vendor reaching out is legitimate rather than coercive. A designer whose issue is resolved may add to the record later.

### Off-Topic Routing

At submission, a single prompt with a default: content about rep responsiveness, freight, lead time, and service routes to private signal and stays off the product page, which remains about the product.

One prompt, one default, not an item-by-item negotiation. Item-level routing becomes an editing session with extra steps.

**Routing must never change billing or bonus.** Otherwise Folio has paid a designer to move criticism into private.

---

## Designer Veto

The designer may decline a request, and may withhold publication after completing the interview. Removal rights on their own testimony persist indefinitely, including after a vendor has licensed the record.

Designer withholding is legitimate and credible. Vendor suppression is illegal and worthless. Identical outcome, opposite party, and the party holding the veto is the entire question.

**Open decision:** a completed interview withheld from publication still delivered private signal. Proposal is to bill it and disclose that in the purchase flow alongside the no-approval terms. Alternative is to bill at 50 percent. Decide before the first vendor encounters it.

---

## Commission Model

Payment is for licensed use of a designer's words and photographs. It is compensation for IP and time, not a participation rebate.

**Cash by default via Stripe Connect.** Folio Credit remains correct for Tier 1 and Tier 2 in `16_COMPENSATION_SYSTEM`, where it is a rebate on ecosystem participation. Paying for licensed IP in platform scrip is the version that reads badly in print. Offer a credit election at a premium for designers who want it.

**Base plus bonus, never withhold.** A withheld portion pending a grade gets priced at the reduced rate by the designer anyway, and the difference becomes resentment. Set base where the withheld rate would have landed. Fund the bonus additively.

| Component | Source | Basis |
|---|---|---|
| Base commission | Vendor request price, proposed 60 percent designer / 40 percent Folio | Quoted at request time by designer tier |
| Effectiveness bonus | Folio revenue, 0 to 40 percent of base | Graded after publication on evidence density |
| Free-request commission | Folio, funded as acquisition spend | Standard base for that designer's tier |

**Folio funds the bonus, not the vendor.** A vendor paying extra for feedback Folio graded is indefensible regardless of how the grading works.

**Folio funds the commission on the free request.** The vendor pays nothing, the designer is paid anyway. Both sides need to feel the mechanic once, and a designer who has been paid for one testimony is a designer who starts calling their reps. That is the vendor acquisition channel worth buying, it is cheap, and it fires once per vendor.

### Valence-Blind Grading

The bonus grades evidence density, never agreement.

Scored inputs: specific conditions named, dimensions and scale, install context, alternatives weighed, precision of the failure mode or the success mode, reusability of the observation by another specifier.

A detailed account of a finish that patinated inconsistently across two orders scores identically to a detailed account of one that performed exactly as specified.

**CI invariant, written in the pattern of the existing `VENDOR_REFERENCE` public-serializer test:** for a fixture set of testimony pairs identical in structure and inverted in sentiment, grader output must match within tolerance. Divergence fails the build. A compromised grader is found in the pipeline, not eighteen months into the corpus.

---

## Pricing and Targeting

Two dials that look like one and must be separated.

**Price scales on influence.** A designer's time and name have a market rate. Reuse the tier model in `16_DESIGNER_SHOP_SYSTEM` boost pricing. Vendors will spend the free request on the strongest designer available, and that choice reveals what the second request is worth.

**Targeting scales on relevance.** Relevance is not influence. A decorator specifying a product into a cold climate at residential scale may be the most useful testimony a buyer will read on it, and she is inexpensive. Selling vendors relevance-weighted targeting is the more defensible product and the more valuable one.

Folio actively assists targeting: which specifiers, which conditions, which gaps in the record. This is a service, not a filter.

### Targeting Firewall

Once private signal accumulates, Folio can predict sentiment. If prediction becomes a targeting input, a vendor buys a filtered sample, and the record is whitewashed by construction with nothing suppressed and no rule broken.

**Private scores from completed requests are never an input to collaboration targeting or recommendation.** Targeting runs on observed specification and relevance only. Enforce structurally, not by policy.

---

## Coverage Disclosure

Every Product Record publishes coverage on its face.

> Specified by 40 designers across 47 projects. 6 have testified.

Selective asking becomes visible rather than forbidden. A vendor who commissions three of forty produces a record that announces the ratio, and readers price it accordingly. Disclosure does more work than enforcement, because it makes the gaming self-defeating instead of policed.

---

## Imagery

Product Records are built from `DESIGNER_ORIGINAL` and `FOLIO_COMMISSIONED` only. `VENDOR_REFERENCE` remains suppressed on all public surfaces per the existing `resolveProductImage` resolver and its CI test.

This is not a constraint to work around. It is the reason the page is defensible. The vendor's own page has the studio shot on white. Folio's has the product installed in nine houses with the designers explaining why. The vendor cannot replicate that page at any budget, because they do not own the inputs.

`VENDOR_LICENSED` imagery may appear where a licensing agreement exists, ordered below in-situ work.

---

## Elicitation Architecture

The vendor collaboration interview is a **new elicitation context, not a new generator.** It lands on the canonical interviewer module defined in `claude_17_INTERVIEW_PROMPT_CANON`.

Building it standalone makes it the eighth drifted generator before the existing seven are reconciled. This is a hard sequencing dependency: the canonical module lands first.

The rendering contract already handles the public output. Follow-ups may chase contrast, rejected alternatives, and failure conditions. Rendering enforces arrivals. The private signal payload is a projection off the same canonical answers, extracted rather than separately asked.

---

## Ordering Invariants

These are legally load-bearing and must be enforced in code, not convention.

1. **Testimony is never solicited on a product a vendor has already paid to influence.** Requests purchase access to a designer's time. They do not purchase a conclusion.
2. **Order is fixed: request paid, interview elicited, output published, commission paid.** Payment must never be contingent on content.
3. **No vendor preview of public output before publication.**
4. **No private score participates in targeting.**
5. **Designer removal rights survive licensing.**

If the architecture permits any of these to run in reverse anywhere, someone eventually will.

---

## Licensing

Claimed and Collaborating vendors may license testimony and in-situ imagery for off-platform use: catalog, deck, showroom, trade show, site.

Licensing is a separate event from the request. It triggers a distribution to the contributing designers whose material is included, cash by default. Proposed export term is 12 months per license, renewable.

Already-exported material is honored for the full term if a vendor lapses. Renewal rights end. Clawing back a printed catalog is unenforceable and attempting it looks petty.

Superseded: the earlier subscription-unlock model where an entire record publishes on payment and collapses to locked on lapse. Publication is now a consequence of commissioned testimony existing, which only occurs through paid request. The gate is upstream, which is stronger and simpler.

---

## Data Model

ADD-only. No destructive DDL. Commissioned public output reuses `SupplementalQuote` rather than creating a parallel store, consistent with the canonical-plus-projection pattern.

```prisma
enum ProductRecordTier {
  LISTING
  RECORD
  ARTICLE
}

enum VendorRecordState {
  TAGGED
  CLAIMED
  COLLABORATING
}

enum CollaborationRequestStatus {
  PENDING
  DECLINED
  EXPIRED
  SUBMITTED_BELOW_FLOOR
  COMPLETED_WITHHELD
  COMPLETED_PUBLISHED
}

enum TestimonyClass {
  VOLUNTEER
  COMMISSIONED
}

// ADD to Product
// recordTier            ProductRecordTier @default(LISTING)
// recordPublishedAt     DateTime?
// specifierCount        Int      @default(0)  // denormalized cache
// projectCount          Int      @default(0)  // denormalized cache
// testimonyCount        Int      @default(0)  // denormalized cache

// ADD to SupplementalQuote
// testimonyClass        TestimonyClass @default(VOLUNTEER)
// collaborationRequestId String?

model VendorProductClaim {
  id             String    @id @default(cuid())
  organizationId String
  productId      String
  state          VendorRecordState @default(CLAIMED)
  claimedAt      DateTime  @default(now())
  freeRequestGrantedAt  DateTime?
  freeRequestConsumedAt DateTime?

  organization   Organization @relation(fields: [organizationId], references: [id])
  product        Product      @relation(fields: [productId], references: [id])

  @@unique([organizationId, productId])
  @@index([productId])
  @@map("vendor_product_claims")
}

model CollaborationRequest {
  id              String   @id @default(cuid())
  organizationId  String
  productId       String
  designerId      String
  projectPostId   String?
  status          CollaborationRequestStatus @default(PENDING)
  isFreeGrant     Boolean  @default(false)
  quotedPriceCents Int
  designerTierAtQuote String
  expiresAt       DateTime
  respondedAt     DateTime?
  publishedAt     DateTime?
  billedAt        DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId])
  @@index([productId])
  @@index([designerId, status])
  @@index([status, expiresAt])
  @@map("collaboration_requests")
}

model PrivateProductSignal {
  id              String   @id @default(cuid())
  collaborationRequestId String @unique
  productId       String
  designerId      String

  qualityScore    Int?     // 1-5, private, never rendered, never a targeting input
  failureMode     String?
  leadTimeDays    Int?
  finishConsistency String?
  freightCondition String?
  repResponsiveness String?
  reorderIntent   String?

  routedFromPublic Boolean @default(false)
  createdAt       DateTime @default(now())

  @@index([productId])
  @@map("private_product_signals")
}

model CommissionLedgerEntry {
  id              String   @id @default(cuid())
  collaborationRequestId String?
  licenseGrantId  String?
  designerId      String
  kind            String   // BASE | BONUS | LICENSE | FREE_GRANT_FUNDED
  amountCents     Int
  fundedBy        String   // VENDOR | FOLIO
  payoutMethod    String   // STRIPE_CASH | FOLIO_CREDIT
  stripeTransferId String?
  gradedAt        DateTime?
  evidenceDensityScore Int?
  paidAt          DateTime?
  createdAt       DateTime @default(now())

  @@index([designerId])
  @@index([kind, paidAt])
  @@map("commission_ledger_entries")
}

model LicenseGrant {
  id              String   @id @default(cuid())
  organizationId  String
  productId       String
  scope           String   // CATALOG | DECK | SHOWROOM | WEB | TRADE_SHOW
  termMonths      Int      @default(12)
  grantedAt       DateTime @default(now())
  expiresAt       DateTime

  @@index([organizationId])
  @@index([productId])
  @@map("license_grants")
}
```

---

## Deltas Against Existing Specs

**`15_SUPER_ARTICLES`**
- Vendor tier table (Tagged / Featured / Boosted) is replaced by Tagged / Claimed / Collaborating.
- Boosted vendor products named in compiled article body text is **removed**. Vendors no longer purchase placement inside another party's narrative.
- Product tab added to the Super-Article, populated by collaboration interviews. This is the visibility unlock, replacing in-body naming.
- Vendor ordering by monetary contribution is replaced by ordering on participation state, then relevance.
- Product bank per-contributor commentary remains and becomes the Record's feeder.

**`16_DESIGNER_SHOP_SYSTEM`**
- `ProductTestimonial` is subsumed. Volunteer quotes carry `testimonyClass = VOLUNTEER` on `SupplementalQuote`.
- "Quotes aggregate to product pages" is now gated: publicly visible only once the vendor is Claimed.
- Testimonial featuring by vendor boost (Phase 3, P2) is removed. Vendors cannot promote selected testimony above others on the Record.
- Designer tier pricing model is reused for request pricing.

**`16_COMPENSATION_SYSTEM`**
- Adds a compensation tier above Tier 1 and Tier 2: commissioned testimony and licensing, paid in cash rather than Folio Credit.
- The vendor traffic reversal argument strengthens. A designer holding unbilled positions across their archive has direct financial interest in their vendors joining, and will make those calls without platform prompting.

**`16_ATTRIBUTION_CONSENT`**
- Private product signal is a new data class requiring its own tier. Nearest existing analogue is Tier C. It is designer-authored, vendor-delivered, never public, and excluded from all recommendation surfaces.

**`14_MONETIZATION_AND_VERIFICATION`**
- The "You Were Tagged" loop is upgraded to the Prospective Page claim flow.
- Claimed tier now carries the free Collaboration Request grant.

**`21_ASSET_MATRIX`**
- Product Record is the Product entity at Corpus scope. It is a projection of the existing block library, not a new surface. Confirm the Corpus-scope Product projection is reachable in the audit playbook.

---

## Implementation Phases

### Phase A: Record Surface (no monetization)

| Task | Priority |
|---|---|
| Product Record page at Corpus-scope Product projection | P0 |
| Coverage count computation and denormalized cache | P0 |
| Maturity ladder evaluation with independence gate | P0 |
| Three-audience gating on testimony visibility | P0 |
| `resolveProductImage` confirmed on the Record surface | P0 |
| Volunteer quote class migration on `SupplementalQuote` | P1 |

### Phase B: Claim Flow

| Task | Priority |
|---|---|
| Prospective Page renderer with empty testimony slots | P0 |
| Claim email with real coverage data, zero synthetic quotes | P0 |
| `VendorProductClaim` and free grant issuance | P0 |
| Richer hover card on tagged project images for Claimed vendors | P1 |

### Phase C: Collaboration Requests

**Blocked on canonical interviewer module.**

| Task | Priority |
|---|---|
| Vendor collaboration elicitation context on canonical module | P0 |
| Request lifecycle with 21-day expiry, reminders, grant return | P0 |
| Completion floor evaluation | P0 |
| Public block render under existing rendering contract | P0 |
| Private signal extraction and vendor delivery | P0 |
| Off-topic routing prompt at submission | P1 |
| Product tab in Super-Article | P1 |

### Phase D: Commission and Pricing

| Task | Priority |
|---|---|
| Stripe Connect commission payouts, cash default | P0 |
| Request pricing by designer tier | P0 |
| Billing on delivery only | P0 |
| Valence-blind bonus grader | P1 |
| Grader CI invariant with inverted-sentiment fixtures | P0 |
| Targeting firewall enforcement | P0 |
| Relevance-weighted targeting assistance for vendors | P2 |

### Phase E: Licensing

| Task | Priority |
|---|---|
| `LicenseGrant` issuance and scope enforcement | P1 |
| Multi-designer license distribution | P1 |
| Lapse behavior honoring existing terms | P2 |

---

## Open Decisions

1. Billing on `COMPLETED_WITHHELD`. Full, or 50 percent. Private signal did deliver.
2. Request unit: per product record versus per vendor account tier above it. Leaning per record with an account tier above, because the hero SKU is the wedge.
3. Completion floor thresholds. Proposed values above are untested.
4. Commission split percentage. Proposed 60 / 40 designer-favorable.
5. Whether a resolved private issue permits a supplemental public block, and whether that is billable.
6. Counsel review of the whole solicitation-to-publication chain before Phase C ships.

---

## Implementation Status

Phase A and the ADD-only data model for Phases A through E landed together. What
exists in code:

| Spec section | Code |
|---|---|
| Record Maturity Ladder, independence gate | `src/lib/products/productRecord.ts` — `evaluateRecordTier` |
| What Is Gated (three audiences) | `src/lib/products/productRecord.ts` — `isTestimonyVisible` |
| Coverage Disclosure | `src/lib/products/productRecord.ts` — `coverageDisclosure` |
| Ordering by evidentiary weight (`21` §8) | `src/lib/products/productRecord.ts` — `rankTestimony` |
| Coverage computation, denormalized cache | `src/server/queries/getProductRecord.ts` |
| Imagery (`resolveProductImage` on the Record) | `src/server/queries/getProductRecord.ts` |
| Record surface | `src/components/product/ProductRecordSection.tsx` |
| Targeting Firewall (Ordering Invariant 4) | `scripts/check-product-record-invariants.ts`, `npm run check:record-invariants` |
| Data Model | `prisma/schema.prisma`, `prisma/migrations/20260817120000_add_product_record_system/` |

Phase B onward is unbuilt. The Phase C through E tables exist and have no readers,
which is deliberate: they are one ADD-only migration rather than five.

---

## Related Documents

- `21_ASSET_MATRIX` — Product entity at Corpus scope, block library projection
- `15_SUPER_ARTICLES` — Project-scope Super-Article, product bank, superseded vendor tiers
- `16_DESIGNER_SHOP_SYSTEM` — Volunteer quotes, designer tier pricing
- `16_COMPENSATION_SYSTEM` — Tier 1 and Tier 2, Folio Credit boundary
- `16_ATTRIBUTION_CONSENT` — Data tiers, private signal classification
- `14_MONETIZATION_AND_VERIFICATION` — Vendor claim and verification ladder
- `claude_17_INTERVIEW_PROMPT_CANON` — Canonical interviewer, elicitation and rendering contracts

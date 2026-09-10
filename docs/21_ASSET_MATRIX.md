# 21_ASSET_MATRIX

## Social publishing contract — adopted 9 September 2026

The [founder specification revision 1.1](Folio-Spotlight-and-Social-Publishing-Spec.md) governs externally exportable social assets. Private draft generation/marked or reduced previews may precede publication, but final assets require a published parent and an independently approved, published, render-ready social-piece version with valid source permissions. One shared server resolver covers slides, ZIPs, images, video, campaign routes and job delivery; parent publication alone is insufficient. Use stable piece landing pages showing the actual media, preserve provenance, and group aspect-ratio variants under one piece. Product-focused stories use approved published spotlights only, including a single-product layout; general project reveals need no spotlight. Vendor state never gates designer exports. Canon adoption is not runtime enforcement; see the [foundation audit](SPOTLIGHT_FOUNDATION_AUDIT_2026-09-09.md).

## Purpose

This document defines the composition system that turns a published project into every
downstream asset Folio produces: the case study PDF, the Instagram carousel, the teaser
films, the quote cards, the corpus-level material studies, and the vendor partnership
proposals.

It exists because these were being treated as six separate features with six separate
generators. They are not. They are one library of blocks, projected across two axes, and
rendered to four targets. Building them separately guarantees the same fragmentation that
`17_INTERVIEW_PROMPT_CANON` was written to correct, one layer further downstream.

**Operating rule:** No asset generator composes its own layout, its own type scale, or its
own copy. Every output surface composes blocks from the library defined in Section 3, and
every block draws from the project record. A new asset format is a new arrangement of
existing blocks or a new render target, never a new generator.

## Authority

This doc sits beneath the canon hierarchy in `08_AI_ROLE`. Where it conflicts with `00`,
`02`, `07`, `08`, `09`, `15`, `16`, or `17`, those win.

Specific inheritances:
- Text inside any block composes from `17`. There is no second editorial voice.
- Quotes are verbatim per `17` Section 5. Composition never rewrites a quote to fit a frame.
- Photography is sacred per `02`. Section 2 below is the operational form of that rule.
- Vendor visibility into any block's underlying data is governed by `16`. Composition does
  not create a new disclosure surface.

**Numbering note.** This document was drafted as `18_ASSET_MATRIX` and committed as `21`,
since `18` through `20` were already taken (`18_PROMPTED_CONTENT_SYSTEM`,
`19_ASSISTED_CAPTURE_SYSTEM`, `20_PRODUCT_NAMING_GATE`).

`17` is occupied by three documents (`17_EDITORIAL_QUEUE`, `17_INTERVIEW_PROMPT_CANON`,
`17_IMAGE_PROVENANCE_GATE`). Section 9 and Section 13 below reference the first two, and
Section 13's closing dependency references the third. Every reference in this document uses
the full filename rather than the bare number, so the collision does not make any citation
here ambiguous. Renumbering the `17` cluster remains outstanding and is out of scope for
this commit, since those filenames are cited across the rest of `docs/`.

---

## 1. The Matrix

Every asset Folio produces is one entity type observed at one scope. The entity is what
the block is about. The scope is how much of the record it draws from.

**Scope axis:** Moment, Room, Project, Corpus.
**Entity axis:** Image, Quote, Product, Material, Spatial.

| | Moment | Room | Project | Corpus |
|---|---|---|---|---|
| **Image** | Single frame, uncaptioned | Room Hero | Cover, Opening Spread | Portfolio Grid |
| **Quote** | Quote Card, Teaser Film | In the Designer's Words | Opening Statement | Practice Statement |
| **Product** | Product Card | Tagged Detail, Room Key | Specification Index | Repeat Specification |
| **Material** | Finish Swatch | Room Palette | Material Palette | Material Study |
| **Spatial** | Detail Crop | Plan Note | At a Glance | Typology Survey |

Not every cell is useful and the grid is not a build list. Its value is that the block
library becomes derivable rather than invented, and that corpus-scope assets fall out as
the same code with a different scope parameter rather than as a separate future feature.

**The load-bearing property of the matrix:** a block is defined by its cell, not by its
output format. Material Palette at project scope is the same block whether it renders as a
PDF page, a carousel slide, or a card. This is what collapses six generators into one.

---

## 2. Frame Invariance

Recognition and distinction live in different layers and must not be traded against each
other.

**The frame is Folio's and never varies.** Hairline rules, one type scale, the wordmark,
the caption bar, the tag marker. It is identical across every designer and every block.

**The content is the designer's and never repeats.** Their photography, their words, their
specifications, their projects.

This holds only if the frame carries almost no visual weight. A color field, a heavy
overlay, or a decorative element causes the eye to read the frame before the image, and two
posts begin to look like the same post regardless of the photography. `02`'s "photos are
sacred" is not only an aesthetic position here. It is the mechanism that lets a stranger
recognize the format while still perceiving each post as distinct.

**Customization is bounded to two controls: a wordmark slot and crop selection.** Designers
will request custom typefaces and brand colors within the first month of the composer
shipping. Granting that request dissolves the acquisition mechanism, because a stranger can
no longer recognize the format across accounts. This is a permanent boundary, not a
sequencing decision.

---

## 3. The Block Library

A block is a named cell with a defined data dependency and a defined render behavior across
targets.

### Scope-level blocks

| Block | Cell | Data dependency |
|---|---|---|
| Cover | Image / Project | Hero image, project title, location, designer |
| At a Glance | Spatial / Project | Typology, area, duration, completion date, credits |
| Opening Statement | Quote / Project | Project-level narrative, one verbatim quote |
| Material Palette | Material / Project | Distinct finishes across tagged products |
| Specification Index | Product / Project | All tagged products with vendor, room, finish |
| Credits | Spatial / Project | Collaborator roles and names |
| End Card | Image / Project | Project URL, wordmark |

### Room-level blocks

| Block | Cell | Data dependency |
|---|---|---|
| Room Hero | Image / Room | Designated hero image scoped to room |
| Tagged Detail | Product / Room | Image with product tag coordinates and keyed list |
| In the Designer's Words | Quote / Room | Verbatim quote with room reference |
| Room Palette | Material / Room | Finishes on products tagged in that room |
| Product Card | Product / Moment | Single product, one image, vendor, finish |
| Process Note | Spatial / Room | Constraint, decision, or method captured in interview |
| Before and After | Image / Room | Paired images with same room reference |

### Corpus-level blocks (deferred, Section 7)

| Block | Cell | Data dependency |
|---|---|---|
| Material Study | Material / Corpus | One finish across three or more projects |
| Repeat Specification | Product / Corpus | Same product specified in two or more projects |
| Typology Survey | Spatial / Corpus | Three or more projects sharing a typology |
| Practice Statement | Quote / Corpus | Quotes across projects on a recurring theme |
| Portfolio Grid | Image / Corpus | Hero images across projects |

---

## 4. The Eligibility Contract

**A block declares its own eligibility. A block whose data dependency is unmet does not
appear in the composer at all.** Not greyed, not disabled with an explanation. Absent.

Threshold examples, to be finalized against the field audit:

| Block | Eligibility condition |
|---|---|
| Material Palette | Four or more distinct tagged finishes |
| In the Designer's Words | Verbatim quote with a resolvable audio offset |
| Teaser Film | Verbatim quote with a resolvable audio offset and usable audio |
| Quote Card | Verbatim quote, no audio required |
| Tagged Detail | Image with two or more product tags carrying coordinates |
| Before and After | Two images with matching room reference and paired flag |
| Material Study | One finish present in three or more distinct projects |
| Repeat Specification | One product tagged in two or more distinct projects |

Three consequences follow, and all three are intended.

**The composer becomes a report card on corpus completeness.** A designer who sat for a full
interview and tagged thoroughly finds fourteen blocks available. A designer who rushed finds
five. Nothing scolds them. The difference in available output does the work.

**Two designers produce visibly different composers without any theming.** Availability
differs because their records differ.

**The system never ships a degraded asset.** A Teaser Film with unusable audio is not
generated as a bad film. It falls back to the Quote Card, which has the lower dependency and
the same content.

---

## 5. Composition Grammar

A post is a scope plus an ordered subset of eligible blocks. The composer enforces
arrangement rather than trusting the toggle.

- Cover or Room Hero opens. End Card closes.
- No two text-dominant blocks adjacent.
- No image used as the lead of two posts within a rolling window.
- Maximum one Specification Index per post.
- Maximum ten blocks in a carousel target.

**Folio composes the defaults.** The designer opens the composer and finds several posts
already assembled from sensible block sets. Toggling edits a good default. Nobody composes
from an empty canvas with thirty checkboxes. This is the same initiation inversion the
Editorial Queue is built on, applied to assets.

---

## 6. Render Targets

One block library, four targets. A block declares how it renders at each.

| Target | Dimensions | Composition |
|---|---|---|
| Case Study PDF | 11 x 8.5in landscape | Full block set, sequential pages |
| Carousel | 4:5 | Ordered subset, maximum ten |
| Teaser Film | 9:16 | Single quote block plus audio, four beats |
| Card | 4:5 and 1:1 | Single block, standalone |

**Teaser Film structure is fixed.** Folio and studio wordmark, project title, image with
verbatim quote, closing card pointing to the project. No music. No motion beyond a slow
push. The restraint is what distinguishes it from a real estate reel, and a fixed structure
is what makes generation on publish trivial.

**The case study PDF is a sendable asset, not a postable one.** It goes into client pitches,
RFPs, awards submissions, and press outreach. The carousel, films, and cards are the
postable assets. Acquisition and retention assets from the same interview.

**No hosted scrollable web version of the case study.** That is the Folio project page. It
already exists at the designer's own URL and is the destination every other asset drives to.
A second web rendering would compete with it.

---

## 7. Scope Phasing

**Phase 1: Project scope.** Moment, Room, and Project cells only. This covers the case study,
the carousel, the films, and the cards.

**Phase 2: Corpus scope.** Material Study, Repeat Specification, Typology Survey, Practice
Statement, Portfolio Grid.

Corpus scope is the same code with a different scope parameter, so it is deferred on data
readiness rather than on engineering cost. It requires a designer to hold multiple published
projects with consistently structured finishes, which the founding cohort will not have for
some time.

Corpus scope is also where the system stops being reproducible. Project-scope composition is
a publishing feature a competitor with taste could approximate. Corpus-scope composition
requires having held a designer's specification history with structured finishes and
consented attribution. That is an accumulation, not a feature.

---

## 8. Product Record Staging

Folio does not have product pages. It has product records that accrue evidence and become
readable at threshold. Nothing switches state manually. Each stage has an entry condition
observable in the data, which is the product-side form of editorial as earned status.

| Stage | Entry condition | Character |
|---|---|---|
| Bare | Created by first designer tag | A listing. Vendor data only. |
| Attributed | First specifier recorded, permanently | Carries provenance. |
| Active | First collaboration completed | Carries one testimony and one install shot. |
| Thickened | Multiple independent contributions | Reads as evidence rather than listing. |
| Readable | Threshold met (Section 9) | Composes as an article. |
| Maintained | Longitudinal re-contact returns | Carries elapsed time on its evidence. |

**Provenance is permanent.** The first specifier is attributed on the record and is never
displaced by later contributors regardless of their standing. This costs nothing, derives
from a timestamp already held, and is the strongest reason for a designer to tag a product
before anyone else does.

**Ordering is by evidentiary weight, not by contributor prestige.** A quote with an install
shot outranks a quote without one. A quote at two years outranks a quote at two weeks. A
repeat specification outranks a single one. Prestige is one input, never the sort key.
Ranking by contributor standing produces a leaderboard and tells a smaller designer their
evidence is worth less, which is the opposite of the position Folio holds.

**Records carry elapsed time.** A quote at install and a quote two years later are different
kinds of evidence, and the second is the one no other party can produce.

**The negative signal is absence, not criticism.** `17` Section 3 bars grievance framing and
that governs here. A product designers stop specifying simply stops accruing, and its most
recent evidence ages visibly while a competitor's stays current. Silence requires no
editorial judgment and cannot be bought.

**Records must be born from a specification.** Bulk catalog ingestion produces empty records
that dilute the ones carrying evidence, in addition to the due diligence liability already
established. Designer-initiated single-product ingestion remains the only path.

---

## 9. Opportunity Detection

The vendor product is not ad inventory. It is a detected, evidenced, already-composed
collaboration that the vendor could not have identified.

An opportunity exists where a corpus-scope block is eligible and a vendor's product sits at
its intersection. A designer with brass across nine projects including two of a vendor's
products yields a Material Study with that vendor at its center. Detection is a query
against the same corpus data the composer runs on. No new render path is required, because
the composed artifact is an existing block.

Four constraints:

**The proposal leads with the evidence, not the offer.** The vendor sees the projects, the
material, the products, the specification span. The offer is the second screen. Leading with
a price makes it an ad buy to be compared against ad buys. Leading with the evidence makes it
a discovery, which is also what it literally is.

**The intersection is observed, never manufactured.** An opportunity exists only where a real
specification exists in the record. Vendors with no specifications get no opportunities. This
is uncomfortable, correct, and the mechanism that makes earning specifications the only path
to the format.

**The designer holds the veto and never receives a queue.** Proposals reach a designer only
with prior opt-in, arrive one at a time as a named offer with the composed artifact attached,
and decline carries no penalty. If this becomes an inbox, it has become the thing designers
came to Folio to escape.

**Both parties approve the artifact, not the concept.** The composed post is generated before
the pitch. Neither side agrees to a vague collaboration to be negotiated later.

**Article threshold.** A product record becomes Readable when it holds independent
contributions from a defined number of distinct designers, each with a verbatim quote and
in-situ photography. The threshold is met or not met by the data. Vendor spend accelerates
and amplifies the piece. It cannot create it. A vendor with no specifications cannot purchase
one at any price, and that constraint is what gives the format its value.

**Longitudinal re-contact is rate limited.** The two questions worth asking are whether the
product held up and whether a repeat specification was informed by the previous one. Both are
unaskable by any other party. Both are ruined by frequency. Trigger on a real signal, being a
repeat specification or a meaningful elapsed interval, never on a schedule alone, and cap
hard per designer per quarter. One well-timed question produces more than twelve generic ones,
and a muted mechanism loses the longitudinal data permanently.

---

## 10. Compensation Boundary

Compensation attaches to discrete consented acts: testimony given, and imagery licensed for
cross-sharing. It does not attach to tagging or specification volume.

This boundary is structural, not conservative. If tagging is compensated, designers tag for
payout rather than accuracy, the record degrades, and vendors are paying for a contaminated
asset. The integrity of the record is the thing being sold. Keeping the specification layer
unpaid is what protects it.

Two further positions:

**Amounts are stated honestly from the first conversation.** Small and real beats implied and
large. A designer who expects meaningful income early and receives a token amount churns
permanently. A designer told upfront that early participation is modest, who then watches it
grow with their corpus, stays. This is also the accurate description, since compensation
grows with accumulation by design.

**Vendor-funded payouts are a bridge with a defined terminus.** Until checkout is live, the
payout pool is capped by vendor spend. That is a transfer, not an economy, and it works
because vendors are buying the data and the collaborations rather than the payouts. The end
condition is checkout converting influence into transaction revenue, and it should be stated
explicitly in the model rather than left as an open-ended mechanism.

**Withdrawal.** A testimony stays anchored to the project where it was given, since it was
accurate at the time and the project is its context. The designer may withdraw it from the
vendor's product record and from future vendor use. Vendors will request perpetual license.
Granting it would trade the constituency that matters more.

---

## 11. Field Dependency Audit

Every block above is composition over a well-formed record. If a quote does not carry a room
reference and an audio offset, the entire Quote column collapses at room scope. If a product
tag does not carry a finish, the Material row does not exist. If an image is not scoped to a
room, Image at room scope is guesswork.

None of this is asset generation work. It is confirming that the interview and tagging
pipelines write structured fields rather than composed prose, which is the same correction
already made on the material palette threading defect.

The following table is the audit target. Every status is UNVERIFIED until the Phase A audit
in the playbook returns.

| Field | Required by | Status |
|---|---|---|
| Quote to answer to transcript segment to audio offset | In the Designer's Words, Teaser Film | UNVERIFIED |
| Per-question audio retained in storage after transcription | Teaser Film | UNVERIFIED |
| Quote carries room reference | Quote at room scope | UNVERIFIED |
| Image carries room reference | Room Hero, all room blocks | UNVERIFIED |
| Room carries designated hero image | Room Hero, quote to image pairing | UNVERIFIED |
| ProductTag carries x and y coordinates | Tagged Detail | UNVERIFIED |
| Product carries structured finish, not free text | Material Palette, Material Study | UNVERIFIED |
| Product carries vendor reference | Specification Index, opportunity detection | UNVERIFIED |
| ImageSource provenance enum on every image | Cross-sharing license, all image blocks | UNVERIFIED |
| First specifier timestamp resolvable per product | Provenance attribution | UNVERIFIED |
| Same product resolvable across projects | Repeat Specification | UNVERIFIED |
| Same finish resolvable across projects | Material Study | UNVERIFIED |
| Project carries typology, area, duration, completion | At a Glance | UNVERIFIED |
| Credits structured by role | Credits | UNVERIFIED |
| Paired image flag for before and after | Before and After | UNVERIFIED |

**Quote to image pairing requires no model call.** The quote came from a room answer, the
room has a designated hero image, use it. Resist making this an inference.

**Only a quote with a live audio offset is film eligible.** If extraction produced a composed
or polished line, it is card eligible and film ineligible. This enforces the verbatim rule at
the rendering boundary rather than attempting to enforce it upstream, consistent with the
elicitation and rendering split established in `17`.

---

## 12. Open Decisions

- Publishing account for a paid partnership post. Designer account with vendor credit is the
  reading consistent with designer authorship, but it changes the economics and needs a
  decision rather than a default.
- Whether partnership payment routes through Folio or between the parties. Routing through
  Folio makes it measurable, priceable, and feeds the attribution ledger. Offline is easier
  to launch and much harder to recapture later.
- Whether the first specifier holds a permanent position in a record's ongoing economy or
  receives a one-time payment at collaboration. A one-time payment removes the incentive to
  be early once the cohort works out the arithmetic.
- Final numeric thresholds in Section 4 and the Readable threshold in Section 9.
- Rolling window length for the repeated-lead-image constraint in Section 5.

---

## 13. Relationship to Existing Documents

**Supersedes** the Automated Media Outputs enumeration in `15_SUPER_ARTICLES`. That list
described six output formats as separate deliverables. They are block arrangements over
render targets. `15` retains authority over multi-party contribution, the product bank, and
conflict resolution. Where `15` describes an output format, this document governs how it is
produced.

**Consumes** `17_INTERVIEW_PROMPT_CANON` for all text inside blocks. There is no second
editorial voice and no block declares its own tone.

**Extends** `17_EDITORIAL_QUEUE` from articles to assets. The composer defaults in Section 5
and the re-contact triggers in Section 9 are the same unprompted initiation primitive at a
different scope.

**Bounded by** `16_ATTRIBUTION_CONSENT` for every disclosure in Section 9. Composition
surfaces nothing a vendor could not already see under their tier.

**Bounded by** `02_NON_NEGOTIABLES` for Section 2. Frame invariance is the operational form
of photos are sacred.

**Depends on** the image provenance gate. Cross-sharing licensed imagery to a vendor record
is not safe until `ImageSource` distinguishes in-situ designer photography from
vendor-derived images.

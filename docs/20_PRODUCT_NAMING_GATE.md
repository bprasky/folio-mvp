# 20_PRODUCT_NAMING_GATE

## Purpose

This document defines a naming exposure gate so that a specific product's brand and product name are usable everywhere the designer is working and everywhere attribution is owed, but appear inside published **article prose** only when the exposure has been paid for. It protects Folio's most valuable editorial real estate — the sentence — from being given away as free earned media.

This is a sibling to `17_IMAGE_PROVENANCE_GATE.md`. That gate governs which *images* reach public surfaces; this gate governs which *product names* reach public prose. Both share the same architecture: the fact lives on the row, enforcement is a single contextual chokepoint, and neither the prompt nor the component decides.

## Context

Folio's generation surfaces name exact products. An interview question reads:

> "The Atwell Collection pendant by Progress Lighting — a clear glass globe with that small, jewel-like scale — feels like a deliberate choice for a dining room that needed presence without weight. What made that fixture the right anchor for this space…"

Naming the product in the *question* is correct — specificity is what pulls a real answer out of the designer, and the question is private to them. The leak is when that same "Atwell Collection pendant by Progress Lighting" lands verbatim in the **published article**. At that moment Folio has handed a vendor the most valuable placement it sells — an editorial mention inside a magazine write-up — for nothing. The vendor did not pay, did not license, did not even claim their catalog. The named mention is the product Folio should be charging for.

The allure of Folio is the tag: the designer tags products, and the credits carry them. That is not the leak and must never be withheld — it is the designer's attribution and their vendor relationship. The leak is specifically the **named mention inside prose**, which reads as an editorial endorsement and which a boost or subscription tier should unlock.

There is a second, symmetric lever earlier in the pipeline. Naming a product as the *subject* of an interview question — "the Atwell Collection pendant by Progress Lighting, what made it the anchor?" — is itself a spotlight worth reserving. A **subscribing vendor** earns that specificity: their pre-tagged products are named and can anchor a dedicated question. A non-subscribing vendor's product is not named and is not spotlighted as a product. What is never gated is the **designer's own story**: when the corpus flags a product as the designer's editorial hook (the standout room, the repeated material), that question still runs, by descriptor. Vendor subscription unlocks *commercial* specificity; the designer's editorial specificity is always on.

## Core Principle

**Knowledge at generation, exposure at render.** The generator may know and use the exact product name to produce a good draft. What reaches a public reader is decided at compose time by a gate — not by trusting the model to omit the name, and not by a component choosing.

There are two gates, one at each end of the pipeline, and both derive from paid state on the row:

1. **Generation-input gate (interview question).** Which pre-tagged products may be *named and spotlighted* in the questions the designer answers. Enforced by what the question-generation call is fed.
2. **Render gate (published prose).** Which product names survive into the article a reader sees. Enforced by a deterministic compose-time scrub.

Naming eligibility is derived from paid state on the row. Prompts and components never decide this.

This is the same shape as the image provenance gate: the vendor image is reference that belongs where the designer works and is suppressed on public surfaces until a grant exists; the vendor product *name* is likewise usable in generation and in credits, and suppressed from public prose until a boost or tier unlocks it.

## The Three Surfaces

A single tagged product flows through three surfaces, each with its own rule. The unlocking signal differs by surface (see The Gate Rules).

| Surface | Audience | Default (unpaid) | Paid |
|---|---|---|---|
| **Interview question** | The designer only (private) | **Descriptor, designer-story only** — the product is named/spotlighted only if the designer's own corpus flags it, and then by descriptor: "that clear glass globe pendant that anchors the room" | **Named and spotlightable** — "the Atwell Collection pendant by Progress Lighting" can be the subject of a dedicated question |
| **Article prose** | Public reader | **Descriptor only** — "a clear glass globe pendant, jewel-like in scale" | **Named and linked inline** |
| **Credits block** | Public reader | **Always named, tagged, and linked** | Always named, tagged, and linked |

Two invariants fall out of this table:

1. **The designer's editorial story is never gated.** A question that exists because the corpus flagged the product as the designer's hook (standout room, repeated material) always runs. What vendor pay status gates is only *commercial* treatment: the product's brand name and its use as a product spotlight. The designer discusses their own room either way; only the label is withheld.
2. **The credits block is never gated.** The tag and the attribution are the allure and the designer's relationship. Suppressing them would defeat the product. What the gate withholds is only the *named prose mention*, which is the premium editorial placement.

## The Gate Rules

Three paid signals feed two rules. All three already exist in the schema; the gate reads existing state and introduces no new paid-state schema in V1.

| Signal | Definition | Source |
|---|---|---|
| **Vendor subscribed** | the product's vendor org has a `VendorSubscription` with `status = ACTIVE` | `model VendorSubscription` |
| **Post boosted** | an `InContextBoost` for this product on this post has `status = 'APPROVED'` | `model InContextBoost` |
| **Designer enterprise** | the posting account's `SubscriptionTier` is `ENTERPRISE` | `User.subscriptionTier` |

**Interview-question naming.** A product may be named and used as the subject of a dedicated question if and only if:

> **the product's vendor is subscribed.**
>
> Otherwise the product is referred to by descriptor and only when the designer's own corpus surfaces it; it is never introduced as a named product spotlight.

(The other two signals are per-piece decisions that resolve *after* the interview — a boost targets a specific post, enterprise is the designer's tier — so neither drives what the question names. Subscription, a standing relationship, is the signal available at interview time.)

**Prose naming.** A product's name appears in article prose if and only if:

> **the product's vendor is subscribed**
> **OR an approved boost exists for that product on this post**
> **OR the posting account is `ENTERPRISE`.**
>
> Otherwise, prose uses the product's **descriptor**. The credits block names it either way.

Subscription is the vendor's all-access path (named in question and prose). The per-post boost is the à-la-carte path for a vendor *without* a subscription who wants one specific placement. Designer enterprise names every tagged product in that designer's own prose regardless of vendor status — including products whose vendor has not claimed their catalog; the enterprise designer has bought full editorial control of their own piece.

## Where Enforcement Lives

**The interview-question gate is enforced at the generation input.** The question-generation call is fed each pre-tagged product already labeled by gate state: a subscribed vendor's product arrives with its name and "you may name and spotlight this product"; a non-subscribed product arrives by descriptor with "refer to by descriptor, never name, and only if the designer's corpus makes it the story." This is the same input layer that resolves the posting identity for the byline, so the labeling has a natural home. It shapes what the model is *allowed* to name; the render gate below is the guarantee.

**The prose gate is one compose-time resolver, the single chokepoint**, run over the final prose before it is persisted or served — regardless of whether a given name came from the AI's framing or from the designer's own answer (a designer who types "the Progress Lighting pendant" must be scrubbed too). It is deterministic, not a second model call and not prompt trust:

1. The piece already knows every tagged product on it (`ProductTag` → `Product.name`, `Product.brand`). That is the exact set of names to police.
2. For each tagged product, resolve its prose gate state (vendor subscribed, or boost APPROVED for this post, or posting account ENTERPRISE).
3. In the prose, replace any occurrence of a **non-eligible** product's brand/product name with its descriptor. Leave eligible products named, and render them as inline links to the product.
4. The credits block is composed from the tag set directly and is never scrubbed.

Prompt guidance still instructs the generator to prefer descriptors in prose (fewer replacements, better first draft), but the scrub is what *guarantees* the policy. Prompt guidance reduces leaks; the resolver eliminates them. As with the provenance gate: components — and here, prompts — never decide this.

## What a Descriptor Is

The descriptor is the product rendered without its proprietary identity: form, material, finish, and scale, but not brand or collection name. "Atwell Collection pendant by Progress Lighting" → "a clear glass globe pendant, jewel-like in scale."

V1 descriptor source, in priority order:

1. A descriptor the generator produced alongside the named mention (ask the draft call to emit both, so the swap text already exists).
2. Otherwise, a deterministic descriptor assembled from `Product.category` + the tag's finish/material (`Selection.colorFinish`) — the same fields the corpus digest already reads.

The descriptor is never empty; a bare category ("a pendant") is an acceptable floor.

## Interaction With Existing Systems

- **`17_IMAGE_PROVENANCE_GATE`** — the image sibling. A piece can be gated on both axes independently: an image may be suppressed (VENDOR_REFERENCE) while a product name is exposed (boosted), or vice versa.
- **`VendorSubscription`** — the standing-relationship signal. Its status decides interview-question naming and is one of the three prose-naming unlocks. This gate gives a subscription editorial value beyond its existing feature set.
- **`InContextBoost`** — the à-la-carte vendor path for a placement without a subscription. This gate gives the boost a second, higher-value surface: today an approved boost drives the product page's In Context section; under this gate it also unlocks the inline name in the article.
- **`16_ATTRIBUTION_CONSENT`** — orthogonal. Consent governs whether the designer's piece may be distributed at all; this gate governs how a product is named within a piece that is already cleared to run.
- **`17_EDITORIAL_QUEUE`** — every completed queue piece is subject to this gate at compose time, exactly as the current editorial draft pipeline is.

## Scope

The gate applies to **all published article prose**, from both:

- the existing editorial draft pipeline (`getOrCreateEditorialDraft` / `generateEditorialDraft`), and
- every Editorial Queue piece (`17_EDITORIAL_QUEUE`).

The prose gate does **not** apply to credits blocks (attribution). The interview-question gate governs only *commercial* naming; the designer's corpus-driven story is never gated. It is a spec-level constraint, not an implementation detail — the same status the provenance gate holds.

## Rejected and Deferred

- **Rejected: enforce naming policy in the prompt alone.** Models leak names, and the designer's own answer can carry them. Prompt guidance is a first pass; the deterministic compose-time scrub is the guarantee.
- **Rejected: withhold the tag or credit for unpaid products.** The tag is the allure and the designer's attribution. Only the inline prose mention is gated.
- **Rejected: gate the designer's editorial story.** The corpus-driven question always runs. Only *commercial* naming (brand name, product spotlight) is gated — never the designer's right to discuss their own room.
- **Rejected: suppress non-subscribed products from the interview entirely.** Killing every question that touches a non-subscribed product would flatten the interview for designers whose signature products happen to be from non-paying vendors — it would gate the designer's value on the vendor's wallet. The descriptor path preserves the editorial quality while still reserving commercial naming for subscribers.
- **Rejected: require a per-post boost for a subscribed vendor's prose.** A subscription is all-access; forcing a second à-la-carte sale on top of it makes the pitch incoherent. The boost is the path for vendors *without* a subscription.
- **Deferred: per-mention vendor pricing / auction for inline placement.** V1 is a binary gate (subscribed / boosted / enterprise → named). Merit- or bid-weighted placement waits for real vendor demand data, same posture as the Editorial Queue's deferred merit-weighted calendar slots.
- **Deferred: a distinct "enterprise unlocks inline naming" entitlement flag.** V1 reads `SubscriptionTier.ENTERPRISE` directly. A finer-grained entitlement can replace the raw tier check later without changing the gate's shape.
- **Deferred: descriptor-quality tuning.** Whether the generator-emitted descriptor (source 1) reliably beats the deterministic assembly (source 2) is an empirical question to settle against the founding cohort's first pieces.

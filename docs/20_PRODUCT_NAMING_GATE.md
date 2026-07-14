# 20_PRODUCT_NAMING_GATE

## Purpose

This document defines a naming exposure gate so that a specific product's brand and product name are usable everywhere the designer is working and everywhere attribution is owed, but appear inside published **article prose** only when the exposure has been paid for. It protects Folio's most valuable editorial real estate — the sentence — from being given away as free earned media.

This is a sibling to `17_IMAGE_PROVENANCE_GATE.md`. That gate governs which *images* reach public surfaces; this gate governs which *product names* reach public prose. Both share the same architecture: the fact lives on the row, enforcement is a single contextual chokepoint, and neither the prompt nor the component decides.

## Context

Folio's generation surfaces name exact products. An interview question reads:

> "The Atwell Collection pendant by Progress Lighting — a clear glass globe with that small, jewel-like scale — feels like a deliberate choice for a dining room that needed presence without weight. What made that fixture the right anchor for this space…"

Naming the product in the *question* is correct — specificity is what pulls a real answer out of the designer, and the question is private to them. The leak is when that same "Atwell Collection pendant by Progress Lighting" lands verbatim in the **published article**. At that moment Folio has handed a vendor the most valuable placement it sells — an editorial mention inside a magazine write-up — for nothing. The vendor did not pay, did not license, did not even claim their catalog. The named mention is the product Folio should be charging for.

The allure of Folio is the tag: the designer tags products, and the credits carry them. That is not the leak and must never be withheld — it is the designer's attribution and their vendor relationship. The leak is specifically the **named mention inside prose**, which reads as an editorial endorsement and which a boost or subscription tier should unlock.

## Core Principle

**Knowledge at generation, exposure at render.** The generator may know and use the exact product name to produce a specific question and a good draft. What reaches a public reader is decided later, at compose time, by a gate — not by trusting the model to omit the name, and not by a component choosing.

Naming eligibility is derived from paid state on the row. Enforcement is contextual at the composer. Prompts and components never decide this.

This is the same shape as the image provenance gate: the vendor image is reference that belongs where the designer works and is suppressed on public surfaces until a grant exists; the vendor product *name* is likewise usable in generation and in credits, and suppressed from public prose until a boost or tier unlocks it.

## The Three Surfaces

A single tagged product flows through three surfaces, each with its own rule.

| Surface | Audience | Default (unpaid) | Boosted / enterprise |
|---|---|---|---|
| **Interview question** | The designer only (private) | Named — "Atwell Collection pendant by Progress Lighting" | Named |
| **Article prose** | Public reader | **Descriptor only** — "a clear glass globe pendant, jewel-like in scale" | **Named and linked inline** |
| **Credits block** | Public reader | **Always named, tagged, and linked** | Always named, tagged, and linked |

Two invariants fall out of this table:

1. **The interview question is never gated.** It is not an exposure surface. Specificity there is a feature.
2. **The credits block is never gated.** The tag and the attribution are the allure and the designer's relationship. Suppressing them would defeat the product. What the gate withholds is only the *inline prose mention*, which is the premium editorial placement.

## The Gate Rule

A product's name appears in article **prose** if and only if:

> **(an active `InContextBoost` exists for that product on this post)** — the vendor is paying —
> **OR (the posting account's `SubscriptionTier` is `ENTERPRISE`)** — the designer's plan unlocks it.
>
> Otherwise, prose uses the product's **descriptor**. The credits block names it either way.

`InContextBoost` (see `prisma/schema.prisma`, `model InContextBoost`) already ties a `productTagId` and `projectPostId` to a vendor with a status flow ending in `APPROVED`. "Active boost" means an `InContextBoost` for this product/post with `status = 'APPROVED'`. `SubscriptionTier.ENTERPRISE` already exists on `User`. The gate reads existing state; it introduces no new paid-state schema in V1.

## Where Enforcement Lives

**One compose-time resolver, the single chokepoint**, run over the final prose before it is persisted or served — regardless of whether a given name came from the AI's framing or from the designer's own answer (a designer who types "the Progress Lighting pendant" must be scrubbed too).

The resolver is deterministic, not a second model call and not prompt trust:

1. The piece already knows every tagged product on it (`ProductTag` → `Product.name`, `Product.brand`). That is the exact set of names to police.
2. For each tagged product, resolve its gate state (boost APPROVED for this post, or posting account ENTERPRISE).
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
- **`InContextBoost`** — the paid-state source for the vendor path. This gate gives the boost a second, higher-value surface: today an approved boost drives the product page's In Context section; under this gate it also unlocks the inline name in the article.
- **`16_ATTRIBUTION_CONSENT`** — orthogonal. Consent governs whether the designer's piece may be distributed at all; this gate governs how a product is named within a piece that is already cleared to run.
- **`17_EDITORIAL_QUEUE`** — every completed queue piece is subject to this gate at compose time, exactly as the current editorial draft pipeline is.

## Scope

The gate applies to **all published article prose**, from both:

- the existing editorial draft pipeline (`getOrCreateEditorialDraft` / `generateEditorialDraft`), and
- every Editorial Queue piece (`17_EDITORIAL_QUEUE`).

It does **not** apply to interview questions (private) or credits blocks (attribution). It is a spec-level constraint, not an implementation detail — the same status the provenance gate holds.

## Rejected and Deferred

- **Rejected: enforce naming policy in the prompt alone.** Models leak names, and the designer's own answer can carry them. Prompt guidance is a first pass; the deterministic compose-time scrub is the guarantee.
- **Rejected: withhold the tag or credit for unpaid products.** The tag is the allure and the designer's attribution. Only the inline prose mention is gated.
- **Rejected: gate the interview question.** It is private and specificity is a feature.
- **Deferred: per-mention vendor pricing / auction for inline placement.** V1 is a binary gate (boosted-or-enterprise → named). Merit- or bid-weighted placement waits for real vendor demand data, same posture as the Editorial Queue's deferred merit-weighted calendar slots.
- **Deferred: a distinct "enterprise unlocks inline naming" entitlement flag.** V1 reads `SubscriptionTier.ENTERPRISE` directly. A finer-grained entitlement can replace the raw tier check later without changing the gate's shape.

## Open Questions

1. **Enterprise semantics.** Does `ENTERPRISE` unlock naming for *all* products in the designer's pieces, or only products whose vendor has at least claimed their catalog? V1 assumes all; revisit if it creates unwanted free exposure for unclaimed vendors.
2. **Descriptor quality.** Whether the generator-emitted descriptor (source 1) is reliably better than the deterministic assembly (source 2) is an empirical question to settle against the founding cohort's first pieces.

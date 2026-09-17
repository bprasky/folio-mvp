# Carousel generation and caption evaluation

Surface: `src/lib/instagram-export/generate-caption.ts`

Goal: repair unavailable generation, retain the selected story angle, and replace invented first-person captions with grounded editorial copy.

Model: `claude-sonnet-5` unchanged; thinking disabled; 500 output-token cap. No provider migration.

Prompt diff: reuse canonical FOLIO_TONE, EDITORIAL_BANNED_PHRASES and EDITORIAL_ACCURACY_RULES verbatim; use third person; require a sourced decision/consequence; restrict named products/materials/vendors to actual photo tags; bound pitch/sequence as untrusted direction, not evidence; remove the nonexistent automatic CTA.

## Final paired evaluation (n=3)

Entirely synthetic fixtures and exact outputs are committed under `scripts/fixtures/social-generation/`. These contain no designer data. Each row compares the previous production prompt to the final candidate with the same source fixture. All six calls finished normally.

| Fixture | Old tokens in/out | New tokens in/out | Quality notes |
|---|---:|---:|---|
| Low sofa / garden sightline | 288 / 147 | 1535 / 137 | Final caption explains the sofa height and open route; no invented first-person voice. |
| Stair landing / tagged handrail | 295 / 149 | 1541 / 142 | Final caption retains the stair correction and exact supplied product name; no unsupported product identity. |
| Narrow dining room / no product tags | 280 / 151 | 1497 / 146 | Final caption explains bench/aisle decision without introducing material or product claims. Closing sentence remains more aphoristic than ideal and should be polished. |

Recommendation: ship the functional correction and grounding improvement; retain human polishing. This small eval does not establish perfect editorial tone compliance.

Cost: at the repository's $3/$15 per million input/output token reference rates, final paired fixture totals are $0.009294 old → $0.020094 new (+116.2%). The canonical accuracy/tone list accounts for most added input tokens. The per-caption increase is about $0.0036 and justified by preventing invented first-person claims and providing grounding. Browsing saved prepared drafts still makes no generation calls.

## Failure evidence and validation limits

- Locally configured API key is present and `ANTHROPIC_ENABLED` is unset. The previous social helpers required exactly `true`; the canonical article generator accepts a configured key unless explicitly `false`. Social helpers now follow that same convention. This verifies a reproducible configuration mismatch, not the deployed environment's value.
- Six earlier bounded requests using already public Meru prose verified the existing provider/model works and compared an intermediate candidate on whole-project, living-room and exterior sources. That candidate still repeated material details without tag context, so it was revised.
- Automatic approval review rejected transmitting real tag metadata for an additional eval because that metadata might not be public. No rejected call ran. Validation continued with entirely synthetic fixtures; no real product-tag metadata was sent by those calls.
- Three intermediate synthetic candidate requests preceded the final paired set. Total executed validation requests: 15, each capped at 500 output tokens. No database writes, automatic production generation, or production configuration changes were performed.
- Headline and bio prompt wording is unchanged. Both now use the same working provider gate and validate array counts/nonempty strings through Zod. Modern article prose extraction and room selection were fixed instead of serializing/truncating article JSON.
- Routes reject invalid rooms and rooms without published prose before a provider request, and return safe coded/retryable errors. Captions can generate without a headline and return one evaluated suggestion per request.

Regression commands: `node scripts/check-social-generation.cjs` and `node scripts/check-social-generation-route.cjs`. Focused ESLint passes (existing explicit-any and unused-designerId warnings only).

# Written by Folio: live synthetic smoke

Run: 2026-09-14T14:25:26.770Z
Model: claude-sonnet-5

Calls execute the production generateFolioLines and callLLM code against the configured provider. SDK retries are disabled and requests capped at six. Only synthetic interviews are sent. Cost-event persistence is captured locally; other database operations are blocked. AI incident persistence is captured locally. Existing repository rates estimate cost.

| Fixture | Requests | Tokens in/out | Estimated USD | Elapsed | Result |
|---|---:|---:|---:|---:|---|
| First-person circulation choice | 2 | 2347/137 | $0.009096 | 4.3s | 1 approved options |
| First-person material decision | 2 | 2466/139 | $0.009483 | 3.5s | 1 approved options |
| Thin preference without supporting intent | 2 | 2145/72 | $0.007515 | 3.5s | 1 approved options |

Total usage reported: 6958 input / 348 output tokens; estimated $0.026094.
Old disabled mode: zero calls and zero tokens; percentage delta is undefined.
Unreturned usage on failed requests is unknown, not measured as zero billed usage.

## First-person circulation choice

Original: We moved the sofa away from the door because we wanted to leave a clear path into the living room.

Context: We moved the sofa away from the door because we wanted to leave a clear path into the living room. The first arrangement made people walk around its back before they could sit down. We tried both positions before settling on this one.

1. We moved the sofa away from the door to leave a clear path into the room — the first arrangement made people walk around its back before they could sit down.

## First-person material decision

Original: We chose glass for the dining table because a solid wood top would have looked too heavy in this small room.

Context: We chose glass for the dining table because a solid wood top would have looked too heavy in this small room. We wanted to see the floor through the table. It was a visual decision; the table takes up the same amount of floor space.

1. A solid wood top would have looked too heavy in this small room, so we chose glass. We wanted to still see the floor through the table.

## Thin preference without supporting intent

Original: I liked this arrangement when we tried it, but I cannot really explain why I preferred it.

Context: I liked this arrangement when we tried it, but I cannot really explain why I preferred it. That is all I remember about this room.

1. I liked this arrangement when we tried it. I cannot really explain why I preferred it.

## Review

All six provider calls returned HTTP 200. All three batches returned one approved option; the contract permits one to three. First-person perspective and the original decision survive in each output, with source snapshots attached.

- Circulation: retains the sofa move and clear-path reason, adding only the source's explanation about walking around the back. The output is longer than the original, so this demonstrates grounded rewriting rather than guaranteed shortening.
- Material: retains glass versus solid wood and the visual reason. It does not turn visual lightness into a claim that the table occupies less floor space. Both materials were supplied in synthetic product tag data.
- Thin preference: retains the designer's inability to explain the preference. No reason, material, or outcome was invented. Improvement is minor: it splits the original into two sentences, and the unresolved phrase “this arrangement” remains. This is a quality limitation, not a grounding failure.

Recommendation: the live provider/generation smoke passes. Offer the results as optional Folio rewrites with the original recoverable; this small fixture set does not establish that every rewrite is more compelling or self-contained. No article regeneration was exercised or needed by this generator.

Initial sandbox attempt was denied at the network boundary (EACCES) before receiving a provider response. The authorized rerun completed as recorded above; no model or provider configuration was substituted.

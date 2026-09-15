# Written by Folio: live synthetic smoke

Run: 2026-09-15T14:22:29.463Z
Model: claude-sonnet-5

Calls execute the production generateFolioLines and callLLM code against the configured provider. SDK retries are disabled and requests capped at twenty-four. Only synthetic interviews are sent. Cost-event persistence is captured locally; other database operations are blocked. AI incident persistence is captured locally. Existing repository rates estimate cost.

| Fixture | Requests | Tokens in/out | Estimated USD | Elapsed | Result |
|---|---:|---:|---:|---:|---|
| before: First-person circulation choice | 2 | 2238/86 | $0.008004 | 4.3s | 1 approved options |
| before: Dining room with several supported angles | 2 | 2741/135 | $0.010248 | 3.5s | 2 approved options |
| before: Thin preference without supporting intent | 2 | 2144/71 | $0.007497 | 2.9s | 1 approved options |
| after: First-person circulation choice | 2 | 3213/249 | $0.013374 | 5.0s | 3 approved options |
| after: Dining room with several supported angles | 2 | 3964/324 | $0.016752 | 6.1s | 5 approved options |
| after: Thin preference without supporting intent | 2 | 2822/145 | $0.010641 | 4.0s | 2 approved options |

Total usage reported: 17122 input / 1010 output tokens; estimated $0.066516.
Before is the narrow quote rewrite; after is the grounded room teaser.
Unreturned usage on failed requests is unknown, not measured as zero billed usage.

## before: First-person circulation choice

Original: We moved the sofa away from the door because we wanted to leave a clear path into the living room.

Context: We moved the sofa away from the door because we wanted to leave a clear path into the living room. The first arrangement made people walk around its back before they could sit down. We tried both positions before settling on this one.

1. We moved the sofa away from the door to leave a clear path into the room. The first arrangement made people walk around its back before they could sit down.

## before: Dining room with several supported angles

Original: We chose glass for the dining table because a solid wood top would have looked too heavy in this small room.

Context: We chose glass for the dining table because a solid wood top would have looked too heavy in this small room. We wanted to see the floor through the table. It was a visual decision; the table takes up the same amount of floor space. Black accents on the pendants, chairs and door hardware balance this bright room. Round pendant lights repeat a shape used across the house. This room is a cross section of the project.

1. Glass, so the floor stays visible through the table. A solid wood top would have looked too heavy for a room this size.
2. The table takes up the same floor space either way. Glass was a visual choice, letting the room read as lighter and more open.

## before: Thin preference without supporting intent

Original: I liked this arrangement when we tried it, but I cannot really explain why I preferred it.

Context: I liked this arrangement when we tried it, but I cannot really explain why I preferred it. That is all I remember about this room.

1. We tried this arrangement, and I liked it. I can't really explain why — I just did.

## after: First-person circulation choice

Original: We moved the sofa away from the door because we wanted to leave a clear path into the living room.

Context: We moved the sofa away from the door because we wanted to leave a clear path into the living room. The first arrangement made people walk around its back before they could sit down. We tried both positions before settling on this one.

1. The sofa's position was tested more than once before settling, moved clear of the door to open a straight path into the living room.
2. An early layout had people skirting the sofa's back to reach it. The fix was simple: pull it away from the entry.
3. Two arrangements were tried here before one won out, the difference coming down to how easily a person could walk in and sit.

## after: Dining room with several supported angles

Original: We chose glass for the dining table because a solid wood top would have looked too heavy in this small room.

Context: We chose glass for the dining table because a solid wood top would have looked too heavy in this small room. We wanted to see the floor through the table. It was a visual decision; the table takes up the same amount of floor space. Black accents on the pendants, chairs and door hardware balance this bright room. Round pendant lights repeat a shape used across the house. This room is a cross section of the project.

1. A glass top was chosen over solid wood, which would have looked too heavy in this small dining room, letting the floor stay visible beneath.
2. The dining table takes up the same floor space as a solid wood alternative would have, but glass keeps the small room feeling open.
3. Black pendants, chairs and door hardware work against the brightness of the dining room, a counterweight in a space built on transparency.
4. Round pendant lights over the dining table repeat a shape found elsewhere in the house, tying this room to the wider project.
5. Described as a cross section of the project, the dining room pairs a glass table with black accents in a considered visual balance.

## after: Thin preference without supporting intent

Original: I liked this arrangement when we tried it, but I cannot really explain why I preferred it.

Context: I liked this arrangement when we tried it, but I cannot really explain why I preferred it. That is all I remember about this room.

1. Some decisions resist explanation. This arrangement stayed simply because it felt right when tested, no further reasoning offered.
2. Not every choice in the bedroom traces back to a stated rationale. This layout was chosen on instinct, and left at that.

## Review

Recommendation: ship. The dining fixture now returns five distinct third-person choices covering table transparency, floor space, black accents, round lights and the wider project, versus two narrow rewrites. Circulation yields three grounded alternatives; thin evidence yields two closely related choices rather than invented room details. Thin-source wording remains less useful and somewhat abstract, so the UI should not promise six options in every room.

Before: 7,123 input / 292 output tokens, $0.025749. After: 9,999 input / 718 output tokens, $0.040767. Cost delta: +58.3% ($0.015018 across three rooms), justified by wider choice and independent factual review. Model unchanged. This is an on-demand cached batch, not a per-room charge on every article generation.

One intermediate evaluation exposed truncation at the old 400-token review limit; the review cap is now 1,000 and the final run above had no truncation. All development evaluation runs together cost approximately $0.192. A second writing/review batch is bounded to one attempt when rich evidence yields fewer than four options; a failed top-up retains already approved options. Those paths have deterministic regression coverage, but were not exercised by the final live outputs.

Output contract change: generator draft JSON uses sourceIds[] (up to three), stored Folio alternatives permit six and generatorVersion:2 invalidates old rewrite pools. Existing originalText/sources provenance and public payload stripping are retained.


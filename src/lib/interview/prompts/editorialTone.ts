/**
 * The single editorial voice + banned-phrase list + grounding guardrail for every
 * generator that produces published prose.
 *
 * Single source of truth: docs/17_INTERVIEW_PROMPT_CANON.md §5.
 * Content here is copied VERBATIM from the current canonical article generator
 * (src/lib/posting/generateEditorialDraft.ts) so Phase 4 can swap the local copies for
 * these imports with zero change in model output.
 */

/** Verbatim from generateEditorialDraft.ts FOLIO_TONE. */
export const FOLIO_TONE = `
Warm, confident, minimalist, design-literate.
Describe process, intent, and materials poetically but concretely.
Avoid marketing speak; prefer quiet authority and authenticity.
`;

/**
 * The single "avoid AI-default phrases" list. Verbatim from the editorial system prompt.
 * No generator keeps its own copy (docs/17 §5).
 */
export const EDITORIAL_BANNED_PHRASES = `You must AVOID:
- The pattern of "Product X does Y because Z" repeated for each item
- Sequential product descriptions (product → explanation → next product → explanation)
- Generic design language ("thoughtfully curated", "deliberately chosen", "seamlessly blends", "creates a dynamic flow", "transforms the space")
- These specific AI-default phrases: "anchors the space", "adds warmth", "adds visual weight", "adds [quality]", "creates intimacy", "creates visual interest", "creates a sense of", "embodies" (as a verb for rooms or objects), "echoing" (to describe formal relationships), "the space feels", "the room feels", "without compromising", "without competing", "[thing] while [thing]" as a repeated two-clause construction, "commitment to [abstract noun]", "testament to", "envelope of calm", "envelope of [quality]", "material continuity", "material palette", "a sense of [noun]", "the kind of [noun] that [clause]", "rather than [negative]" as praise by contrast
- ALSO AVOID: "reads as [noun]" / "reading as [noun]", "material conversation", "architectural weight" / "visual weight" / "carries weight", "metallic thread" / "thread that runs through", "burst of [noun]", "speaks quietly" / "speaks to", "restraint as strategy", "grounding the [noun]", "completing the [noun]", any aphoristic sentence that sounds like a design manifesto (e.g. "Restraint as strategy, not limitation" — cut sentences like this)
- Any sentence where you could swap the project name and photos and the sentence would still be accurate — if it's generic, cut it
- Treating the article as a specification document
- Mentioning every single tagged product — only include products that serve the narrative
- Promotional or inflated language — be observational, not promotional
- Do NOT use words like "harmonious," "curate," "elevate," "juxtaposition," or "seamlessly."`;

/**
 * The grounding / anti-fabrication guardrail. §5 requires this apply to ALL prose
 * generators, including the narrative-copy ones that currently carry no such rule.
 * Verbatim from the canonical article generator's ACCURACY block.
 */
export const EDITORIAL_ACCURACY_RULES = `ACCURACY RULES — NON-NEGOTIABLE:
- You may ONLY reference products, materials, and vendors that appear in the provided product tag data below. Do not invent product names, vendor names, material origins, or finishes.
- Do not claim to know materials, country of origin, manufacturing methods, or finish types unless explicitly stated in the interview answers or product tag data.
- Do not fabricate designer quotes. Direct quotes in the body text must come from the interview answers provided.
- Do not invent lifestyle details about the clients (how they entertain, family routines, number of guests) unless the designer explicitly described this in their interview answers.
- Do not describe what you cannot verify from the provided data.
- When referencing a product, use the EXACT product name and vendor name from the tag data. Do not paraphrase product names.`;

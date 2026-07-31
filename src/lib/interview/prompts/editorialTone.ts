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

/**
 * JSON string safety for every generator that hand-serializes PROSE into JSON.
 *
 * Why this exists: our editorial prompts mandate at least one direct attributed
 * quote per chapter, so almost every body paragraph contains quotation marks. A
 * straight `"` inside a JSON string value is only legal when escaped as `\"`, and
 * the model reliably forgets when the quotation nests (e.g. an inner aside inside
 * a longer quote). One unescaped `"` at character 15,799 invalidates the entire
 * 20KB response — the designer sees a 502 and loses a two-minute generation.
 *
 * The fix is to remove the escaping requirement instead of restating it: curly
 * quotes carry no meaning in JSON, so they need no escape and cannot terminate a
 * string early. They are also correct magazine typography, which is why this is a
 * net win rather than a workaround. Downstream pull-quote extraction already
 * matches U+201C/U+201D alongside the straight quote, so nothing needs to change
 * to read the result.
 *
 * Include this in any prompt whose response is prose inside JSON.
 */
export const JSON_PROSE_QUOTING_RULE = `JSON STRING SAFETY — NON-NEGOTIABLE:
- Use typographic curly quotes for ALL quotation marks inside prose: “ ” around direct speech, and ‘ ’ for a quotation nested inside another quotation.
- NEVER emit a straight double quote (") inside a string value. That character belongs to JSON syntax only; an unescaped one makes the entire response unparseable and the work is discarded.
- Apostrophes are the straight ' character (didn't, designer's, clients'). Never substitute a double quote for an apostrophe.
- Never put a literal line break inside a string. Each paragraph is its own array element.`;

/**
 * Rewrite every straight double quote in a block of PROSE WE INJECT INTO A PROMPT
 * as a typographic curly quote.
 *
 * Why this exists, and why the rule above is not enough on its own: the prompt is
 * not just instructions. It carries the designer's interview answers, the already
 * published chapters, their bio, and their other projects — and all of that is
 * straight-quoted, because it was typed by a person or generated before the rule
 * existed. In append mode a single generation can ship ten published chapters of
 * straight-quoted magazine prose plus thirty-one answers each wrapped in `A: "…"`,
 * and then ask the model to "match their register." Thousands of words modelling
 * the wrong character beat one line of instruction, deterministically: correlation
 * generate_71e2451a999f failed on attempt 1 at temperature 0.7 and again on the
 * resample at 0.3, both times on a straight-quoted attribution in the very first
 * introduction paragraph.
 *
 * So the context has to obey the rule it states. This is the lesson from the last
 * LLM_JSON_PARSE ("prompt examples are training data") applied to the half of the
 * prompt that isn't hand-written: anything prose-shaped going into a prompt whose
 * answer is prose-inside-JSON must be normalized on the way in.
 *
 * Scope: straight `"` only. Apostrophes stay straight per the rule, and no other
 * character is touched — this must never alter the designer's words beyond the
 * quote glyph. A `"` opens a quotation when it starts the text or follows
 * whitespace or an opening bracket, and closes one otherwise; the same rule turns
 * a trailing inch mark (96") into 96”, which is correct typography and, more to
 * the point, cannot terminate a JSON string.
 *
 * Nested quotations become “…“…”…” rather than the “…‘…’…” the rule asks the model
 * to write. That is deliberate: inferring nesting depth from raw text is guesswork,
 * and the property that matters here is that the context contains zero straight
 * double quotes.
 */
export function toTypographicQuotes(text: string): string {
  if (!text) return text;
  return text.replace(/"/g, (_match, offset: number) => {
    const prev = offset > 0 ? text[offset - 1] : '';
    const opens = prev === '' || /[\s([{<‘“—–-]/.test(prev);
    return opens ? '“' : '”';
  });
}

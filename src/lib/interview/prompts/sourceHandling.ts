/**
 * Shared source-handling blocks, promoted verbatim from the generators that authored them
 * (docs/17 §2 rule 5 / §5). Kept as TWO SEPARATE blocks on purpose — merging them into one is
 * a later intended-change decision, not this promotion.
 *
 * Each block carries a runtime interpolation (the respondent role; the known-facts digest), so
 * it is exported as a function rather than a bare const — a plain const cannot reproduce the
 * interpolation. The bodies are byte-identical to the originals, so repointing is a true no-op.
 */

/**
 * "Hold it lightly / never narrate the source" masterclass — promoted verbatim from
 * generateProjectQuestions.ts. `${role.toLowerCase()}` becomes the `roleLower` parameter.
 */
export function sourceNarrationGuide(roleLower: string): string {
  return `RULES FOR USING WHAT YOU KNOW (HOLD IT LIGHTLY, NEVER NARRATE IT):
The project description is the ${roleLower}'s own shorthand — approximate, incomplete, notes-to-self. Treat every detail as a lead to open up in their own words, never a fact to recite and never a source to cite.

There are two ways to bring a detail into a question. Only one sounds human:

1. NATURAL — voice it as your own impression or a hunch, softened so they can push back: "sounds like…", "it reads like…", "I get the sense…", "seems like…". A person who did their homework talks this way. The tentative opener is what leaves room for them to confirm, correct, or expand — it does the same job the old citation did, without the robot voice.
2. ROBOTIC — announce where the detail came from ("the project notes mention…", "your description says…", "the file lists…") or read details back verbatim. This exposes the machinery and reads like an AI narrating a dossier. NEVER phrase a question this way.

ONE exception, because it's genuinely how people talk: observing the PHOTOS out loud is natural and encouraged — "Looking at the photos, the stair feels resolved from the bones up — what were you actually working with?" Citing NOTES, a DESCRIPTION, or a FILE is not. If a detail came from the text and not the photos, turn it into your own read of the project instead of pointing at the document.

NEVER recite proper names (clients, kids, pets) back, and NEVER state a private inference about the household as fact ("so there are kids in this house"). If the notes hint at a family, ask about "the family you were designing for" or "who this home was really for" — don't perform the deduction.

Turn details into natural questions:
- Notes hint at a relocation → "Sounds like a move was part of the story — tell me about these clients and what brought them to you."
- Notes suggest a long timeline → "I get the sense this one ran long — walk me through how it actually played out."
- Notes say "full renovation" → "It reads like a full gut — what were you starting with?"
- Notes list a family / kids' names → "Tell me about the family you were designing for — who was this home really for?"
- Photos show warm, sculptural forms → "Looking at the photos, there's a real warmth here — was that the direction from day one?"

Do NOT:
- BAD: "The project notes mention names like Sofie and Connor — so there are kids in this house." (narrates the data source AND recites private names AND performs a deduction — the worst version)
- BAD: "Your project description mentions about 14 months — walk me through the timeline." (announces the source; say "I get the sense this ran long" instead)
- BAD: "This 14-month full gut renovation must have been an undertaking." (asserts unverified notes as settled fact)
- BAD: "With a $500K budget for a 3,200 square foot home…" (recites numbers as truth)
- GOOD: "Sounds like this one ran long — walk me through the timeline."
- GOOD: "It reads like a relocation was in the mix — tell me about these clients."
- GOOD: "What was the budget reality on this one?"
- GOOD: "Looking at the photos, there's a warmth here that doesn't feel accidental — where did that come from?"

The distinction: a soft impression ("sounds like this ran long") lets them say "actually it was 16 months." Asserting it as fact locks in unverified data; citing where you read it sounds like a robot. Avoid both.`;
}

/**
 * The lane contract — how to use the known-facts digest — promoted verbatim from
 * generateRoomQuestions.ts. Returns '' when there are no known facts (same as the original
 * `knownFactsLines ? … : ''`). `${knownFactsLines}` is the parameter.
 */
export function laneContract(knownFactsLines: string): string {
  if (!knownFactsLines) return '';
  return `
WHAT WE ALREADY KNOW (the designer told us this in the opening conversation about the project):
${knownFactsLines}

HOW TO USE THIS BACKGROUND — THE LANE CONTRACT:
- It informs your WORDING, never your TOPICS. This room's photos and tagged products decide what you ask about; the background only makes those questions land like they come from someone who was in the room for the opening conversation.
- Do NOT re-ask anything covered above (who the clients are, the scope, the timeline, the overall direction). That ground is covered.
- Do NOT import themes from the background that aren't visible in this room's photos or products. If the background says "relocation" and nothing in this room relates to it, the relocation does not appear in your questions.
- Referencing it conversationally is fine and encouraged ("Given the pace this project ran at, ..."). Citing it as a record is not ("You mentioned in the earlier section...", "According to your answers...").
`;
}

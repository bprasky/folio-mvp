/**
 * The headline frame library.
 *
 * `HEADLINE_CRITERIA` is almost entirely prohibitive: six of its ten headings are
 * explicit prohibitions, against one that gives positive direction, and the only
 * place a headline SHAPE appears is a five-line GOOD block held against ten
 * counter-examples and seven banned shapes (docs/audits/HEADLINE_GENERATION_AUDIT.md
 * §2). A model asked to write under that has nothing to build from, so it climbs
 * to a level of abstraction where no specific rule applies — a category ("The Rise
 * of Fluted Wood") or a verdict ("Formal outside, unruly within"). Both are
 * retreats from the reporting, and neither breaks a stated rule.
 *
 * A frame replaces free composition with selection plus slot filling. The shape is
 * fixed, the slots are named structured fields, and eligibility is decided in code
 * before the model is called — so the model is never asked whether it has the facts
 * a frame needs, only to write the frame it was handed.
 *
 * This is not a new pattern for Folio. `src/lib/editorial-queue/signals.ts` runs
 * eleven deterministic slot-templates over numeric facts and produces specific,
 * non-interchangeable lines; gallery chapter titles and Instagram campaign post
 * titles do the same. Reader-facing headlines are the one surface where it was
 * never applied.
 *
 * WHY THIS FILE IS PURE. Frame declarations and eligibility live here, beside
 * `editorialTone.ts`, because `docs/17` §6 makes `src/lib/interview/prompts/` the
 * one location prompts compose from — and the fragmentation §6 exists to prevent
 * is already real on this surface (five title generators, three private rule sets).
 * Every file in this directory is free of Prisma, the AI SDKs and `next/*`, which
 * is what lets any route import from it. Reading the database to FILL a slot is
 * therefore not done here — see `src/lib/posting/headlineSlots.ts`.
 */

/**
 * A slot names the structured field it draws from, in schema terms.
 *
 * `source` is a real column path rather than a label, because the whole point of a
 * frame is that the value is traceable to a row. If a slot cannot name where its
 * value comes from, it is free composition wearing a frame's clothes.
 */
export interface HeadlineSlot {
  /** Slot key, referenced by the frame's shape text. */
  name: string;
  /** The schema path this draws from, e.g. `ProductTag.finishRaw`. */
  source: string;
  /** What the slot holds, for the prompt fragment. */
  description: string;
}

export interface HeadlineFrame {
  id: string;
  /** Human name, used in logs and in docs/23. */
  name: string;
  /** Ordered — the order the shape reads in. */
  slots: readonly HeadlineSlot[];
  /**
   * Slot names that must resolve to a non-null, VERIFIED value for this frame to
   * be eligible. Verified means a human stated it: see the Material frame's note
   * on `ProductTag.finishConfirmed`. Inference from prose or from a product name
   * is not verification.
   */
  requiredFields: readonly string[];
  /**
   * Whether this frame needs a deck to carry the second half of the information.
   *
   * Three of the five title surfaces have no deck field at all (Instagram export,
   * collaboration story, editorial queue angle — audit §4). A frame that assumes a
   * deck is ineligible there. The failure mode this prevents is the obvious one:
   * making the title carry both loads, which is how a headline becomes a summary.
   */
  requiresDeck: boolean;
  /**
   * Real published titles in this frame. NEVER invented — an invented exemplar
   * teaches a shape nobody has validated, which is how the previous criteria
   * taught the balanced pair as GOOD.
   *
   * Empty means unsourced, not "none exist". `assertFrameLibraryIntegrity` reports
   * empty arrays rather than failing, so a frame ships usable and gets its
   * exemplars when someone can read them off published articles.
   */
  exemplars: readonly string[];
  /** What the terminal clause must be. See TAIL_RULE. */
  tailRule: string;
  /** The shape, written as an instruction. Slot names appear in {braces}. */
  shape: string;
}

/**
 * The tail rule, binding on every frame.
 *
 * A frame terminates on a fact, never on an evaluation. "Reimagined for a family
 * of five" is a fact — it can be checked against the reporting and it is wrong if
 * the family has four. "That pulls out all the stops" cannot be wrong about
 * anything, which is exactly why it is available whenever the writer has nothing
 * left to report.
 *
 * This is `docs/09` applied to the last four words: editorial tone is
 * "observational, not promotional" and "does not inflate importance". An
 * evaluative tail is the inflation, and it is the cheapest place to put it.
 */
export const TAIL_RULE =
  'The final clause must state a fact — who it was for, what it replaced, where it ' +
  'came from, what it cost, what happened next. Never an assessment of how good the ' +
  'result is. A tail a reader could check is correct; a tail a reader could only ' +
  'agree with is not.';

/**
 * The Material frame.
 *
 * Materials are structured on the row and the headline route is passed none of
 * them (audit §3.C, F8) — the article generator flattens `buildMaterialContext`
 * down to a names-only string, and the headline endpoint receives no product data
 * whatsoever. So a `first-move` angle asking for "the material the rest of the
 * house answered to" was being asked of a model that had not been told which
 * materials exist. That gap is the entire reason this frame is first.
 *
 * SHAPE: the material is the grammatical SUBJECT and the designer is the agent in
 * the tail. That ordering is the point. "The designer chose travertine" leads with
 * the person the byline already names; "Travertine, bought before the drawings"
 * leads with the thing only this project has. The subject position is the scarcest
 * real estate in the sentence and a frame is how it stops going to the wrong noun.
 *
 * BRAND SAFETY. The material slot holds a member of the fixed 38-entry
 * `MATERIAL_CLASSES` vocabulary and nothing else. `docs/20` gates product names out
 * of published prose unless the exposure is paid for, and a headline is the most
 * valuable prose Folio has — so the protection here is total by construction rather
 * than by policing: the resolver reads a product name but cannot emit one.
 *
 * B1 drew this slot from `ProductTag.finishRaw`, free text a designer typed, which
 * needed `carriesProprietaryName()` to keep a brand out. That check is retained as
 * defence-in-depth and is now unreachable on this path; `assertIsMaterialClass` in
 * `headlineSlots.ts` is what makes the claim checkable instead of asserted.
 */
export const MATERIAL_FRAME: HeadlineFrame = {
  id: 'material',
  name: 'Material as subject',
  slots: [
    {
      name: 'material',
      source: 'material class via materialClassOf() — a member of MATERIAL_CLASSES',
      description:
        'The material class: marble, travertine, oak, brass, concrete, plaster. The ' +
        'noun a published design headline actually uses. Never a finish, never a ' +
        'product name and never a brand.',
    },
    {
      name: 'verb',
      source: 'headlineVerbs — an eligible verb, preconditions already satisfied',
      description:
        'An active, transitive, physical verb with the material as its SUBJECT: ' +
        'clads, lines, frames, divides, anchors, runs. Use one from the list given ' +
        'below; never invent one, and never a passive or a copula.',
    },
    {
      name: 'tail',
      source: 'Room.name where the class is tagged, else Project.city / regionState',
      description:
        'The place the material acts on. A real room this material was tagged in, ' +
        'or the project location. Use it as given — do not substitute a room you ' +
        'inferred from the interview.',
    },
  ],
  // `tail` IS required. It was not, and the cost was direct: the slot went
  // unresolved, rendered as a description, and the model invented the place — three
  // of the first five headlines to reach a designer named no location at all. A
  // headline that cannot say where is not a headline this frame should offer, so an
  // unresolvable place now makes the frame ineligible rather than a prompt to guess.
  //
  // `verb` is deliberately NOT required. It is available on nearly every project
  // now, but a material with no room-assigned tags would otherwise lose the frame
  // entirely — and a material headline without a verb from the list is still better
  // than no material headline. The shape demands one; eligibility does not.
  requiredFields: ['material', 'tail'],
  // The material carries the subject and the tail carries the event, so the
  // sentence is complete on its own. Nothing is deferred to a deck.
  requiresDeck: false,
  // Real published headlines, from docs/audits/headline-discriminator-corpus.json.
  //
  // Every exemplar must pass every check Folio enforces — one that breaks a rule
  // teaches the rule away, which is how the old criteria came to list the balanced
  // pair as GOOD.
  //
  // These stay agent-free, but for a different reason than in B7. The naming ban is
  // gone, so agent-led headlines are no longer illegal; they belong to a DIFFERENT
  // frame. A material-frame exemplar that opened on a studio name would teach the
  // agent arrangement inside the frame whose whole point is that the material takes
  // the subject position.
  exemplars: [
    'Coloured marble defines his-and-hers sinks in Marylebone penthouse',
    'Monolithic green marble forms \u201Cmajestic wall\u201D in Milan apartment',
    'Blocks of terrazzo divide up muted pizza restaurant in Beijing',
    'Rough drystone walls frame sunken home on Greek island by Alexandre Pavlidis',
    'Water disappears through gaps in Serafini\'s \u201Csculptural yet functional\u201D Piano washbasin',
    // RE-CASED to house convention. Published as "Steel Elements Bring a Sheen to
    // This 1300s French Townhouse" — Dwell sets Title Case, Folio sets sentence
    // case. Same words, same arrangement; only the convention changed, and only
    // "French" needed keeping. Done by hand, never algorithmically: this module's
    // own header explains why lowercasing cannot be automated ("Miami beach").
    // The corpus keeps the published form; the exemplar check matches
    // case-insensitively.
    'Steel elements bring a sheen to this 1300s French townhouse',
  ],
  tailRule: TAIL_RULE,
  shape:
    '{material} is the SUBJECT and it must ACT. Write it as the agent of {verb} — ' +
    'an active, transitive, physical verb — acting on {tail}, and close on a place.\n' +
    '\n' +
    'The material does something. It is not something that was done to.\n' +
    '  YES  Coloured marble defines his-and-hers sinks in Marylebone penthouse\n' +
    '  YES  Blocks of terrazzo divide up muted pizza restaurant in Beijing\n' +
    '  NO   A glass table was chosen to keep a dining room from crowding\n' +
    '  NO   A stone bought without a shopping list became the bathroom\'s anchor\n' +
    '\n' +
    'The two NOs put the material in subject position and then describe what ' +
    'happened TO it — passive, or a copula. Grammatically the subject, ' +
    'semantically the object. That is the failure this frame exists to prevent, so ' +
    'no was/were/became/is/are/had been, and no verb hidden in a relative clause ' +
    '("paneling THAT raises", "styling THAT took"). One finite active verb, and the ' +
    'material owns it.',
};

/**
 * The Agent-verb-object frame.
 *
 * The corpus arrangement: a named studio as subject, a physical verb, the thing
 * acted on, and an instrument tail. "Studio X clads a Brooklyn loft in white oak."
 *
 * IT FIRES AS OF B8. It was declared-and-withheld for three phases, on three
 * blockers; two are gone and the third turned out to be somewhere else.
 *
 *   1. "`agent` cannot be verified." WITHDRAWN as inconsistent. There is still no
 *      name-verification predicate — `User.name` is a plain String — but the frame
 *      contract's bar has always been "a human stated it", and that is exactly the
 *      bar `ProductTag.finishConfirmed` clears. A designer typing their own name is
 *      not a weaker fact than a designer typing a finish. What the schema lacks is
 *      IDENTITY verification, a higher bar this contract never asked for anywhere
 *      else. The slot is account-asserted and says so in its `source`.
 *   2. "Naming the designer is banned." REVERSED in B8 on corpus evidence: 57% of
 *      published design headlines open on the credited party. The ban's reason —
 *      the byline below already says it — is not one the corpus shares.
 *   3. "`namedPlace` was unresolvable." TRUE, and irrelevant here: it is a VERB
 *      precondition, not a frame requirement. `object` resolves from `Room.name`.
 *
 * What actually gates it now is the VERB. Application, Placement, Division and
 * Aperture verbs all require preconditions nothing can answer (`namedSurface`,
 * `spatialObject`, `spatialRelation`, `apertureFact`), so the only verbs ever
 * offered are Continuity ones — the frame can currently say that a material runs,
 * carries, threads, repeats, extends or continues, and nothing else. Widening it
 * means resolving surfaces and spatial relations, not touching this frame.
 *
 * Fires when: a credited name exists, the article covers at least one room, and a
 * material class appears in more than one place (which is what makes a Continuity
 * verb eligible).
 */
export const AGENT_VERB_OBJECT_FRAME: HeadlineFrame = {
  id: 'agent-verb-object',
  name: 'Agent, verb, object',
  slots: [
    {
      name: 'agent',
      source: 'Organization.name or User.name (credited) — account-asserted, not identity-verified',
      description:
        'The studio or designer, as the credited party. Named, not described. Use ' +
        'the credited name exactly as given.',
    },
    {
      name: 'verb',
      source: 'headlineVerbs — an eligible verb, preconditions already satisfied',
      description:
        'A physical action from the eligible list. Never a generic: no features, ' +
        'showcases, elevates, transforms.',
    },
    {
      name: 'object',
      source: 'Room.name, or a named surface',
      description: 'The thing acted on — the room, the facade, the island, the stair.',
    },
    {
      name: 'instrument',
      source: 'the interview, or a resolved material class',
      description: 'What it was done WITH, stated as a fact.',
    },
  ],
  requiredFields: ['agent', 'verb', 'object'],
  requiresDeck: false,
  // The corpus's largest group. Since B8 unbanned the name these are exemplars for
  // a frame that ships, not for one held back.
  // Chosen for VERB variety, now that the frame ships: hides, perches, inserts,
  // clads, completes. The verb is the slot that does the work.
  exemplars: [
    'Form(LA) hides stone furniture showroom behind marble pivot door',
    'Studio Font perches cliffside home in Mexico on inhabitable concrete columns',
    'Iterare Arquitectos inserts stark white home into shell of old Spanish building',
    'Besley & Spresser clads Sydney Harbour pavilion with oyster shell terrazzo',
    'OMA completes first US affordable housing development',
    'Studio Okami Architecten updates Belgian home with The Garden Pavilion',
  ],
  tailRule: TAIL_RULE,
  shape:
    'Open on {agent} as the subject. Then {verb} — use the verb exactly as given, ' +
    'do not substitute a synonym. Then {object}, the thing acted on. Close on ' +
    '{instrument}: what it was done with, as a fact.',
};

/**
 * The Borrowed-fragment frame.
 *
 * A verbatim fragment of the designer's own speech carries the evaluative language;
 * everything around it stays factual. "‘We had to fight for that window’ — and the
 * plan changed twice."
 *
 * THIS IS THE ONE THAT FITS THE CANON EXACTLY, and the reason is worth stating
 * because it looks at first like a loophole. TAIL_RULE and EVALUATIVE_ADJECTIVES ban
 * evaluation because an assessment cannot be checked and inflates by default. A
 * quoted evaluation is a different object: the claim is not "this house is
 * remarkable", it is "the designer said this house is remarkable", and THAT is a
 * fact — checkable against the interview, and wrong if they did not say it.
 *
 * `docs/17` §5 puts the same rule the other way round: pull quotes are the
 * contributor's actual words, verbatim, never polished. The evaluation is allowed
 * precisely because it belongs to a named person rather than to us.
 *
 * Two properties this depends on, both already built:
 *   - The fragment must be VERBATIM. `isVerbatimSpan` in `posting/quoteCandidates`
 *     is the check, and it is the same one the pull-quote pipeline uses.
 *   - `hasEvaluativeTail` must not kill the frame's own output. It is quote-aware
 *     for exactly this reason — see its note.
 *
 * The fragment is SELECTED, never written. That is the pull-quote posture: a
 * headline is our sentence so a designer may type their own, but a borrowed
 * fragment is a claim about what they said out loud, so it can only be chosen.
 */
export const BORROWED_FRAGMENT_FRAME: HeadlineFrame = {
  id: 'borrowed-fragment',
  name: 'Borrowed fragment',
  slots: [
    {
      name: 'fragment',
      source: 'a verbatim span of an interview answer, checked by isVerbatimSpan',
      description:
        'The designer\'s own words, quoted exactly. This is the only place ' +
        'evaluative language is permitted, because it belongs to them. Do not ' +
        'paraphrase, do not tidy, do not extend it by a single word.',
    },
    {
      name: 'context',
      source: 'the interview',
      description:
        'The factual remainder: what happened around the thing they said. Plain, ' +
        'checkable, and carrying no assessment of its own.',
    },
  ],
  requiredFields: ['fragment'],
  requiresDeck: false,
  // ONE in B7, five now. The constraint that held it to one was the naming ban:
  // seven of the eight collected borrowed-fragment headlines open on a studio name,
  // and while that was illegal they could not be taught. B8 unbanned it, so the
  // device can be shown in the grammar the corpus actually uses it in.
  //
  // Note what these have in common regardless of who the subject is: the evaluation
  // is always inside the quotation marks and always someone's. That is the frame,
  // and it is orthogonal to whether an agent leads.
  exemplars: [
    'Monolithic green marble forms \u201Cmajestic wall\u201D in Milan apartment',
    'WXCA creates \u201Cchiselled-out monolithic block\u201D for Polish History Museum',
    'Studio Aisslinger completes \u201Cnature-loving\u201D renovation of Hotel Seegarten',
    'Open Studio designs izakaya-style restaurant with \u201Chalf-dipped dumpling\u201D lamp',
    'Matthew Fisher blends antiquity with \u201Ccomforts of quiet luxury\u201D in New York gallery',
  ],
  tailRule: TAIL_RULE,
  shape:
    'Quote {fragment} exactly as the designer said it, inside quotation marks. ' +
    'Everything outside the quotation marks is {context} and must be plain fact \u2014 ' +
    'the evaluation is theirs, and borrowing it does not license any of your own. ' +
    'Do not introduce the quote with a verb of speaking; let it sit in the sentence.',
};

/** Every frame. Built to hold five or more; three are implemented. */
export const HEADLINE_FRAMES: readonly HeadlineFrame[] = [
  MATERIAL_FRAME,
  BORROWED_FRAGMENT_FRAME,
  AGENT_VERB_OBJECT_FRAME,
];

/**
 * A slot value that survived resolution: a real value from a real row.
 *
 * `verified` is carried rather than assumed because the distinction is the whole
 * contract. An extraction pass proposing "brass" and a designer typing "unlacquered
 * brass" produce the same string and are not the same fact.
 */
export interface ResolvedSlot {
  name: string;
  value: string;
  source: string;
  verified: boolean;
}

export interface FrameEligibilityContext {
  /** Whether the calling surface HAS a deck field. Audit §4. */
  hasDeck: boolean;
}

/**
 * Which frames this project can fill, decided in code.
 *
 * The model is never asked "do you have enough to write a material headline?" —
 * that question invites a yes, and a yes with nothing behind it is the fabrication
 * the accuracy rules exist to stop. A frame is offered only when every required
 * slot already holds a verified value.
 */
export function eligibleFrames(
  resolved: readonly ResolvedSlot[],
  ctx: FrameEligibilityContext,
  frames: readonly HeadlineFrame[] = HEADLINE_FRAMES,
): HeadlineFrame[] {
  const usable = new Map<string, ResolvedSlot>();
  for (const slot of resolved) {
    if (slot.verified && slot.value.trim()) usable.set(slot.name, slot);
  }
  return frames.filter((frame) => {
    if (frame.requiresDeck && !ctx.hasDeck) return false;
    return frame.requiredFields.every((field) => usable.has(field));
  });
}

/**
 * The prompt fragment for one frame, with its resolved values inlined.
 *
 * The values are stated rather than described, because a slot the model has to go
 * find in the interview is not a slot. Exemplars are included only when real ones
 * exist — an empty block is better than a fabricated one.
 */
export function renderFrameInstruction(
  frame: HeadlineFrame,
  resolved: readonly ResolvedSlot[],
): string {
  const values = frame.slots
    .map((slot) => {
      const hit = resolved.find((r) => r.name === slot.name);
      // The provenance label is the slot's own `source`, not a blanket claim. It used
      // to append "stated by the designer" to every value, which was true of a
      // confirmed finish and false of a room name or a city — and a prompt that
      // overstates where a value came from invites the model to treat it as speech.
      return hit
        ? `- {${slot.name}} = ${hit.value}   [verified — ${hit.source}]`
        : `- {${slot.name}} — ${slot.description}`;
    })
    .join('\n');

  const exemplars = frame.exemplars.length
    ? `\nPublished headlines in this frame:\n${frame.exemplars.map((e) => `- ${e}`).join('\n')}`
    : '';

  return `FRAME — ${frame.name}

${frame.shape}

Values, already verified. Use them as given; do not substitute, generalize, or
look for a different material:
${values}

TAIL: ${frame.tailRule}${exemplars}`;
}

/**
 * Words that assess rather than report. See EVALUATIVE_ADJECTIVES in
 * `editorialTone.ts` for the prompt-facing statement of the same rule.
 *
 * Deliberately NOT a list of adjectives-in-general. Factual adjectives drawn from
 * the work — cantilevered, lime-washed, book-matched, unlacquered, fluted,
 * quarter-sawn — are the frame's raw material and must survive. What is caught is
 * the class that could be written without having seen the project.
 */
const EVALUATIVE_TERMS = [
  'stunning', 'gorgeous', 'breathtaking', 'dreamy', 'elevated', 'luxe',
  'jaw-dropping', 'jaw dropping', 'must-see', 'must see', 'showstopping',
  'showstopper', 'drop-dead', 'swoon-worthy', 'swoonworthy', 'to die for',
  'stunningly', 'gorgeously', 'breathtakingly',
];

const EVALUATIVE_IDIOMS = [
  /\bpulls? out all the stops\b/i,
  /\bgoes? all out\b/i,
  /\bwow factor\b/i,
  /\bknocks? it out of the park\b/i,
  /\braises? the bar\b/i,
  /\bsets? a new standard\b/i,
  /\bhas to be seen\b/i,
];

/**
 * Remove double-quoted spans, so an evaluation inside a quotation is not read as
 * ours. An unclosed quote takes the rest of the string, which is the safe direction:
 * it can only under-report, never flag a quoted word as an authored one.
 */
export function stripQuotedSpans(text: string): string {
  return text
    .replace(/\u201C[^\u201D]*(\u201D|$)/g, ' ')
    .replace(/"[^"]*("|$)/g, ' ');
}

/**
 * Whether a headline ends on an evaluation rather than a fact.
 *
 * Pure and deterministic, so the tail rule is checkable rather than merely stated.
 * The audit's finding was that unenforced prompt prose is exactly what failed on
 * this surface, and a `tailRule` field nothing reads would repeat it.
 *
 * NOT wired into `headlineIssues` in this phase — that would change grading for
 * every headline on every surface, and this phase ships one frame. See docs/23
 * §Blocked.
 */
export function hasEvaluativeTail(text: string): boolean {
  // Quoted spans are exempt, and this is the Borrowed-fragment frame's premise
  // rather than a loophole in it. "This house is remarkable" is an assessment we
  // cannot check. "The designer said this house is remarkable" is a fact, wrong if
  // they did not say it — and `isVerbatimSpan` is what makes it checkable. The
  // evaluation belongs to a named person, which is the distinction docs/17 §5
  // draws when it requires pull quotes to be the contributor's actual words.
  //
  // Only DOUBLE quotes are stripped. The apostrophe is the straight ' per
  // JSON_PROSE_QUOTING_RULE, so treating single quotes as speech would swallow
  // "didn't" and blind the check to everything after it.
  const unquoted = stripQuotedSpans(text);
  const lower = ` ${unquoted.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ')} `;
  for (const term of EVALUATIVE_TERMS) {
    if (lower.includes(` ${term} `)) return true;
  }
  return EVALUATIVE_IDIOMS.some((re) => re.test(unquoted));
}

/**
 * Whether the headline's subject never actually does anything.
 *
 * The defect behind every bad headline in the first live batch of B10:
 *
 *   A glass table WAS CHOSEN to keep a bright dining room from crowding
 *   A stone bought without a shopping list BECAME the bathroom's anchor
 *   Black anchors WERE the first idea for the dining room, and STAYED the last
 *   STYLING THAT TOOK more objects than the shelf could keep
 *
 * Each puts a thing in subject position and then reports what happened TO it, or
 * what it merely was — grammatically the subject, semantically the patient. The
 * corpus never does this: "Coloured marble DEFINES his-and-hers sinks", "Blocks of
 * terrazzo DIVIDE UP muted pizza restaurant". The subject acts.
 *
 * Three shapes, all of them ways to avoid a finite active verb:
 *   - passive        was chosen, were kept, is lined
 *   - copula/becoming  was the first idea, became the anchor, stayed the last
 *   - the verb demoted into a relative clause, so the subject owns nothing:
 *     "styling THAT TOOK...", "paneling THAT RAISES..."
 *
 * This is deliberately NOT a general English rule — published headlines use the
 * passive ("A Midcentury Home's Past Mistakes Are Finally Corrected"). It is a rule
 * for the arrangements Folio actually has, all three of which want their subject to
 * act. A project-as-subject frame, if one is ever built, would need to relax it.
 */
// Regular participles end -ed/-en/-t. The irregulars are a small closed list, and
// they are the ones this domain actually uses: "was LAID across the entry",
// "was BUILT to the old plan", "were HUNG in the stairwell".
const IRREGULAR_PARTICIPLE =
  'laid|built|made|hung|sunk|cast|held|kept|left|torn|drawn|shown|given|taken|put|' +
  'cut|set|done|run|won|sold|told|brought|bought|found|worn|woven|sewn|struck|split';
const PASSIVE_VOICE = new RegExp(
  `\\b(was|were|is|are|been|being)\\s+(\\w+ly\\s+)?(\\w+(ed|en|t)|${IRREGULAR_PARTICIPLE})\\b`,
  'i',
);
const COPULA = /\b(was|were|is|are|am)\s+(a|an|the|his|her|its|their|my|our|not|still|finally|no)\b/i;
const BECOMING = /\b(became|becomes|stayed|stays|remained|remains|got|gets)\b/i;
/** The subject's only verb sits inside a relative clause — at the head, or after a colon. */
const VERB_DEMOTED = /(^|:\s*)[\w'()\u2019-]+(\s+[\w'()\u2019-]+){0,2}\s+(that|which)\s+\w+/i;

export function hasWeakPredicate(text: string): boolean {
  const outside = stripQuotedSpans(text);
  return (
    PASSIVE_VOICE.test(outside) ||
    COPULA.test(outside) ||
    BECOMING.test(outside) ||
    VERB_DEMOTED.test(text)
  );
}

/**
 * Structural invariants over the library itself, returned rather than thrown.
 *
 * Unsourced exemplars are REPORTED, not failed: a frame with no published examples
 * is incomplete, not broken, and blocking on them would mean inventing them.
 */
export function assertFrameLibraryIntegrity(
  frames: readonly HeadlineFrame[] = HEADLINE_FRAMES,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();

  for (const frame of frames) {
    if (ids.has(frame.id)) errors.push(`duplicate frame id: ${frame.id}`);
    ids.add(frame.id);

    const slotNames = new Set(frame.slots.map((s) => s.name));
    for (const field of frame.requiredFields) {
      if (!slotNames.has(field)) {
        errors.push(`${frame.id}: requiredFields names "${field}", which is not a slot`);
      }
    }
    for (const slot of frame.slots) {
      if (!slot.source.trim()) errors.push(`${frame.id}.${slot.name}: no source`);
      if (!frame.shape.includes(`{${slot.name}}`)) {
        errors.push(`${frame.id}: shape never places {${slot.name}}`);
      }
    }
    if (frame.tailRule !== TAIL_RULE) {
      errors.push(`${frame.id}: tailRule diverges from TAIL_RULE — one rule, one copy`);
    }
    for (const exemplar of frame.exemplars) {
      if (hasEvaluativeTail(exemplar)) {
        errors.push(`${frame.id}: exemplar breaks the tail rule — "${exemplar}"`);
      }
    }
    if (frame.exemplars.length === 0) {
      warnings.push(`${frame.id}: no exemplars sourced yet (must be real, never invented)`);
    }
  }
  return { errors, warnings };
}

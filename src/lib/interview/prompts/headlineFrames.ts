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
 * the tail. That ordering is the point. "The designer chose unlacquered brass"
 * leads with the person the byline already names; "Unlacquered brass, specified
 * before the plan" leads with the thing only this project has. The subject
 * position is the scarcest real estate in the sentence and a frame is how it stops
 * going to the wrong noun.
 *
 * BRAND SAFETY. The material slot draws from a finish value, never from
 * `Product.name` or `Product.brand`. That is not incidental: `docs/20` gates
 * product names out of published prose unless the exposure is paid for, and a
 * headline is the most valuable prose Folio has. Because the slot can only ever
 * hold a finish descriptor, no gated name can reach it and the frame needs no gate
 * of its own. `headlineSlots.ts` enforces the source; see its note on why it
 * reuses the gate's own vocabulary rather than keeping a second copy.
 */
export const MATERIAL_FRAME: HeadlineFrame = {
  id: 'material',
  name: 'Material as subject',
  slots: [
    {
      name: 'material',
      source: 'ProductTag.finishRaw (finishConfirmed = true)',
      description:
        'The material or finish, as the designer specified it — "unlacquered brass", ' +
        '"lime-washed plaster", "book-matched travertine". A material noun, never a ' +
        'product name and never a brand.',
    },
    {
      name: 'tail',
      source: 'the interview',
      description:
        'What was done with it, decided about it, or paid for it — stated as a fact.',
    },
  ],
  requiredFields: ['material'],
  // The material carries the subject and the tail carries the event, so the
  // sentence is complete on its own. Nothing is deferred to a deck.
  requiresDeck: false,
  // UNSOURCED. Requires reading real published Folio headlines out of the
  // database; this must not be filled by invention. See docs/23 §Exemplars.
  exemplars: [],
  tailRule: TAIL_RULE,
  shape:
    'Open on {material} as the grammatical subject of the sentence — the first ' +
    'thing the reader meets. Do not open on the designer, the client, the room, or ' +
    'the house. Then {tail}: what was decided about that material, in the ' +
    'designer\'s own reporting. The designer may appear as the agent of that ' +
    'decision but never as the subject of the sentence, and never by name.',
};

/** Every frame. Built to hold five or more; one is implemented. */
export const HEADLINE_FRAMES: readonly HeadlineFrame[] = [MATERIAL_FRAME];

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
      return hit
        ? `- {${slot.name}} = ${hit.value}   [from ${hit.source}, stated by the designer]`
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
  const lower = ` ${text.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ')} `;
  for (const term of EVALUATIVE_TERMS) {
    if (lower.includes(` ${term} `)) return true;
  }
  return EVALUATIVE_IDIOMS.some((re) => re.test(text));
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

/**
 * The headline verb library.
 *
 * The verb is the highest-leverage slot in a headline. Published design headlines
 * turn on a specific physical action — clads, perches, inserts, splits, frames,
 * wraps — and the generic ones are where a headline goes to say nothing: features,
 * showcases, elevates, transforms, reimagines. A specific verb forces a specific
 * object, so choosing the verb is most of choosing the sentence.
 *
 * ── Why a flat list is not enough ────────────────────────────────────────────
 *
 * `renovate` is wrong on a new build, and no word list can know that. So a verb is
 * a typed record carrying the conditions under which it may be offered, and
 * eligibility is computed in code before the model sees the list — exactly as frame
 * eligibility already works in ./headlineFrames. The model chooses among eligible
 * verbs; it never proposes one.
 *
 * ── Unknown is not permission ────────────────────────────────────────────────
 *
 * Conditions are TRI-STATE: holds, doesNotHold, unknown. A condition nobody can
 * evaluate is `unknown`, and unknown withholds the verb on both sides — a required
 * condition must be known to hold, and a barring condition must be known NOT to.
 *
 * This is not theoretical. `existingStructure` and `newBuild` are unknowable today:
 * no per-project new-build-versus-renovation field exists anywhere in the schema
 * (`ProjectType` is a sector taxonomy, `ProjectStage` a workflow stage,
 * `ProjectTimeline` is PAST/PRESENT/FUTURE, `ClientType` is RESIDENTIAL/COMMERCIAL;
 * the only renovation strings are `User.architectSpecializations` and
 * `User.builderProjectTypes`, which describe the practitioner, not the project).
 * So every Intervention verb is withheld until that field exists. That is the
 * correct outcome — offering `renovate` on a project that might be a new build is
 * precisely the error this design is for — and `explainVerb` makes it visible
 * rather than silent.
 *
 * ── Sourcing versus validating ───────────────────────────────────────────────
 *
 * Where the interview states what physically happened, the verb should come from
 * the designer's own account rather than be chosen freely. That is two gates, both
 * required: the verb must be IN the library, and its preconditions must be
 * satisfied by structured data. A verb passing one and failing the other is
 * rejected — a designer saying "we clad it in oak" does not make `clad` usable if
 * no material class resolves, and a resolvable material class does not license a
 * verb the designer never used.
 *
 * Extraction is NOT built in this phase. The seam is `selectVerbs({ candidate })`:
 * pass a verb lemma an extractor found in the interview and it is put through both
 * gates. See SEAM below.
 *
 * Pure, like the rest of `src/lib/interview/prompts/` — no Prisma, no AI SDK.
 * Facts are resolved elsewhere and passed in.
 */

export type VerbCategory =
  | 'intervention'
  | 'application'
  | 'placement'
  | 'division'
  | 'continuity'
  | 'aperture';

/**
 * The structured facts a verb can depend on. Each names something that must be
 * resolvable from a row, not inferred from prose.
 */
export type VerbCondition =
  /** The project worked on a building that already stood. */
  | 'existingStructure'
  /** The project is ground-up construction. */
  | 'newBuild'
  /**
   * A named place the verb can act on — a room, or a surface within one.
   *
   * Was `namedSurface`, and that was the bug. Surfaces are not structured (the
   * schema has rooms, not walls), so the condition could never hold and every
   * Application verb was permanently withheld. But `clads the kitchen in oak` is
   * exactly what these verbs do; a room is the object they take. The condition was
   * asking for something narrower than the verbs need and narrower than the data
   * has.
   */
  | 'namedPlace'
  /** A material class resolves for the project (marble, oak, brass…). */
  | 'materialClass'
  /**
   * A real object sitting in a named room — a tagged product on a photograph of
   * that room. The tag carries x/y coordinates, so the placement is a recorded
   * fact rather than an inference.
   */
  | 'spatialObject'
  /** A stated spatial relationship between two areas. */
  | 'spatialRelation'
  /** The same material class in more than one room or image. */
  | 'classInTwoPlaces'
  /** A window, opening, or light fact. */
  | 'apertureFact';

/** Tri-state. `unknown` is the state that matters. */
export type ConditionState = 'holds' | 'doesNotHold' | 'unknown';

/**
 * What is known about a project. A condition ABSENT from this map is `unknown` —
 * which is why the map is partial rather than a full record of booleans. An
 * explicit `false` means "known not to hold" and is a different claim.
 */
export type VerbFacts = Partial<Record<VerbCondition, boolean>>;

export interface HeadlineVerb {
  /** `${category}:${verb}` — a lemma may appear in two categories with different
   *  preconditions ("extend" a building versus "extend" a material run). */
  id: string;
  /** Lemma, as an extractor would find it. */
  verb: string;
  /** Third-person singular, the form a headline uses. */
  headlineForm: string;
  category: VerbCategory;
  /** Every one must be known to HOLD. */
  requires: readonly VerbCondition[];
  /** Every one must be known NOT to hold. */
  barredWhen: readonly VerbCondition[];
  /**
   * Collocations `EDITORIAL_BANNED_PHRASES` already bans, which this verb can fall
   * into. The verb is usable; these exact phrasings are not. Carried per-verb so
   * the ban travels with the word that can trigger it.
   */
  bannedCollocations?: readonly string[];
}

const v = (
  category: VerbCategory,
  verb: string,
  headlineForm: string,
  requires: VerbCondition[],
  barredWhen: VerbCondition[] = [],
  bannedCollocations?: string[],
): HeadlineVerb => ({
  id: `${category}:${verb}`, verb, headlineForm, category, requires, barredWhen, bannedCollocations,
});

/**
 * INTERVENTION — acting on something that already stood.
 *
 * All withheld today: `existingStructure` is unknowable (see the header). This is
 * the category the coverage report exists to unblock.
 */
const INTERVENTION: HeadlineVerb[] = [
  v('intervention', 'renovate', 'renovates', ['existingStructure'], ['newBuild']),
  v('intervention', 'restore', 'restores', ['existingStructure'], ['newBuild']),
  v('intervention', 'convert', 'converts', ['existingStructure'], ['newBuild']),
  v('intervention', 'extend', 'extends', ['existingStructure'], ['newBuild']),
  v('intervention', 'remodel', 'remodels', ['existingStructure'], ['newBuild']),
  v('intervention', 'strip', 'strips', ['existingStructure'], ['newBuild']),
  v('intervention', 'expose', 'exposes', ['existingStructure'], ['newBuild']),
];

/** APPLICATION — putting a material onto a surface or into a room. */
const APPLICATION: HeadlineVerb[] = [
  v('application', 'clad', 'clads', ['namedPlace', 'materialClass']),
  v('application', 'wrap', 'wraps', ['namedPlace', 'materialClass']),
  v('application', 'line', 'lines', ['namedPlace', 'materialClass']),
  v('application', 'sheathe', 'sheathes', ['namedPlace', 'materialClass']),
  v('application', 'panel', 'panels', ['namedPlace', 'materialClass']),
  v('application', 'tile', 'tiles', ['namedPlace', 'materialClass']),
  v('application', 'face', 'faces', ['namedPlace', 'materialClass']),
];

/** PLACEMENT — where an object sits. */
const PLACEMENT: HeadlineVerb[] = [
  // "anchors the space" is banned outright by EDITORIAL_BANNED_PHRASES. The verb
  // is not — "brass anchors the stair" names a real object. The collocation is
  // what fails, so the collocation is what is carried.
  v('placement', 'anchor', 'anchors', ['spatialObject'], [], ['anchors the space']),
  v('placement', 'center', 'centers', ['spatialObject']),
  v('placement', 'set', 'sets', ['spatialObject']),
  v('placement', 'perch', 'perches', ['spatialObject']),
  v('placement', 'suspend', 'suspends', ['spatialObject']),
  v('placement', 'float', 'floats', ['spatialObject']),
  v('placement', 'sink', 'sinks', ['spatialObject']),
];

/** DIVISION — one area made into two. */
const DIVISION: HeadlineVerb[] = [
  v('division', 'split', 'splits', ['spatialRelation']),
  v('division', 'divide', 'divides', ['spatialRelation']),
  v('division', 'screen', 'screens', ['spatialRelation']),
  v('division', 'partition', 'partitions', ['spatialRelation']),
  v('division', 'separate', 'separates', ['spatialRelation']),
  v('division', 'break', 'breaks', ['spatialRelation']),
];

/**
 * CONTINUITY — the same material in more than one place.
 *
 * `echo` is DELIBERATELY ABSENT. `EDITORIAL_BANNED_PHRASES` bans `"echoing" (to
 * describe formal relationships)`, and a formal relationship is exactly what this
 * category describes — the same travertine in the kitchen and the bath. Including
 * it would put a new list in direct contradiction with the centralized one, which
 * `docs/17` §5 makes binding. `continue` covers the same ground without the
 * conflict. Recorded in docs/23 §8 for a decision rather than resolved silently.
 */
const CONTINUITY: HeadlineVerb[] = [
  // "thread that runs through" is banned; the verbs are not.
  v('continuity', 'run', 'runs', ['classInTwoPlaces'], [], ['thread that runs through']),
  v('continuity', 'carry', 'carries', ['classInTwoPlaces'], [], ['carries weight']),
  v('continuity', 'thread', 'threads', ['classInTwoPlaces'], [], ['metallic thread', 'thread that runs through']),
  v('continuity', 'repeat', 'repeats', ['classInTwoPlaces']),
  v('continuity', 'extend', 'extends', ['classInTwoPlaces']),
  v('continuity', 'continue', 'continues', ['classInTwoPlaces']),
];

/** APERTURE — what an opening does with light or view. */
const APERTURE: HeadlineVerb[] = [
  v('aperture', 'frame', 'frames', ['apertureFact']),
  v('aperture', 'open', 'opens', ['apertureFact']),
  v('aperture', 'admit', 'admits', ['apertureFact']),
  v('aperture', 'filter', 'filters', ['apertureFact']),
  v('aperture', 'screen', 'screens', ['apertureFact']),
];

export const HEADLINE_VERBS: readonly HeadlineVerb[] = [
  ...INTERVENTION, ...APPLICATION, ...PLACEMENT, ...DIVISION, ...CONTINUITY, ...APERTURE,
];

/**
 * The generics. Each is a verb that can be written about any project without
 * having seen it, which is the same test EVALUATIVE_ADJECTIVES applies to the tail.
 *
 * `unveil` is listed with an exception because it has one legitimate use — a
 * genuine first public reveal. That exception is a fact about the piece, not a
 * judgement about the writing, so it is stated here and enforced by the caller
 * rather than by the word list.
 */
export const BANNED_HEADLINE_VERBS: readonly string[] = [
  'feature', 'features', 'featuring',
  'showcase', 'showcases', 'showcasing',
  'elevate', 'elevates', 'elevating',
  'transform', 'transforms', 'transforming',
  'reimagine', 'reimagines', 'reimagining',
  'redefine', 'redefines', 'redefining',
  'celebrate', 'celebrates', 'celebrating',
  'embrace', 'embraces', 'embracing',
  'boast', 'boasts', 'boasting',
  'unveil', 'unveils', 'unveiling',
];

/** The one exception, stated so a caller can grant it deliberately. */
export const UNVEIL_EXCEPTION =
  'unveil is permitted ONLY for a genuine first public reveal — a project, product ' +
  'or space being shown publicly for the first time. Never as a synonym for "shows".';

/** Prompt-facing statement of the same rule. */
export const BANNED_HEADLINE_VERBS_RULE = `NEVER USE THESE VERBS. Each can be written about any project by someone who has not seen it, which is what makes it available when there is nothing to report:
features, showcases, elevates, transforms, reimagines, redefines, celebrates, embraces, boasts, unveils.

${UNVEIL_EXCEPTION}

Use a verb that names what physically happened instead — what was put on what, what sits where, what was cut, what carries through. A specific verb forces a specific object; that is the point of choosing it.`;

/** Whether a headline uses a banned generic verb. */
export function usesBannedVerb(text: string): string | null {
  const words = text.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (BANNED_HEADLINE_VERBS.includes(w)) return w;
  }
  return null;
}

/** Resolve one condition against what is known. Absent means unknown. */
export function conditionState(condition: VerbCondition, facts: VerbFacts): ConditionState {
  const known = facts[condition];
  if (known === undefined) return 'unknown';
  return known ? 'holds' : 'doesNotHold';
}

export interface VerbVerdict {
  eligible: boolean;
  /** Why not, in the caller's terms. Empty when eligible. */
  reasons: string[];
}

/**
 * Whether one verb may be offered, and if not, why.
 *
 * Returned rather than logged so the caller can surface it. A verb silently
 * withheld because a field does not exist is indistinguishable from a verb nobody
 * wanted, and that is how a missing column stays missing.
 */
export function explainVerb(verb: HeadlineVerb, facts: VerbFacts): VerbVerdict {
  const reasons: string[] = [];
  for (const c of verb.requires) {
    const state = conditionState(c, facts);
    if (state === 'holds') continue;
    reasons.push(state === 'unknown'
      ? `requires ${c}, which is UNKNOWN — withheld rather than guessed`
      : `requires ${c}, which does not hold`);
  }
  for (const c of verb.barredWhen) {
    const state = conditionState(c, facts);
    if (state === 'doesNotHold') continue;
    reasons.push(state === 'unknown'
      ? `barred when ${c}, which is UNKNOWN — withheld rather than guessed`
      : `barred when ${c}, which holds`);
  }
  return { eligible: reasons.length === 0, reasons };
}

export interface SelectVerbsOptions {
  /**
   * SEAM for interview verb extraction (not built this phase).
   *
   * A lemma an extractor found in the designer's own account of what physically
   * happened. It is put through BOTH gates: it must be in the library, and its
   * preconditions must be satisfied. Passing one and failing the other is a
   * rejection, not a partial credit — which is the whole reason the candidate is
   * validated here rather than trusted at the extraction site.
   */
  candidate?: string;
}

export interface VerbSelection {
  /** Every verb that may be offered to the model. */
  eligible: HeadlineVerb[];
  /** The extracted candidate, if it passed both gates. */
  sourced: HeadlineVerb | null;
  /** Why a candidate was rejected, for logging. Null when none was supplied. */
  candidateRejection: string | null;
  /** Verbs withheld, with the reason — the record of what the data cannot support. */
  withheld: Array<{ id: string; reasons: string[] }>;
}

export function selectVerbs(
  facts: VerbFacts,
  opts: SelectVerbsOptions = {},
  verbs: readonly HeadlineVerb[] = HEADLINE_VERBS,
): VerbSelection {
  const eligible: HeadlineVerb[] = [];
  const withheld: Array<{ id: string; reasons: string[] }> = [];

  for (const verb of verbs) {
    const verdict = explainVerb(verb, facts);
    if (verdict.eligible) eligible.push(verb);
    else withheld.push({ id: verb.id, reasons: verdict.reasons });
  }

  let sourced: HeadlineVerb | null = null;
  let candidateRejection: string | null = null;
  const candidate = opts.candidate?.trim().toLowerCase();
  if (candidate) {
    const inLibrary = verbs.filter((x) => x.verb === candidate);
    if (inLibrary.length === 0) {
      candidateRejection = `"${candidate}" is not in the library (gate 1)`;
    } else {
      // A lemma can sit in two categories; the sourced verb is whichever sense the
      // data supports. If none does, the verb is rejected rather than downgraded.
      sourced = eligible.find((x) => x.verb === candidate) ?? null;
      if (!sourced) {
        const why = inLibrary.map((x) => `${x.id}: ${explainVerb(x, facts).reasons.join('; ')}`);
        candidateRejection = `"${candidate}" is in the library but its preconditions fail (gate 2) — ${why.join(' | ')}`;
      }
    }
  }

  return { eligible, sourced, candidateRejection, withheld };
}

/** The prompt fragment: the verbs this project may use, and nothing else. */
export function renderVerbInstruction(selection: VerbSelection): string {
  if (selection.eligible.length === 0) return '';
  const byCategory = new Map<VerbCategory, string[]>();
  for (const verb of selection.eligible) {
    byCategory.set(verb.category, [...(byCategory.get(verb.category) ?? []), verb.headlineForm]);
  }
  const lines = Array.from(byCategory.entries())
    .map(([category, forms]) => `- ${category}: ${forms.join(', ')}`)
    .join('\n');

  const collocations = Array.from(
    new Set(selection.eligible.flatMap((x) => x.bannedCollocations ?? [])),
  );

  return `VERBS — choose from these and no others. Each is offered because the facts
this project has can support it; a verb not listed is missing its facts, not its
permission.
${lines}
${selection.sourced ? `\nThe designer's own account uses "${selection.sourced.verb}". Prefer it.` : ''}
${collocations.length ? `\nEven with an allowed verb, these exact phrasings are banned: ${collocations.map((c) => `"${c}"`).join(', ')}.` : ''}`;
}

/** Structural invariants, returned rather than thrown. */
export function assertVerbLibraryIntegrity(
  verbs: readonly HeadlineVerb[] = HEADLINE_VERBS,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();

  for (const verb of verbs) {
    if (ids.has(verb.id)) errors.push(`duplicate verb id: ${verb.id}`);
    ids.add(verb.id);
    if (verb.id !== `${verb.category}:${verb.verb}`) {
      errors.push(`${verb.id}: id does not match category:verb`);
    }
    if (verb.requires.length === 0) {
      errors.push(`${verb.id}: no preconditions — a verb with no requirements is a flat list entry`);
    }
    if (BANNED_HEADLINE_VERBS.includes(verb.verb) || BANNED_HEADLINE_VERBS.includes(verb.headlineForm)) {
      errors.push(`${verb.id}: is also in BANNED_HEADLINE_VERBS`);
    }
    // -y verbs inflect to -ies (carry -> carries), so compare on the stem.
    const stem = verb.verb.replace(/(e|y)$/, '');
    if (!verb.headlineForm.startsWith(stem)) {
      warnings.push(`${verb.id}: headlineForm "${verb.headlineForm}" does not look inflected from "${verb.verb}"`);
    }
  }
  const categories = new Set(verbs.map((x) => x.category));
  if (categories.size !== 6) errors.push(`expected 6 categories, found ${categories.size}`);
  if (verbs.length < 25 || verbs.length > 40) {
    errors.push(`library holds ${verbs.length} verbs; the brief calls for 25-40`);
  }
  return { errors, warnings };
}

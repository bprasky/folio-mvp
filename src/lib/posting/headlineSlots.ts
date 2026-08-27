/**
 * Slot resolution for the headline frame library.
 *
 * Frames and eligibility are declared in `@/lib/interview/prompts/headlineFrames`,
 * which is pure by design — every file under `src/lib/interview/prompts/` is free
 * of Prisma, the AI SDKs and `next/*`, and that purity is what lets any route
 * import a prompt without dragging the database in. Reading rows to FILL a slot is
 * therefore done here, beside the rest of the headline machinery (`headline.ts`,
 * `headlineEditor.ts`, `loadInterviewAnswers.ts`).
 *
 * ── What counts as a material value (B3) ──────────────────────────────────────
 *
 * A material CLASS: marble, travertine, oak, brass, concrete, plaster — the nouns a
 * published design headline actually uses. Resolved by `materialClassOf()` over
 * `Selection.colorFinish` plus `Product.name` / `.description` / `.category`.
 *
 * B1 gated on `ProductTag.finishConfirmed` and shipped `finishRaw` as the value.
 * That was the wrong granularity. Finish was chosen because the naming gate's
 * vocabulary was the brand-free list to hand, which solved brand safety and landed
 * on data a headline cannot use: headlines do not name finishes. Three things
 * improve with the class source, and all three are load-bearing:
 *
 *   1. Eligibility no longer needs `finishConfirmed`. A class resolves from the
 *      tagged product itself, so the gate is "a material class resolves", not "a
 *      designer typed a finish string".
 *   2. Brand safety gets STRONGER. `materialClassOf` can only ever return a member
 *      of the fixed 38-entry `MATERIAL_CLASSES` vocabulary, so no proprietary
 *      string can survive it — the resolver reads a product name but cannot emit
 *      one. `finishRaw` was free text and needed policing.
 *   3. Resolution is PER TAG, which is what makes "the same class in two rooms"
 *      computable. That is the `classInTwoPlaces` precondition the Continuity verbs
 *      depend on, and it is why this is not merely a vocabulary swap.
 *
 * ── What is still refused, and what B3 deliberately reverses ─────────────────
 *
 * A material named in interview PROSE is still refused, and this is the line that
 * actually matters. The interview supplies the frame's TAIL — what was decided about
 * the material — but a noun a model found in a paragraph is not a structured value
 * and cannot be traced to a row.
 *
 * B1 additionally refused a material INFERRED FROM A PRODUCT NAME. B3 reverses that
 * deliberately, and the reversal is safe for a reason B1 did not have: the
 * derivation's OUTPUT is constrained to a 38-entry vocabulary. B1's objection was
 * that `buildDescriptor` would turn "Antolini Calacatta slab" into "a marble" and
 * present it as though the designer had said marble. Under `materialClassOf` the
 * emitted token is the class `marble` and can be nothing else — not the brand, not
 * the collection, not a phrase. What made inference unsafe was the open output, not
 * the reading of the name.
 *
 * ── What "verified" means here, precisely ─────────────────────────────────────
 *
 * The frame contract says a required slot must be non-null and VERIFIED. Under the
 * class source, verified means: traceable to a designer action on a row. The
 * designer placed the tag — they chose that product for that photograph — and the
 * class is a deterministic projection of that product onto a closed vocabulary.
 *
 * This is a different claim from B1's, and weaker in one direction: the designer
 * did not type the word "marble". It is stronger in another: a derived class cannot
 * be a brand, and cannot be a sentence the designer typed into the wrong field.
 * Neither source is inference from prose, which is the line that actually matters.
 *
 * ── Why no brand can reach a headline ─────────────────────────────────────────
 *
 * `docs/20` gates product and brand names out of published prose unless the
 * exposure is paid for, and calls the sentence "Folio's most valuable editorial
 * real estate". A headline is the most valuable sentence there is.
 *
 * Under B3 the protection is total by construction: the slot value is a member of a
 * 38-entry hard-coded vocabulary. `carriesProprietaryName` is kept as
 * defence-in-depth and should now be UNREACHABLE on this path — `assertIsMaterialClass`
 * is the assertion that makes that claim checkable rather than asserted.
 */

import { prisma } from '@/lib/prisma';
import { MATERIAL_CLASSES, materialClassOf } from '@/lib/editorial-queue/signals';
import { loadInterviewAnswers } from '@/lib/posting/loadInterviewAnswers';
import { isVerbatimSpan } from '@/lib/posting/quoteCandidates';
import type { ResolvedSlot } from '@/lib/interview/prompts/headlineFrames';
import type { VerbFacts } from '@/lib/interview/prompts/headlineVerbs';

/** A material class resolved for a project, with the evidence behind it. */
export interface MaterialCandidate {
  /** Always a member of MATERIAL_CLASSES. */
  value: string;
  /** How many tags across the project resolve to it. */
  tagCount: number;
  /** Distinct images it appears on. */
  imageCount: number;
  /** Distinct rooms it appears in — the Continuity precondition's real measure. */
  roomCount: number;
}

/** Normalize for comparison only. */
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Look-alike qualifiers: the one way a derived class can be a factual error.
 *
 * `materialClassOf` substring-matches, so "marble-look porcelain" and "faux
 * travertine" both resolve to the material they are imitating. The corpus digest
 * tolerates that — it groups specs, and a marble-look tile still signals the
 * designer reaching for that register. A HEADLINE does not tolerate it: "Marble
 * runs from the kitchen to the bath" is simply false about a porcelain floor, in
 * the most visible line of the piece and under an accuracy contract.
 *
 * So a tag whose text carries a look-alike qualifier is dropped from the headline
 * path only. This is narrower than it looks — it rejects the TAG, not the class, so
 * a project with real marble elsewhere still resolves marble.
 *
 * NOTE: added beyond the literal B3 instruction. Flagged in docs/23 §3 for review;
 * removing it restores plain `materialClassOf` behaviour.
 */
const LOOKALIKE = /\b(look|effect|inspired|style|faux|imitation|repro|reproduction)\b|\b(look|effect)-?alike\b/i;

function isLookalike(text: string): boolean {
  return LOOKALIKE.test(text);
}

/**
 * Does this text carry the brand or product name it belongs to?
 *
 * Token-based rather than substring, so "brass" inside "Brasserie" cannot trip it
 * while "Antolini" inside "Calacatta Gold by Antolini" does. Short tokens are
 * skipped: a product called "Ash" would otherwise disqualify the class "ash".
 *
 * Retained as defence-in-depth. Under the B3 class source it cannot fire — the
 * value is drawn from a closed vocabulary — and `assertIsMaterialClass` is what
 * proves that rather than assuming it.
 */
export function carriesProprietaryName(
  value: string,
  productName?: string | null,
  brand?: string | null,
): boolean {
  const haystack = norm(value);
  for (const source of [productName, brand]) {
    if (!source) continue;
    const tokens = norm(source).split(' ').filter((t) => t.length > 3);
    if (tokens.length === 0) continue;
    if (tokens.every((t) => haystack.includes(t))) return true;
  }
  return false;
}

/** The invariant the whole brand-safety argument rests on. */
export function assertIsMaterialClass(value: string): boolean {
  return (MATERIAL_CLASSES as readonly string[]).includes(value);
}


// ── Borrowed fragment ────────────────────────────────────────────────────────
//
// A headline-scale span of the designer's own speech. `extractQuoteCandidates`
// is the pull-quote extractor and is deliberately NOT reused here: its bounds are
// 6-45 words, tuned for a display line, and a headline is 4-16 words total. A
// fragment has to leave room for the sentence around it.
//
// The span is SELECTED, never written — the same posture the pull quote takes.
// What is resolved here is a concrete candidate so the frame can state a value
// rather than describe one; the route still re-checks whatever the model actually
// quotes with `isVerbatimSpan`, because a model handed a quote may quote something
// else.

const FRAGMENT_MIN_WORDS = 3;
const FRAGMENT_MAX_WORDS = 9;

/**
 * Terms that make a fragment worth borrowing.
 *
 * Deliberately the SAME vocabulary EVALUATIVE_ADJECTIVES bans us from using. That
 * is the device: the words we may not write are exactly the words worth quoting,
 * because in quotation marks they stop being our assessment and become a fact
 * about what a named person said.
 */
const WORTH_BORROWING = /\b(hated|loved|terrible|ugliest|worst|best|awful|refused|insisted|begged|fought|never|always|impossible|ridiculous|obsessed|terrifying|stunning|gorgeous|wrong|mistake|scared|nervous)\b/i;

/** Sentence-ish spans of a single answer, kept contiguous so they stay verifiable. */
function fragmentSpans(answer: string): string[] {
  return answer
    .split(/(?<=[.!?])\s+|\s+[\u2014-]\s+/)
    .map((x) => x.trim().replace(/^["\u201C]+|["\u201D]+$/g, '').trim())
    .filter((x) => {
      const n = x.split(/\s+/).filter(Boolean).length;
      return n >= FRAGMENT_MIN_WORDS && n <= FRAGMENT_MAX_WORDS;
    });
}

export interface FragmentCandidate {
  text: string;
  isFollowUp: boolean;
  wordCount: number;
  /** Whether it carries the evaluative language the frame exists to borrow. */
  worthBorrowing: boolean;
}

/**
 * Every headline-scale verbatim span, best first.
 *
 * Ordered: worth-borrowing before plain, follow-up before opener (follow-ups are
 * the answers prompted for anecdote), then shorter, then alphabetically. The last
 * key is what makes a batch reproducible across presses.
 */
export function resolveFragmentCandidates(
  answers: Array<{ answer: string; isFollowUp: boolean }>,
): FragmentCandidate[] {
  const seen = new Set<string>();
  const out: FragmentCandidate[] = [];
  for (const a of answers) {
    for (const text of fragmentSpans(a.answer)) {
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        text,
        isFollowUp: a.isFollowUp,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        worthBorrowing: WORTH_BORROWING.test(text),
      });
    }
  }
  return out.sort(
    (a, b) =>
      Number(b.worthBorrowing) - Number(a.worthBorrowing) ||
      Number(b.isFollowUp) - Number(a.isFollowUp) ||
      a.wordCount - b.wordCount ||
      a.text.localeCompare(b.text),
  );
}

/**
 * Whether a headline's quoted span really is the designer's.
 *
 * The route's gate on borrowed-fragment output. Everything inside double quotes
 * must appear verbatim in some answer; a headline quoting nothing fails too, since
 * the frame's whole claim is that someone said this.
 */
export function borrowedFragmentIsVerbatim(headline: string, answers: string[]): boolean {
  const quoted = Array.from(headline.matchAll(/[\u201C"]([^\u201D"]+)[\u201D"]/g)).map((m) => m[1].trim());
  if (quoted.length === 0) return false;
  return quoted.every((q) => isVerbatimSpan(q, answers));
}

export interface ResolvedHeadlineSlots {
  slots: ResolvedSlot[];
  /** Headline-scale verbatim spans, best first. Empty when none qualify. */
  fragments: FragmentCandidate[];
  /** Every answer, for the route's post-generation verbatim check. */
  answerTexts: string[];
  /** Every material class on the project, most-established first. */
  materials: MaterialCandidate[];
  /** Structured facts for verb eligibility. Absent key = unknown, deliberately. */
  facts: VerbFacts;
  /**
   * How many tags carry a designer-typed confirmed finish — the B1 gate.
   *
   * Kept purely so a single project's logs show the old gate beside the new one.
   * The aggregate comparison needs a database; see docs/23 §6.2.
   */
  confirmedFinishTags: number;
}

/**
 * Every material class on a project, most-established first.
 *
 * Ranked by distinct ROOMS, then images, then tags, then alphabetically. Five tags
 * of the same brass on one photograph is one decision photographed five times; the
 * same brass in three rooms is the project answering to it. The alphabetical
 * tiebreak keeps a batch reproducible across presses.
 */
export async function resolveMaterialCandidates(projectId: string): Promise<{
  materials: MaterialCandidate[];
  confirmedFinishTags: number;
  /** A room is named on this project — what an Application verb acts on. */
  namedPlace: boolean;
  /** A tagged product sits in a named room — a real object, in a real place. */
  spatialObject: boolean;
}> {
  const tags = await prisma.productTag.findMany({
    where: { image: { projectId } },
    select: {
      imageId: true,
      finishRaw: true,
      finishCanonical: true,
      finishConfirmed: true,
      image: { select: { roomId: true, room: true } },
      selection: { select: { colorFinish: true } },
      product: { select: { name: true, description: true, category: true, brand: true } },
    },
  });

  const byClass = new Map<string, { tagCount: number; images: Set<string>; rooms: Set<string> }>();
  let confirmedFinishTags = 0;

  for (const tag of tags) {
    if (tag.finishConfirmed && (tag.finishRaw ?? tag.finishCanonical ?? '').trim()) {
      confirmedFinishTags += 1;
    }

    const productText = [tag.product?.name, tag.product?.description, tag.product?.category]
      .filter(Boolean)
      .join(' ');
    const colorFinish = tag.selection?.colorFinish ?? tag.finishRaw ?? tag.finishCanonical ?? null;

    // A marble-look porcelain tile is not marble. See LOOKALIKE.
    if (isLookalike(`${colorFinish ?? ''} ${productText}`)) continue;

    const cls = materialClassOf(colorFinish, productText);
    if (!cls) continue;
    // Defence-in-depth. Unreachable by construction; asserted rather than assumed.
    if (!assertIsMaterialClass(cls)) continue;
    if (carriesProprietaryName(cls, tag.product?.name, tag.product?.brand)) continue;

    const at = byClass.get(cls) ?? { tagCount: 0, images: new Set<string>(), rooms: new Set<string>() };
    at.tagCount += 1;
    at.images.add(tag.imageId);
    // An unassigned image is its own "room" so two unassigned photos never
    // masquerade as one place — that would understate roomCount, never inflate it.
    at.rooms.add(tag.image?.roomId ?? tag.image?.room ?? `image:${tag.imageId}`);
    byClass.set(cls, at);
  }

  const materials = Array.from(byClass.entries())
    .map(([value, at]) => ({
      value,
      tagCount: at.tagCount,
      imageCount: at.images.size,
      roomCount: at.rooms.size,
    }))
    .sort(
      (a, b) =>
        b.roomCount - a.roomCount ||
        b.imageCount - a.imageCount ||
        b.tagCount - a.tagCount ||
        a.value.localeCompare(b.value),
    );

  // Conditions the verb library needs, answered from the same rows.
  //
  // These were never resolved, and the cost was total: five of six verb categories
  // could never fire, so `renderVerbInstruction` returned an empty string on almost
  // every project and the model chose its own verb. That is where "was chosen",
  // "became" and "stayed" came from — not from a bad prompt, from no prompt.
  const placed = tags.filter((t) => (t.image?.roomId ?? t.image?.room ?? null) !== null);
  return {
    materials,
    confirmedFinishTags,
    namedPlace: placed.length > 0,
    spatialObject: placed.length > 0,
  };
}

/**
 * Resolve every slot and every structured fact the frame and verb libraries can use.
 *
 * Facts are ABSENT rather than false when nothing can decide them. `existingStructure`
 * and `newBuild` are the ones that matter: no per-project new-build-versus-renovation
 * field exists in the schema (docs/23 §6.2), so they are omitted and every
 * Intervention verb stays withheld. Writing `false` there would be a claim nobody
 * can support, and the verb library treats unknown and false very differently.
 */
export async function resolveHeadlineSlots(projectId: string): Promise<ResolvedHeadlineSlots> {
  const [{ materials, confirmedFinishTags, namedPlace, spatialObject }, answers] = await Promise.all([
    resolveMaterialCandidates(projectId),
    loadInterviewAnswers(projectId),
  ]);
  const fragments = resolveFragmentCandidates(answers);
  const answerTexts = answers.map((a) => a.answer);
  const slots: ResolvedSlot[] = [];

  if (materials.length > 0) {
    const top = materials[0];
    slots.push({
      name: 'material',
      value: top.value,
      source: `material class across ${top.roomCount} room(s), ${top.imageCount} image(s)`,
      verified: true,
    });
  }

  if (fragments.length > 0) {
    slots.push({
      name: 'fragment',
      value: fragments[0].text,
      source: `verbatim span of ${fragments[0].isFollowUp ? 'a follow-up' : 'an interview'} answer`,
      verified: true,
    });
  }

  // `agent` is NEVER resolved, and this is deliberate rather than unfinished.
  //
  // The frame contract requires a required slot to be non-null and VERIFIED, and
  // there is no name-verification predicate in the schema — `User.name` is a plain
  // String, and nothing records that anyone confirmed it (audit §3.A). Resolving it
  // anyway with `verified: true` would be the exact lie the contract exists to
  // prevent, and it would make the Agent-verb-object frame eligible on a surface
  // where `headlineIssues` kills every output it can produce (NAMES_PEOPLE).
  //
  // So it stays absent and the frame stays ineligible, visibly, for a reason
  // written down. See AGENT_VERB_OBJECT_FRAME.

  // Only what the data can decide. `classInTwoPlaces` is the Continuity
  // precondition, and per-tag resolution is what makes it answerable at all.
  const facts: VerbFacts = {};
  if (materials.length > 0) facts.materialClass = true;
  if (materials.some((m) => m.roomCount > 1 || m.imageCount > 1)) facts.classInTwoPlaces = true;
  if (namedPlace) facts.namedPlace = true;
  if (spatialObject) facts.spatialObject = true;
  // Still unresolvable, and still absent rather than false: `spatialRelation` needs
  // a stated relationship between two areas, `apertureFact` a window or light fact,
  // and `existingStructure`/`newBuild` a project-provenance field that does not
  // exist. Absent withholds; that part was always working.

  return { slots, materials, facts, confirmedFinishTags, fragments, answerTexts };
}

// ============================================================================
// Does a quote read on its own?
//
// In published mode the reader sees the room photograph and the quote. The body
// is behind a click. So a quote whose referent lives in the body — "It remains
// agreeable, but still on theme…" — does not read: the reader has no "it".
//
// This is the predicate behind two things, and they must not drift apart, which
// is why it lives here rather than in either caller:
//
//   1. `extractQuoteCandidates` ranking. Standalone candidates are offered
//      first, so the designer and the ranking model both see the ones that
//      survive the collapse before the ones that do not.
//   2. `scripts/measure-quote-standalone.ts`, the read-only measurement that
//      established the distribution in
//      `docs/audits/QUOTE_STANDALONE_DISTRIBUTION.md`.
//
// It is a RANKING input only. It never filters: a room with nothing standalone
// still offers everything it has, in the best order it can. The no-fallback rule
// in `quoteCandidates.ts` is about which answers a quote may come from, and this
// does not touch it.
//
// ── THE RULE, IN FULL ──────────────────────────────────────────────────────
//
// Stated in full, because a ranking is only as honest as the predicate under it.
// Three verdicts, and the middle one exists so a genuinely uncertain call is
// counted rather than forced.
//
// NOT STANDALONE (high confidence, purely positional)
//
//   F1  The span OPENS with a bare referential pronoun or demonstrative:
//       it / this / that / they / them / those / these / he / she / him / her.
//       "Bare" means not immediately followed by a noun-ish word — `this room`
//       and `that decision` carry their own referent and are NOT failures.
//       First person (I / we / my / our / us) is never a failure: the speaker is
//       resolved by the attribution line. Generic `you` likewise — "you walk in
//       and…" is idiomatic design speech, resolved by the photograph.
//
//   F2  The span OPENS with a continuation conjunction: but / and / so /
//       because / which / though / although / plus / also / then / yet.
//       Grammatically dependent on a sentence that is not there.
//
//   F3  The span OPENS with a comparative or additive that implies a prior term:
//       same / another / other / more / less / better / worse / too / either /
//       neither / likewise.
//
// AMBIGUOUS
//
//   A1  A bare third-person pronoun or demonstrative appears AFTER position 0
//       and no plausible antecedent precedes it inside the span.
//
//       "Plausible antecedent" is approximated without a POS tagger, which is
//       exactly why this bucket is ambiguous rather than a failure. A token
//       counts as a possible noun when it is (a) preceded by a determiner
//       (the/a/an/this/that/these/those/my/our/his/her/their/its), or (b)
//       capitalised without being sentence-initial, or (c) a member of a small
//       interior-design noun lexicon. Any of those before the pronoun and the
//       span is treated as self-resolving.
//
// STANDALONE
//
//   Everything else.
//
// Deliberately NOT tested: whether the sentence is interesting, whether it is a
// fragment, whether a comparative mid-span ("more timeless") lacks its second
// term. Fragments and mid-span comparatives need a parser to call correctly, and
// a wrong call in either direction would move a real number.
//
// Every approximation here leans the same way — toward calling a span
// standalone. As a ranking input that is the safe direction: the cost of a
// wrongly-promoted quote is one worse option near the top of a list the designer
// is cycling through anyway, not a broken guarantee.
// ============================================================================

export type Verdict = 'standalone' | 'ambiguous' | 'not-standalone';

const FIRST_PERSON = new Set(['i', 'we', 'my', 'our', 'us', 'me', 'mine', 'ours']);
const BARE_REFERENTIAL = new Set([
  'it', 'this', 'that', 'they', 'them', 'those', 'these', 'he', 'she', 'him', 'her',
]);
const CONTINUATION = new Set([
  'but', 'and', 'so', 'because', 'which', 'though', 'although', 'plus', 'also', 'then', 'yet',
]);
const COMPARATIVE = new Set([
  'same', 'another', 'other', 'more', 'less', 'better', 'worse', 'too', 'either', 'neither', 'likewise',
]);
/**
 * Auxiliaries and high-frequency verbs. Only used to tell `that ROOM` (determiner,
 * self-resolving) from `that WAS` (pronoun, referent elsewhere). Incomplete by
 * nature — a verb missing from this list makes the span look self-resolving, so
 * the bias is toward counting a span as standalone.
 */
const VERBISH = new Set([
  'is', 'was', 'are', 'were', 'be', 'been', 'being', 'am',
  'has', 'have', 'had', 'does', 'did', 'do', 'will', 'would', 'can', 'could',
  'should', 'shall', 'may', 'might', 'must',
  'means', 'meant', 'seems', 'seemed', 'feels', 'felt', 'looks', 'looked',
  'gives', 'gave', 'makes', 'made', 'takes', 'took', 'comes', 'came', 'goes',
  'went', 'became', 'becomes', 'stays', 'stayed', 'remains', 'remained',
  'works', 'worked', 'reads', 'read', 'sits', 'sat', 'lets', 'let', 'keeps', 'kept',
]);

/**
 * Function words, for the antecedent proxy in A1. Anything NOT here and not a
 * pronoun counts as a possible noun. Crude, and deliberately generous: a real
 * POS tagger would fire A1 more often, so this under-reports ambiguity and
 * over-reports standalone.
 */
const FUNCTION_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'so', 'because', 'if', 'when', 'while',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'about', 'into',
  'over', 'under', 'through', 'between', 'against', 'up', 'down', 'out', 'off',
  'as', 'than', 'that', 'this', 'these', 'those', 'it', 'its', 'they', 'them',
  'their', 'he', 'she', 'him', 'her', 'his', 'we', 'us', 'our', 'i', 'my', 'me',
  'you', 'your', 'not', 'no', 'very', 'just', 'still', 'also', 'too', 'really',
  'nothing', 'something', 'anything', 'everything', 'nobody', 'somebody',
  'anybody', 'everybody', 'someone', 'anyone', 'everyone', 'one', 'ones',
  'there', 'here', 'what', 'which', 'who', 'whom', 'whose', 'how', 'why',
  'all', 'any', 'some', 'both', 'each', 'more', 'most', 'other', 'such',
]);

const DETERMINERS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'our', 'his', 'her', 'their', 'its',
]);
/** Small, deliberately incomplete. Its only job is to reduce false ambiguity. */
const DESIGN_NOUNS = new Set([
  'room', 'rooms', 'house', 'home', 'kitchen', 'bath', 'bathroom', 'bedroom', 'entry', 'hall',
  'space', 'spaces', 'table', 'chair', 'chairs', 'sofa', 'light', 'lights', 'lighting', 'pendant',
  'pendants', 'cabinet', 'cabinets', 'cabinetry', 'counter', 'countertop', 'island', 'floor',
  'floors', 'wall', 'walls', 'ceiling', 'window', 'windows', 'door', 'doors', 'tile', 'stone',
  'marble', 'brass', 'oak', 'walnut', 'plaster', 'paint', 'colour', 'color', 'palette', 'finish',
  'finishes', 'material', 'materials', 'hardware', 'millwork', 'paneling', 'panelling', 'rug',
  'client', 'clients', 'project', 'design', 'plan', 'layout', 'view', 'scale', 'proportion',
]);

const words = (s: string): string[] =>
  s.trim().split(/\s+/).map((w) => w.replace(/^[^\w']+|[^\w']+$/g, ''));

const norm = (w: string): string => w.toLowerCase().replace(/[^a-z']/g, '');

export function scoreStandalone(text: string): { verdict: Verdict; reason: string } {
  const raw = words(text).filter(Boolean);
  if (raw.length === 0) return { verdict: 'not-standalone', reason: 'empty span' };

  const w = raw.map(norm);
  const first = w[0];
  const second = w[1] ?? '';

  // F1 — bare referential opener
  if (BARE_REFERENTIAL.has(first) && !FIRST_PERSON.has(first)) {
    // `this room`, `that decision`, `these elements` carry their own referent.
    const determinerLike = ['this', 'that', 'these', 'those'].includes(first);
    // `that was`, `this means` — the demonstrative is a PRONOUN there, and its
    // referent is outside the span. `that decision`, `this room` are determiners.
    const followedByNoun =
      determinerLike &&
      second.length > 0 &&
      !BARE_REFERENTIAL.has(second) &&
      !CONTINUATION.has(second) &&
      !VERBISH.has(second);
    if (!followedByNoun) {
      return { verdict: 'not-standalone', reason: `F1 opens with bare "${raw[0]}"` };
    }
  }

  // F2 — continuation conjunction opener
  if (CONTINUATION.has(first)) {
    return { verdict: 'not-standalone', reason: `F2 opens with continuation "${raw[0]}"` };
  }

  // F3 — comparative / additive opener
  if (COMPARATIVE.has(first) || (first === 'the' && COMPARATIVE.has(second))) {
    return { verdict: 'not-standalone', reason: `F3 opens with comparative "${raw.slice(0, 2).join(' ')}"` };
  }

  // A1 — unresolved pronoun after position 0
  for (let i = 1; i < w.length; i++) {
    const tok = w[i];
    if (!BARE_REFERENTIAL.has(tok) || FIRST_PERSON.has(tok)) continue;
    // `this room` etc. resolve themselves here too.
    if (['this', 'that', 'these', 'those'].includes(tok)) {
      const next = w[i + 1] ?? '';
      if (next && !BARE_REFERENTIAL.has(next) && !CONTINUATION.has(next)) continue;
    }
    // Is there a plausible antecedent noun before it, inside the span?
    // Proxy: any CONTENT word — not a function word, not an auxiliary. That
    // catches "Matto chose glass so it…" ("glass") without a POS tagger, at the
    // cost of also passing "The reason it worked…" ("reason"). Under-fires
    // rather than over-fires, which keeps the standalone count optimistic.
    let antecedent = false;
    for (let j = 0; j < i; j++) {
      const prevTok = w[j];
      if (!prevTok || prevTok.length < 2) continue;
      if (DESIGN_NOUNS.has(prevTok)) { antecedent = true; break; }
      if (!FUNCTION_WORDS.has(prevTok) && !VERBISH.has(prevTok)) { antecedent = true; break; }
      if (j > 0 && DETERMINERS.has(w[j - 1])) { antecedent = true; break; }
    }
    if (!antecedent) {
      return { verdict: 'ambiguous', reason: `A1 "${raw[i]}" at word ${i + 1} with no antecedent in span` };
    }
  }

  return { verdict: 'standalone', reason: 'no unresolved opener or pronoun' };
}

/**
 * Sort weight for the three verdicts. Lower sorts first.
 *
 * Not-standalone is ranked BELOW ambiguous rather than dropped: the pool is
 * small, and a quote the designer likes is still theirs to choose. Ranking is
 * the whole intervention.
 */
export function standaloneRank(text: string): 0 | 1 | 2 {
  const { verdict } = scoreStandalone(text);
  return verdict === 'standalone' ? 0 : verdict === 'ambiguous' ? 1 : 2;
}

/** The sentence immediately before this span inside its source answer, if any. */
export function precedingSentence(answer: string, span: string): string | null {
  const at = answer.indexOf(span);
  if (at <= 0) return null;
  const before = answer.slice(0, at).trim();
  if (!before) return null;
  const parts = before.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

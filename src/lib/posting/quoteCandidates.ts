// ============================================================================
// Pull quotes: selection, never authorship.
//
// The failure this replaces: pull quotes were mined out of the GENERATED
// ARTICLE with a regex. So if the model paraphrased the designer while writing
// the prose, the extractor faithfully lifted the paraphrase — verbatim to the
// body, but not to the person. That is how "elements on tension" (what the
// designer said) shipped as "elements in tension" (what the model wrote).
//
// The fix is structural, not a better prompt. Candidates are cut from the
// designer's OWN interview answers by code, so every one is verbatim by
// construction. A model then ranks them and returns an ID — never text. We look
// the ID up in our own array. A model that can only choose from a list cannot
// invent a quote; it is not discouraged from inventing, it is unable to.
//
// Two rules that keep the guarantee real:
//
//   1. CONTIGUOUS ONLY. Every candidate is a single unbroken slice of one
//      answer, produced by index into the original string. Splicing across two
//      answers with an ellipsis cannot be substring-verified, so it is not
//      offered — a quote we cannot check is a quote we cannot trust.
//   2. NO FALLBACK POOL. If a room's own answers yield nothing quotable, that
//      room gets no pull quote. Borrowing a project-level line would put words
//      under a heading they were not said about. Since follow-up questions are
//      specifically prompted to produce quotable material, an empty pool is a
//      real signal that the follow-up for that room did not land — worth
//      surfacing and fixing upstream, not papering over.
// ============================================================================

import { standaloneRank } from './quoteStandalone';

/** A verbatim, contiguous slice of one interview answer. */
export interface QuoteCandidate {
  /** Stable within one generation. What the ranking model returns. */
  id: string;
  /** The exact substring. Never edited, never re-cased, never re-punctuated. */
  text: string;
  /** Index into the answers array this was cut from, for verification. */
  answerIndex: number;
  /**
   * Follow-up answers are prompted for quote-worthy content, so they are the
   * intended source and are offered to the ranker first.
   */
  isFollowUp: boolean;
  wordCount: number;
}

export interface AnswerLike {
  section?: string;
  answer: string;
  isFollowUp?: boolean;
}

/**
 * A quote should be long enough to carry a thought and short enough to set as a
 * display line. Below the floor it is a fragment; above the ceiling it is a
 * paragraph the layout cannot hold.
 */
const MIN_WORDS = 6;
const MAX_WORDS = 45;

/** Sentence-ish boundaries. Returns [start, end) index pairs into the source. */
function sentenceSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c !== '.' && c !== '!' && c !== '?') continue;
    // Consume any run of terminators plus a closing quote/bracket.
    let end = i + 1;
    while (end < text.length && '.!?"”\')]'.includes(text[end])) end++;
    // A boundary only counts if whitespace or end-of-string follows.
    if (end < text.length && !/\s/.test(text[end])) continue;
    if (text.slice(start, end).trim()) spans.push([start, end]);
    while (end < text.length && /\s/.test(text[end])) end++;
    start = end;
    i = end - 1;
  }
  if (start < text.length && text.slice(start).trim()) spans.push([start, text.length]);
  return spans;
}

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Cut every contiguous candidate from one room's answers.
 *
 * Single sentences and adjacent PAIRS — a pair is still one unbroken slice, so
 * it stays verifiable, and a lot of the designer's best material is a claim
 * followed by its reason.
 */
export function extractQuoteCandidates(
  answers: AnswerLike[],
  roomName: string,
): QuoteCandidate[] {
  const out: QuoteCandidate[] = [];
  const seen = new Set<string>();

  answers.forEach((a, answerIndex) => {
    if ((a.section ?? '') !== roomName) return;
    const source = a.answer ?? '';
    if (!source.trim()) return;

    const spans = sentenceSpans(source);
    const push = (from: number, to: number) => {
      const text = source.slice(from, to).trim();
      const n = words(text);
      if (n < MIN_WORDS || n > MAX_WORDS) return;
      // A candidate that is only a question is the interviewer's voice, not theirs.
      if (/^[^.!?]*\?$/.test(text)) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        id: `q${out.length + 1}`,
        text,
        answerIndex,
        isFollowUp: !!a.isFollowUp,
        wordCount: n,
      });
    };

    for (let i = 0; i < spans.length; i++) {
      push(spans[i][0], spans[i][1]);
      if (i + 1 < spans.length) push(spans[i][0], spans[i + 1][1]);
    }
  });

  // Ranking, in priority order. Ranking ONLY — nothing is dropped here, and the
  // contract with the model is untouched: it still receives numbered candidates
  // and still returns an id.
  //
  //   1. SELF-SUFFICIENCY. In published mode the reader sees the room photo and
  //      the quote; the body is behind a click. A quote whose referent is in the
  //      hidden body does not read, so it sorts last however good it is. This
  //      outranks the follow-up tier because it is a question of whether the
  //      quote WORKS in the surface it is going into, not of how likely it is to
  //      be interesting.
  //   2. FOLLOW-UPS. They are the ones written to be quotable.
  //   3. LENGTH. Within a tier, mid-length reads best as a display line.
  const ideal = 18;
  const rank = new Map(out.map(c => [c.id, standaloneRank(c.text)]));
  return out.sort((x, y) => {
    const r = rank.get(x.id)! - rank.get(y.id)!;
    if (r !== 0) return r;
    if (x.isFollowUp !== y.isFollowUp) return x.isFollowUp ? -1 : 1;
    return Math.abs(x.wordCount - ideal) - Math.abs(y.wordCount - ideal);
  });
}

/**
 * Normalize only what RENDERING can legitimately change: whitespace runs, quote
 * and dash glyphs, and letter case. Wording and punctuation are left alone,
 * because those are exactly the alterations this exists to catch.
 *
 * Case is forgiven because trimming a quote to start mid-sentence properly
 * capitalizes its first letter — that is typesetting, not rewording, and it
 * would otherwise fail every legitimately shortened quote. Swapping a word
 * still fails, which is the property that matters.
 */
export function normalizeForVerbatimCheck(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** True when `text` appears verbatim inside any of `sources`. */
export function isVerbatimSpan(text: string, sources: string[]): boolean {
  const needle = normalizeForVerbatimCheck(text);
  if (!needle) return false;
  return sources.some(src => normalizeForVerbatimCheck(src).includes(needle));
}

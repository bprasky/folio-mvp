// ============================================================================
// Re-verify a stored pull quote against the answer it points at.
//
// `isVerbatimSpan` proves a string existed in the answers AT SELECTION TIME. It
// records nothing, so a quote verified during generation cannot be re-checked
// later — after a regenerate, after the naming gate rewrites a section, at
// render. This closes that loop: the stored pointer names one answer, and the
// quote is re-checked against THAT ANSWER ALONE.
//
// Against one answer, never joined text. Concatenating the interview and asking
// whether the quote appears somewhere in it would pass a span spliced across two
// answers — exactly the thing the contiguous-only rule exists to forbid — and
// would also pass a quote that has drifted to a different room's answer.
//
// REPORTS ONLY. Nothing here throws, blocks a render, or edits a quote. A
// missing pointer is `unverifiable`, which is a statement about our records, not
// about the designer's words: every quote selected before the pointer existed is
// still a verbatim span, we simply cannot re-derive which answer it came from.
// Treating those as failures would bury the real ones.
// ============================================================================

import { normalizeForVerbatimCheck } from './quoteCandidates';
import type { PullQuoteSelection, QuoteProvenance } from './schemas';

export type ProvenanceVerdict =
  /** Pointer present, answer found, quote is a verbatim span of it. */
  | 'verified'
  /** No pointer stored. Pre-provenance rows. Not a failure. */
  | 'unverifiable'
  /** Pointer present but no answer carries that row key any more. */
  | 'answer-missing'
  /** Answer found, but the quote is not a span of it. The real alarm. */
  | 'mismatch'
  /** More than one answer carries the row key, so "the" answer is undefined. */
  | 'ambiguous';

export interface ProvenanceCheck {
  verdict: ProvenanceVerdict;
  /** 'selected' or the alternative's index, so a report can name the offender. */
  slot: string;
  text: string;
  provenance: QuoteProvenance | null;
  detail: string;
}

/** Only the fields the check needs, so callers are not forced to a concrete type. */
export interface VerifiableAnswer {
  questionId?: string | null;
  isFollowUp?: boolean;
  answer: string;
}

/**
 * Check one quote against the answers.
 *
 * Exported because the per-quote verdict is the useful unit: a caller reporting
 * on a whole article and a caller checking a single tile want the same rule.
 */
export function verifyQuoteAgainstAnswers(
  text: string,
  provenance: QuoteProvenance | null | undefined,
  answers: VerifiableAnswer[],
  slot: string,
): ProvenanceCheck {
  const base = { slot, text, provenance: provenance ?? null };

  if (!provenance?.questionId) {
    return { ...base, verdict: 'unverifiable', detail: 'no provenance pointer stored' };
  }

  const matches = answers.filter(
    (a) => a.questionId === provenance.questionId && !!a.isFollowUp === !!provenance.isFollowUp,
  );

  if (matches.length === 0) {
    return {
      ...base,
      verdict: 'answer-missing',
      detail: `no answer for (${provenance.questionId}, isFollowUp=${provenance.isFollowUp})`,
    };
  }
  if (matches.length > 1) {
    // Only reachable while duplicates exist for a row key — which is what
    // 20260904193000_add_row_key_unique makes impossible. Reported rather than
    // resolved: picking one would invent a fact.
    return {
      ...base,
      verdict: 'ambiguous',
      detail: `${matches.length} answers share (${provenance.questionId}, isFollowUp=${provenance.isFollowUp})`,
    };
  }

  const needle = normalizeForVerbatimCheck(text);
  const hay = normalizeForVerbatimCheck(matches[0].answer);
  return needle && hay.includes(needle)
    ? { ...base, verdict: 'verified', detail: 'verbatim span of the answer it points at' }
    : { ...base, verdict: 'mismatch', detail: 'not a span of the answer it points at' };
}

/** Every quote a chapter's pull quote holds — the selection AND its alternatives. */
export function verifyPullQuoteProvenance(
  pullQuote: PullQuoteSelection | null | undefined,
  answers: VerifiableAnswer[],
): ProvenanceCheck[] {
  if (!pullQuote) return [];
  const out: ProvenanceCheck[] = [];
  if (pullQuote.selected) {
    out.push(
      verifyQuoteAgainstAnswers(
        pullQuote.selected.text,
        pullQuote.selected.provenance,
        answers,
        'selected',
      ),
    );
  }
  // Alternatives are checked too, because any of them can become the published
  // quote the moment the designer cycles the picker. A pointer that is only
  // sound for the current selection is sound until the next click.
  (pullQuote.alternatives ?? []).forEach((alt, i) => {
    out.push(verifyQuoteAgainstAnswers(alt.text, alt.provenance, answers, `alt[${i}]`));
  });
  return out;
}

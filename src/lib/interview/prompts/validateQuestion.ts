/**
 * The single interview-question gate — net-new (docs/17_INTERVIEW_PROMPT_CANON.md §3).
 *
 * NOTE: this is NOT the old `validateAIQuestion` keyword ban (that gate is dead code and
 * is deleted with the template path in Phase 4). Per §3 the policy is "rejection in
 * service of the arrival": a contrast question is fine when it resolves to the choice
 * that was made, and BARRED only when it dwells on grievance/regret/loss.
 *
 * Deliberately NOT barred (legitimate as decision rationale): "compromise", "cut",
 * "lost". The old gate rejected these outright; §3 explicitly reverses that.
 */

export interface QuestionValidation {
  ok: boolean;
  /** Human-readable label of the barred intent that tripped the gate, if any. */
  violation?: string;
}

/**
 * Barred intents: regret / failure-dwelling / grievance aimed at the outcome, the client,
 * or a collaborator. Ordered most-specific first so the reported violation is meaningful.
 */
const BARRED_PATTERNS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\bregret(s|ted|ting)?\b/i, label: "regret" },
  { re: /\bwish(ed)?\s+(you|i|we|they|he|she|it)\s+had\b/i, label: "wish … had" },
  { re: /\bwent\s+(wrong|badly|sideways)\b/i, label: "went wrong" },
  { re: /\bwould\s+you\s+(have\s+)?(change|changed|do|done)\b/i, label: "would you change / do" },
  { re: /\bdo(ne)?\s+(anything\s+)?differently\b/i, label: "do differently" },
  { re: /\bsettl(e|ed|ing)\s+for\b/i, label: "settled for" },
  { re: /\b(give|gave|given|giving)\s+up\b/i, label: "give up" },
  { re: /\bsacrifice[sd]?\b/i, label: "sacrifice" },
  { re: /\bbiggest\s+mistake\b/i, label: "biggest mistake" },
  { re: /\bfailure[s]?\b/i, label: "failure" },
  { re: /\bfailed\b/i, label: "failed" },
  { re: /\bworst\b/i, label: "worst" },
  { re: /\bdisappoint(ed|ing|ment)?\b/i, label: "disappointment" },
  { re: /\bfrustrat(e|ed|ing|ion)\b/i, label: "frustration" },
];

/**
 * Validate a single interview question against the §3 arrivals/contrast policy.
 * Returns `{ ok: true }` for arrival-safe questions (including contrast questions that
 * resolve to a decision), and `{ ok: false, violation }` for grievance/regret framing.
 */
export function validateInterviewQuestion(question: string): QuestionValidation {
  const text = (question ?? "").trim();
  if (!text) return { ok: false, violation: "empty" };

  for (const { re, label } of BARRED_PATTERNS) {
    if (re.test(text)) return { ok: false, violation: label };
  }
  return { ok: true };
}

/** Convenience boolean wrapper for `.filter(...)` call sites. */
export function isArrivalSafe(question: string): boolean {
  return validateInterviewQuestion(question).ok;
}

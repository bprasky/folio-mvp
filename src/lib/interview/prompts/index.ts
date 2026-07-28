/**
 * Canonical interview/editorial prompt module — the single source of truth every
 * generator composes from. See docs/17_INTERVIEW_PROMPT_CANON.md §6.
 *
 * No question or editorial generator may declare its own persona, tone rules, or
 * banned-phrase list — import from here instead.
 */
export { FOLIO_INTERVIEWER_PERSONA } from "./persona";
export {
  SHARED_RULE_BLOCK,
  ARRIVALS_CONTRAST_POLICY,
  ELICITATION_TECHNIQUES,
  INTERVIEW_RULES,
} from "./rules";
export {
  validateInterviewQuestion,
  isArrivalSafe,
  type QuestionValidation,
} from "./validateQuestion";
export {
  FOLIO_TONE,
  EDITORIAL_BANNED_PHRASES,
  EDITORIAL_ACCURACY_RULES,
} from "./editorialTone";
export { ROLE_DELTAS, DESIGNER, ARCHITECT, CONTRACTOR, VENDOR, type RoleDelta } from "./roles";

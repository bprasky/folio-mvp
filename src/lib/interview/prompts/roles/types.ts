/**
 * A role delta: ONLY what differs for a role. No role file declares a persona or rule
 * set — those come from ../persona and ../rules. Canon: docs/17_INTERVIEW_PROMPT_CANON.md
 * §6 (roles/*) and §7 (canonical role terms).
 */
export interface RoleDelta {
  /** Canonical role term (docs/17 §7). */
  role: string;
  /** This role's relationship to the project. */
  relationship: string;
  /** What this role is asked about. */
  focus: string;
  /** Cross-role guard — what NOT to ask this role. */
  avoid: string;
}

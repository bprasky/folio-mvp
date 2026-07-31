// ============================================================================
// The AI failure taxonomy.
//
// Every AI failure gets a stable code, and every code answers one question that
// nothing in this codebase answered before: WOULD AN IDENTICAL RETRY WORK?
//
// That question is the whole point. The La Gorce editorial failure
// (generate_71e2451a999f) reproduced at temperature 0.7 and again at 0.3 — the
// same sentence, twice. It was never going to succeed on a third attempt. But
// the message the designer saw was "Try regenerating." So the copy invited a
// retry that could only burn another two-minute call and fail identically, and
// nothing recorded that it had happened.
//
// Hence the split. A `retryable: false` code is a dead end: the UI must not
// offer a retry button, and the failure needs a human, not another API call. A
// `retryable: true` code is worth another go and needs nobody's attention until
// it repeats.
//
// Guiding constraint, from the founder: cost work must never degrade the
// experience. Nothing here rate-limits a working request. The only calls
// suppressed are ones that already failed in a way that will fail again — which
// is strictly cheaper AND a better experience than letting someone click
// regenerate five times into the same wall.
// ============================================================================

export type AiErrorCode =
  // --- Transient: the same request may well succeed next time -------------
  | 'LLM_RATE_LIMITED'
  | 'LLM_OVERLOADED'
  | 'LLM_TIMEOUT'
  | 'LLM_CALL_FAILED'
  // --- Deterministic: an identical retry reproduces the failure -----------
  | 'LLM_JSON_PARSE'
  | 'LLM_TRUNCATED'
  | 'LLM_EMPTY_RESPONSE'
  | 'LLM_REPAIR_FAILED'
  | 'LLM_CONTENT_REFUSED'
  | 'LLM_QUOTE_UNVERIFIED'
  // --- Ours, not the model's: broken config. Never the designer's problem -
  | 'LLM_DISABLED'
  | 'LLM_AUTH_FAILED';

export interface AiErrorSpec {
  /** HTTP status the route should return. */
  status: number;
  /**
   * Would an identical retry plausibly succeed?
   *
   * The UI keys the retry affordance off this. When false, REMOVE the retry
   * control rather than disabling it — the designer should read "handled", not
   * "denied". Nothing they can do differently changes the outcome.
   */
  retryable: boolean;
  /**
   * What the designer sees. For a non-retryable code this must not contain the
   * words "try again" in any form; that copy is what pays for the wasted calls.
   */
  userMessage: string;
  /** Does a human need to look at this, rather than just watch the metric? */
  needsReview: boolean;
  /**
   * How long an identical (projectId, operation) call stays suppressed after
   * this code. Per-project by design — a dead end on one project must never
   * block a designer's work on another.
   *
   * Policy only. Enforcement needs durable storage: the in-memory limiter in
   * lib/rateLimit.ts is per-instance and a user simply lands elsewhere on
   * Vercel. Wire this to the incident table when it lands.
   */
  cooldownMs: number;
}

const MINUTE = 60_000;

export const AI_ERRORS: Record<AiErrorCode, AiErrorSpec> = {
  // --- Transient ----------------------------------------------------------
  LLM_RATE_LIMITED: {
    status: 429,
    retryable: true,
    userMessage: 'The AI service is busy. This will retry on its own in a moment.',
    needsReview: false,
    cooldownMs: 0,
  },
  LLM_OVERLOADED: {
    status: 503,
    retryable: true,
    userMessage: 'The AI service is at capacity right now. Give it a minute and try again.',
    needsReview: false,
    cooldownMs: 0,
  },
  LLM_TIMEOUT: {
    status: 504,
    retryable: true,
    userMessage: 'That took longer than expected and timed out. Worth another try.',
    needsReview: false,
    cooldownMs: 0,
  },
  LLM_CALL_FAILED: {
    status: 502,
    retryable: true,
    userMessage: 'The AI service did not respond. Try again in a moment.',
    needsReview: false,
    cooldownMs: 0,
  },

  // --- Deterministic ------------------------------------------------------
  // Every message below is written to CLOSE the loop, not open it. These
  // reproduced once already; a retry buys the designer nothing and costs a call.
  LLM_JSON_PARSE: {
    status: 502,
    retryable: false,
    userMessage:
      'Something went wrong assembling this article and it needs a look from our side. ' +
      'It has been logged — no need to run it again.',
    needsReview: true,
    cooldownMs: 10 * MINUTE,
  },
  LLM_TRUNCATED: {
    // Deterministic because the ceiling is ours: the same project against the
    // same cap truncates at the same place. Fixing it is a config change here,
    // never something the designer can do by pressing a button again.
    status: 502,
    retryable: false,
    userMessage:
      'This project needs more room than the current limit allows. It has been logged and ' +
      'needs a settings change on our side — running it again would stop at the same point.',
    needsReview: true,
    cooldownMs: 10 * MINUTE,
  },
  LLM_EMPTY_RESPONSE: {
    status: 502,
    retryable: false,
    userMessage:
      'The article came back empty, which points at something on our side. ' +
      'It has been logged — no need to run it again.',
    needsReview: true,
    cooldownMs: 10 * MINUTE,
  },
  LLM_REPAIR_FAILED: {
    status: 502,
    retryable: false,
    userMessage:
      'The draft came back in a shape we could not use. It has been logged — no need to run it again.',
    needsReview: true,
    cooldownMs: 10 * MINUTE,
  },
  LLM_QUOTE_UNVERIFIED: {
    // The ranking model returned a quote id that did not resolve, or text that
    // is not a verbatim span of the answer it claims to come from. We fell back
    // to a code-ranked candidate, so nothing unverified shipped — but it means
    // the selection contract is drifting and wants a look.
    status: 502,
    retryable: false,
    userMessage:
      'One of the designer quotes could not be verified against the interview, so it was left out. ' +
      'It has been logged — no need to run it again.',
    needsReview: true,
    cooldownMs: 10 * MINUTE,
  },
  LLM_CONTENT_REFUSED: {
    status: 422,
    retryable: false,
    userMessage:
      'The AI declined to write about part of this project. It has been logged for review.',
    needsReview: true,
    cooldownMs: 10 * MINUTE,
  },

  // --- Our configuration --------------------------------------------------
  LLM_DISABLED: {
    status: 503,
    retryable: false,
    userMessage: 'AI generation is currently switched off. This is on our side, not yours.',
    needsReview: true,
    cooldownMs: 0,
  },
  LLM_AUTH_FAILED: {
    // The designer cannot fix a bad API key, and every retry is a wasted call
    // against a credential that will keep being rejected. Loud, immediately.
    status: 503,
    retryable: false,
    userMessage: 'AI generation is temporarily unavailable. This is on our side, not yours.',
    needsReview: true,
    cooldownMs: 0,
  },
};

/** Map `callLLM`'s transport-level codes onto the taxonomy. */
export function codeFromTransport(transportCode: string | undefined): AiErrorCode {
  switch (transportCode) {
    case 'rate_limited':
      return 'LLM_RATE_LIMITED';
    case 'timeout':
      return 'LLM_TIMEOUT';
    case 'auth_failed':
    case 'forbidden':
      return 'LLM_AUTH_FAILED';
    case 'moderation_block':
      return 'LLM_CONTENT_REFUSED';
    case 'forced_fallback':
      return 'LLM_DISABLED';
    default:
      return 'LLM_CALL_FAILED';
  }
}

export const isRetryable = (code: AiErrorCode): boolean => AI_ERRORS[code].retryable;
export const needsReview = (code: AiErrorCode): boolean => AI_ERRORS[code].needsReview;
export const userMessageFor = (code: AiErrorCode): string => AI_ERRORS[code].userMessage;
export const statusFor = (code: AiErrorCode): number => AI_ERRORS[code].status;

// ============================================================================
// Incident reporting
// ============================================================================

export interface AiIncident {
  code: AiErrorCode;
  /** Matches the CostEvent operation label, so spend and failures join up. */
  operation: string;
  projectId?: string | null;
  userId?: string | null;
  /** The `_cid` already threaded through these logs. */
  correlationId?: string | null;
  model?: string | null;
  /**
   * Diagnostic detail — parse position, stop reason, token counts.
   *
   * Careful what goes in here. Anything lifted from the prompt is the designer's
   * own interview answers, so keep it to positions, counts and codes; include a
   * text excerpt only when it is what makes the failure debuggable, and keep it
   * short. This is the field that decides the retention question when the
   * incident table lands.
   */
  diagnostic?: Record<string, unknown>;
  /** What the failed attempts actually cost. Turns "it broke" into "it costs $X/mo." */
  costUsdWasted?: number;
}

/**
 * Record a failure for review.
 *
 * Today the sink is a structured log line with a greppable prefix, because
 * there is no incident table and no email relay yet. `[ai-incident]` in the
 * Vercel logs is the admin review surface for now.
 *
 * When the table lands this becomes a `prisma.aiIncident.upsert` keyed on
 * (projectId, operation, code) — incrementing `occurrences` rather than
 * inserting, so one broken project is one row to review and not forty. Nothing
 * that calls this needs to change.
 *
 * Never throws, for the same reason `recordCostEvent` never throws: failure
 * reporting must not be able to take down the request it is reporting on.
 */
export async function reportAiIncident(incident: AiIncident): Promise<void> {
  try {
    const spec = AI_ERRORS[incident.code];
    console.error('[ai-incident]', {
      ...incident,
      retryable: spec.retryable,
      needsReview: spec.needsReview,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[ai-incident] failed to record', err);
  }
}

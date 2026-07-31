// Local model identity for the interview-orchestration service.
// Kept service-local (not a shared package) by design — see API cost hardening Phase 1.
//
// Mirrors src/lib/ai/models.ts. Sonnet 5 rules apply here too: no
// temperature/top_p/top_k (non-default values return 400), and always pass an
// explicit `thinking` — omitting it runs adaptive thinking, which shares the
// max_tokens budget with the response and can truncate a call sized for 4.6.
export const MODELS = {
  sonnet: 'claude-sonnet-5',
  haiku: 'claude-haiku-4-5-20251001',
  opus: 'claude-opus-4-8',
} as const;

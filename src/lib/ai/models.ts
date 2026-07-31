// Model identity for every Anthropic call in the app.
//
// `sonnet` moved from claude-sonnet-4-6 to claude-sonnet-5. Sonnet 5 changes the
// request surface, so anything added here has to obey these rules:
//
// 1. NO `temperature` / `top_p` / `top_k`. Non-default values return 400. Steer
//    tone and variance with the prompt instead.
// 2. ALWAYS pass `thinking`. Omitting it runs adaptive thinking on Sonnet 5,
//    where Sonnet 4.6 ran thinking-off — and thinking shares the `max_tokens`
//    budget with the response, so a call sized for 4.6 can silently truncate.
//    Every current call site passes `thinking: { type: 'disabled' }` to hold the
//    old behavior. Turning adaptive on is a per-surface decision that has to come
//    with a `max_tokens` raise.
// 3. `budget_tokens` is gone. Depth is `output_config.effort` if we ever want it.
//
// Sonnet 5 also tokenizes ~30% higher than 4.6 for the same text, so output caps
// carry headroom for it — see the callers.
export const MODELS = {
  sonnet: 'claude-sonnet-5',
  haiku: 'claude-haiku-4-5-20251001',
  opus: 'claude-opus-4-8',
} as const

/**
 * Model ids we have used in the past and still need to price. `ANTHROPIC_RATES`
 * in ./cost.ts is keyed by model string, so a CostEvent written by an instance
 * that has not picked up a model change yet would otherwise record cost 0.
 */
export const LEGACY_MODEL_IDS = {
  sonnet46: 'claude-sonnet-4-6',
} as const

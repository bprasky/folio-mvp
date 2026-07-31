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

// ============================================================================
// Model tiering by TASK CLASS, not by call site.
//
// Call sites name what KIND of work they are doing; this table decides which
// model does it. The point is reversibility: if a class regresses, one line here
// moves it back, instead of hunting a dozen scattered `MODELS.haiku` swaps.
//
// Haiku 4.5 is $1/$5 per MTok against Sonnet 5's $3/$15 — a third of the price.
// That is only worth taking where the output is structured data nobody reads as
// prose. Everything a designer actually sees stays on Sonnet: the standing rule
// is that cost work must not degrade the experience, so a class moves down a
// tier only when a wrong answer is invisible or cheap to correct.
// ============================================================================
export const MODEL_FOR = {
  /**
   * Published prose — the article, bios, captions, anything a reader sees.
   * Never move this. It is the product.
   */
  prose: MODELS.sonnet,

  /**
   * Interview questions and follow-ups. Quality here decides how good the source
   * material is, so a weaker model degrades every article downstream, not just
   * one answer. Stays on Sonnet.
   */
  interview: MODELS.sonnet,

  /**
   * Text or an image in, a fixed JSON shape out, no tools. Wrong fields are
   * visible and correctable at the point of entry rather than baked into a
   * published article, which is what makes this the safe class to run cheaper.
   */
  extraction: MODELS.haiku,

  /**
   * Extraction that calls tools (web_search product enrichment). Kept on Sonnet
   * deliberately: tool-calling reliability is weaker on the small model, and the
   * failure mode is a product that silently does not get enriched.
   */
  toolExtraction: MODELS.sonnet,

  /**
   * Vision that produces COORDINATES rather than labels — auto-tag dot placement.
   * Kept on Sonnet: spatial precision is where a small model slips, and the
   * designer sees every misplaced dot.
   */
  visionCoordinates: MODELS.sonnet,
} as const

export type ModelTask = keyof typeof MODEL_FOR

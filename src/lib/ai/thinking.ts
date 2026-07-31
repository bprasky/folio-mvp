import type Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// Adaptive thinking, per surface, off by default.
//
// Sonnet 5 replaced the fixed `budget_tokens` with adaptive thinking: the model
// decides per request how much to think, and depth is steered with
// `output_config.effort`. The Sonnet 5 migration set every call site to
// `thinking: { type: 'disabled' }` to hold Sonnet 4.6 behavior. This module is
// how a surface opts back in, one at a time, with a measurable before/after.
//
// Three things make this a per-surface decision rather than a global default:
//
//   1. Thinking tokens bill as OUTPUT tokens — the $15/MTok side, not the $3
//      input side. It is the expensive direction.
//   2. Thinking shares the `max_tokens` budget with the response. Turn it on
//      without raising the cap and you can get a response that is mostly
//      thinking followed by a truncated answer — hence `maxTokensMultiplier`.
//   3. It adds latency. That is nearly free on a two-minute async article and
//      directly visible on a follow-up the designer is sitting and waiting for.
//
// Deliberately NOT wired here: the realtime voice service
// (services/interview-orchestration), the interactive chat surfaces, and the
// short extraction/classification calls. Thinking latency lands in a spoken
// pause on the first, is user-visible on the second, and buys little on the
// third — those keep `thinking: { type: 'disabled' }` inline.
// ============================================================================

/** Surfaces that can opt into adaptive thinking. Add one only with a cost plan. */
export type ThinkingSurface =
  /** The editorial article generator. Async, quality-sensitive, latency-tolerant. */
  | 'editorial'
  /** Interview follow-up question generation. Interactive — the designer waits. */
  | 'followups';

export type ThinkingEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * Comma-separated surfaces, e.g. `ADAPTIVE_THINKING_SURFACES=editorial` or
 * `editorial,followups`. Unset or empty = adaptive off everywhere, which is the
 * behavior the Sonnet 5 migration shipped.
 *
 * Parsed on every read rather than captured at module load, so the flag means the
 * same thing everywhere it is consulted.
 */
function parseEnabledSurfaces(): string[] {
  return (process.env.ADAPTIVE_THINKING_SURFACES ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Sonnet 5 defaults `effort` to `high`, which is a bigger jump than a migration
 * off thinking-disabled wants: Sonnet 5 at `medium` is already comparable to
 * Sonnet 4.6 at `high`. `low` is the documented starting point for callers
 * coming from thinking-off, so that is the default here — raise it deliberately.
 */
const DEFAULT_EFFORT: ThinkingEffort = 'low';

const VALID_EFFORTS: readonly ThinkingEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

function configuredEffort(): ThinkingEffort {
  const raw = (process.env.ADAPTIVE_THINKING_EFFORT ?? '').trim().toLowerCase();
  return (VALID_EFFORTS as readonly string[]).includes(raw) ? (raw as ThinkingEffort) : DEFAULT_EFFORT;
}

/**
 * Headroom for thinking tokens when adaptive is on, since thinking and the
 * response share `max_tokens`.
 *
 * This is a starting guess, not a measurement — at `low` effort thinking should
 * be modest, and 2x leaves room without uncapping spend (a higher ceiling costs
 * nothing unless tokens are actually generated). Tune it from the truncation
 * signal rather than from intuition: `[llm] output truncated at max_tokens` in
 * llmClient, and LLM_TRUNCATED from the editorial generator.
 */
const MAX_TOKENS_MULTIPLIER_WHEN_ADAPTIVE = 2;

export interface ThinkingSettings {
  /** Spread into the `messages.create` params. */
  thinking: Anthropic.ThinkingConfigParam;
  /** Present only when adaptive is on; carries the effort level. */
  output_config?: Anthropic.OutputConfig;
  /** Multiply the surface's normal `max_tokens` by this. 1 when adaptive is off. */
  maxTokensMultiplier: number;
  /** For logging — lets a cost regression be tied to a config, not guessed at. */
  adaptive: boolean;
  effort: ThinkingEffort | null;
}

/**
 * Resolve the thinking configuration for a surface.
 *
 * Read per call rather than cached at module load: these are server-side env
 * vars, and reading them live means flipping the flag does not require thinking
 * about which serverless instances captured which value at import time.
 */
export function thinkingSettingsFor(surface: ThinkingSurface): ThinkingSettings {
  if (!parseEnabledSurfaces().includes(surface)) {
    return {
      thinking: { type: 'disabled' },
      maxTokensMultiplier: 1,
      adaptive: false,
      effort: null,
    };
  }

  const effort = configuredEffort();
  return {
    thinking: { type: 'adaptive' },
    output_config: { effort },
    maxTokensMultiplier: MAX_TOKENS_MULTIPLIER_WHEN_ADAPTIVE,
    adaptive: true,
    effort,
  };
}

/**
 * The request fields to spread into `messages.create`. Separated from the
 * sizing/logging fields so a call site cannot accidentally pass
 * `maxTokensMultiplier` to the API.
 */
export function thinkingParams(settings: ThinkingSettings): {
  thinking: Anthropic.ThinkingConfigParam;
  output_config?: Anthropic.OutputConfig;
} {
  return settings.output_config
    ? { thinking: settings.thinking, output_config: settings.output_config }
    : { thinking: settings.thinking };
}

/** Surfaces currently opted in. Exported for logging and the guard script. */
export function enabledThinkingSurfaces(): string[] {
  return parseEnabledSurfaces();
}

/**
 * The first `text` block of a response, or '' if there is none.
 *
 * Use this instead of `content[0]`. With thinking disabled, `content[0]` IS the
 * text block and the two are identical. With thinking on, the response is
 * `[thinking, text]` — so `content[0].type === 'text'` is false and the usual
 * `content[0]?.type === 'text' ? … : ''` idiom silently yields the fallback:
 * an empty article that surfaces as LLM_EMPTY_RESPONSE, or an empty '{}' that
 * parses to zero follow-ups. No exception, no error log, just nothing produced.
 *
 * That failure is invisible until the flag is flipped, which is the worst time
 * to discover it, so every Anthropic response in this repo is read through here
 * — including the surfaces that cannot enable thinking today. The alternative is
 * a landmine for whoever adds the next surface.
 */
export function firstTextBlock(message: { content?: Array<{ type: string }> } | null | undefined): string {
  const block = message?.content?.find(
    (b): b is { type: 'text'; text: string } => b.type === 'text',
  );
  return block?.text ?? '';
}

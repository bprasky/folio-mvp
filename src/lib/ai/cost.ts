import { prisma } from '@/lib/prisma';
import { MODELS } from './models';

// ============================================================================
// CostEvent instrumentation (API cost hardening Phase 3).
//
// One place to update rates, one fire-and-forget writer. Every paid-API
// wrapper computes a costUsdEstimate here and records a CostEvent. Logging
// must never break the request it measures — recordCostEvent swallows errors.
// ============================================================================

export type CostProvider = 'anthropic' | 'fal' | 'resend' | 'deepgram' | 'livekit';

// Anthropic rates are per-million-tokens (MTok), keyed by the model id the
// call actually used (see src/lib/ai/models.ts).
const ANTHROPIC_RATES: Record<string, { inPerMTok: number; outPerMTok: number }> = {
  [MODELS.sonnet]: { inPerMTok: 3, outPerMTok: 15 },
  [MODELS.haiku]: { inPerMTok: 1, outPerMTok: 5 },
  [MODELS.opus]: { inPerMTok: 5, outPerMTok: 25 },
};

// Anthropic cache token multipliers, relative to the base input rate.
const CACHE_READ_MULTIPLIER = 0.1; // cache hits bill at 1/10 input (this is the Phase 2 win)
const CACHE_WRITE_MULTIPLIER = 1.25; // 5-minute ephemeral cache writes bill at 1.25x input

// Per-unit rates for the non-token providers.
export const PROVIDER_UNIT_RATES = {
  falPerGeneration: 0.02, // fal sam-3 / mesh, per generation
  deepgramPerMinute: 0.0077, // deepgram nova-3, per minute
  livekitPerMinute: 0.011, // livekit, per minute
  supabaseStorageGbMonth: 0.021, // reference only; storage is not logged as a CostEvent yet
  // Resend has no published per-email rate in the audit — volume is tracked, cost left at 0.
} as const;

export interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/** Estimated USD for one Anthropic call, accounting for cache read/write tokens. */
export function anthropicCostUsd(model: string | null | undefined, usage: AnthropicUsage): number {
  const rate = model ? ANTHROPIC_RATES[model] : undefined;
  if (!rate) return 0; // unknown model — record the event with cost 0 rather than guess
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  return (
    (input * rate.inPerMTok +
      cacheWrite * rate.inPerMTok * CACHE_WRITE_MULTIPLIER +
      cacheRead * rate.inPerMTok * CACHE_READ_MULTIPLIER +
      output * rate.outPerMTok) /
    1_000_000
  );
}

/** Estimated USD for a per-minute provider (deepgram, livekit). */
export function minutesCostUsd(provider: 'deepgram' | 'livekit', minutes: number): number {
  const rate = provider === 'deepgram' ? PROVIDER_UNIT_RATES.deepgramPerMinute : PROVIDER_UNIT_RATES.livekitPerMinute;
  return minutes * rate;
}

/** Estimated USD for fal generations. */
export function falCostUsd(generations: number): number {
  return generations * PROVIDER_UNIT_RATES.falPerGeneration;
}

export interface CostEventInput {
  provider: CostProvider;
  operation: string;
  projectId?: string | null;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheReadInputTokens?: number | null;
  cacheCreationInputTokens?: number | null;
  units?: number | null;
  costUsdEstimate: number;
}

/**
 * Persist a CostEvent. Fire-and-forget: any failure is logged and swallowed so
 * cost instrumentation can never take down the operation it is measuring.
 */
export async function recordCostEvent(input: CostEventInput): Promise<void> {
  try {
    await prisma.costEvent.create({
      data: {
        provider: input.provider,
        operation: input.operation,
        projectId: input.projectId ?? null,
        model: input.model ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        cacheReadInputTokens: input.cacheReadInputTokens ?? null,
        cacheCreationInputTokens: input.cacheCreationInputTokens ?? null,
        units: input.units ?? null,
        costUsdEstimate: input.costUsdEstimate,
      },
    });
  } catch (err) {
    console.warn('[cost] failed to record CostEvent', { provider: input.provider, operation: input.operation, err });
  }
}

/**
 * Split a callLLM contextHint ("operation:projectId", e.g. "generate:clx123")
 * into an operation label and a project id, when the tail looks like a cuid/uuid.
 */
export function parseCostContext(hint?: string): { operation: string; projectId: string | null } {
  if (!hint) return { operation: 'unknown', projectId: null };
  const idx = hint.indexOf(':');
  if (idx === -1) return { operation: hint, projectId: null };
  const operation = hint.slice(0, idx);
  const rest = hint.slice(idx + 1);
  const looksLikeId = /^c[a-z0-9]{20,}$/i.test(rest) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(rest);
  return { operation: operation || 'unknown', projectId: looksLikeId ? rest : null };
}

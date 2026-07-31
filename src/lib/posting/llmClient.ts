import { recordCostEvent, anthropicCostUsd, parseCostContext, type AnthropicUsage } from '@/lib/ai/cost';

type LLMResult<T> =
  | { ok: true; data: T; usedModel: string }
  | { ok: false; code: string; status?: number; message?: string };

// Records a CostEvent for an Anthropic Message response. callLLM is generic, so
// this only fires when the wrapped result actually looks like a Messages API
// response (carries usage.input_tokens) — non-Anthropic callers are left alone.
function recordAnthropicCost(data: unknown, modelName: string, contextHint?: string): void {
  const usage = (data as { usage?: AnthropicUsage } | null | undefined)?.usage;
  if (!usage || typeof usage.input_tokens !== 'number') return;
  const { operation, projectId } = parseCostContext(contextHint);
  void recordCostEvent({
    provider: 'anthropic',
    operation,
    projectId,
    model: modelName,
    inputTokens: usage.input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? null,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? null,
    costUsdEstimate: anthropicCostUsd(modelName, usage),
  });
}

// Surface output-cap truncation instead of silently returning half a response.
//
// This matters more since the Sonnet 5 migration: Sonnet 5 tokenizes ~30% higher
// than Sonnet 4.6 for the same text, so every `max_tokens` in this repo buys less
// prose than it did when it was chosen. Most caps have enough headroom to absorb
// that, but "most" is an estimate, and the failure is quiet — a bio or caption cut
// mid-sentence reads like a bad generation, not like a budget problem. Rather than
// inflate ~60 caps on a guess (and inflate worst-case spend with them), leave them
// and make the real cases greppable: `[llm] output truncated at max_tokens`.
//
// Only covers callers that go through callLLM. Sites that call
// `client.messages.create` directly still need their own stop_reason check —
// generateEditorialDraft has one, and it throws LLM_TRUNCATED.
function warnOnTruncation(data: unknown, modelName: string, contextHint?: string): void {
  const msg = data as { stop_reason?: string; usage?: AnthropicUsage } | null | undefined;
  if (msg?.stop_reason !== 'max_tokens') return;
  console.warn('[llm] output truncated at max_tokens', {
    model: modelName,
    context: contextHint,
    outputTokens: msg.usage?.output_tokens,
  });
}

const FORCE_FALLBACK = (process.env.POSTING_FORCE_FALLBACK ?? '').toLowerCase() === 'true';

export async function callLLM<T>(
  fn: () => Promise<T>, // your actual LLM call
  opts: {
    modelName: string;
    maxRetries?: number;
    baseDelayMs?: number;
    contextHint?: string;
  }
): Promise<LLMResult<T>> {
  if (FORCE_FALLBACK) {
    return { ok: false as const, code: 'forced_fallback', message: 'POSTING_FORCE_FALLBACK=true' };
  }

  const maxRetries = opts.maxRetries ?? 3; // 2 → 3
  const baseDelay = opts.baseDelayMs ?? 400; // 300 → 400 (mildly longer)

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await fn();
      recordAnthropicCost(data, opts.modelName, opts.contextHint);
      warnOnTruncation(data, opts.modelName, opts.contextHint);
      return { ok: true, data, usedModel: opts.modelName };
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const text = err?.message || String(err);

      // Map common failure classes
      let code = 'llm_error';
      if (status === 401 || /invalid api key/i.test(text)) code = 'auth_failed';
      else if (status === 403) code = 'forbidden';
      else if (status === 429 || /rate limit/i.test(text)) code = 'rate_limited';
      else if (status === 408 || /timeout/i.test(text)) code = 'timeout';
      else if (/safety|moderation/i.test(text)) code = 'moderation_block';

      // Backoff on transient classes
      const transient = code === 'rate_limited' || code === 'timeout';
      if (attempt < maxRetries && transient) {
        const wait = baseDelay * Math.pow(2, attempt);
        console.warn(`[llm] ${code} on ${opts.modelName}, retrying in ${wait}ms…`, {
          status,
          context: opts.contextHint,
        });
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      return { ok: false, code, status, message: text };
    }
  }

  return { ok: false, code: 'unknown', message: 'exhausted retries' };
}


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


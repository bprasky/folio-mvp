// Approximate token budget using characters; safe, fast, no extra deps:
export function approxTokens(str: string): number {
  if (!str) return 0;
  // Roughly 4 chars/token heuristic
  return Math.ceil(str.length / 4);
}

export function limitText(str: string, maxTokens: number) {
  if (approxTokens(str) <= maxTokens) return { text: str, truncated: false };
  const approxChars = maxTokens * 4;
  return {
    text: str.slice(0, Math.max(0, approxChars - 256)) + '\n…[truncated]',
    truncated: true,
  };
}

export function summarizeBudget(fields: Record<string, string | undefined>) {
  const out: Record<string, number> = {};
  Object.entries(fields).forEach(([k, v]) => {
    out[k] = approxTokens(v ?? '');
  });
  return out;
}

export function ensureUnder(str: string, maxTokens: number) {
  const { text, truncated } = limitText(str, maxTokens);
  if (truncated) {
    console.warn('[prompt] truncated', { maxTokens });
  }
  return text;
}


/**
 * Client-side cache for generated interview questions.
 *
 * Question generation is a slow, force-dynamic LLM call (tens of seconds for a
 * multi-room project) and it runs on every modal open — which both makes the
 * designer wait and re-burns API calls for questions that haven't changed. This
 * caches the fetched questions in localStorage so re-opening the same interview
 * is instant and free, and (a bonus) keeps question IDs stable across opens so
 * saved answers reliably map back to their questions.
 *
 * Invalidation is by TTL plus a structural `signature` (e.g. photo + tag counts)
 * the caller passes: when the project structure changes, the signature changes
 * and the cache is bypassed so fresh questions are generated.
 */

const TTL_MS = 30 * 60 * 1000; // 30 minutes

type CacheEnvelope<T> = {
  signature: string;
  cachedAt: number;
  data: T;
};

export function readQuestionsCache<T>(key: string, signature: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as CacheEnvelope<T>;
    if (
      !env ||
      env.signature !== signature ||
      typeof env.cachedAt !== 'number' ||
      Date.now() - env.cachedAt > TTL_MS
    ) {
      return null;
    }
    return env.data;
  } catch {
    return null;
  }
}

export function writeQuestionsCache<T>(key: string, signature: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const env: CacheEnvelope<T> = { signature, cachedAt: Date.now(), data };
    window.localStorage.setItem(key, JSON.stringify(env));
  } catch {
    /* quota / serialization — non-fatal, just skip caching */
  }
}

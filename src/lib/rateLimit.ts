const buckets = new Map<string, { count: number; resetAt: number }>();

function key(userId: string, scope: string) {
  return `${scope}:${userId}`;
}

export function rateLimit({ userId, scope, limit, windowMs }: { userId: string; scope: string; limit: number; windowMs: number }) {
  const k = key(userId, scope);
  const now = Date.now();
  const b = buckets.get(k);
  if (!b || b.resetAt <= now) {
    buckets.set(k, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count, resetAt: b.resetAt };
}

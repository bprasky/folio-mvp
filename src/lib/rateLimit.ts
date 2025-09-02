const hits = new Map<string, { count: number; ts: number }>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now - rec.ts > windowMs) { 
    hits.set(key, { count: 1, ts: now }); 
    return; 
  }
  rec.count++; 
  rec.ts = now;
  if (rec.count > limit) { 
    const err: any = new Error('Too many requests'); 
    err.status = 429; 
    throw err; 
  }
}



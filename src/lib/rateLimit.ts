/** Distributed production limits; deterministic process-local storage only in development/test. */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the time window
   */
  max: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Optional: Generate custom identifier from request
   * Default: Uses IP address
   */
  keyGenerator?: (identifier: string) => string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if request should be rate limited
 * @param identifier - Unique identifier for the requester (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @returns RateLimitResult indicating if request is allowed
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = config.keyGenerator ? config.keyGenerator(identifier) : identifier;
  const now = Date.now();
  if (process.env.NODE_ENV === 'production') {
    const denied = { success: false, limit: config.max, remaining: 0, reset: now + config.windowMs };
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return denied;
    try {
      const limiter = new Ratelimit({
        redis: new Redis({ url, token, retry: { retries: 0 } }),
        limiter: Ratelimit.fixedWindow(config.max, `${config.windowMs} ms`),
        prefix: `folio:ratelimit:${config.max}:${config.windowMs}`,
        ephemeralCache: false,
        analytics: false,
        timeout: 3000,
      });
      const result = await limiter.limit(key);
      if (result.reason === 'timeout') return denied;
      await result.pending;
      return { success: result.success, limit: result.limit, remaining: result.remaining, reset: result.reset };
    } catch {
      console.error('[rate-limit] Production backend unavailable');
      return denied;
    }
  }

  // Clean up expired entries (simple garbage collection)
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of Array.from(rateLimitStore.entries())) {
      if (v.resetAt < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  let record = rateLimitStore.get(key);

  // Create new record or reset if window expired
  if (!record || record.resetAt <= now) {
    record = {
      count: 0,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, record);
  }

  // Increment count
  record.count++;

  const success = record.count <= config.max;
  const remaining = Math.max(0, config.max - record.count);

  return {
    success,
    limit: config.max,
    remaining,
    reset: record.resetAt,
  };
}

/**
 * Get client IP address from request headers
 * Works with various proxy configurations (Vercel, Cloudflare, etc.)
 */
export function getClientIp(headers: Headers): string {
  // Try various headers in order of preference
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // Fallback to a generic identifier
  return 'unknown';
}

/**
 * Check multiple rate limits and return the first failure
 * Useful for checking both IP-level and user-level limits
 * @param checks - Array of {identifier, config} objects
 * @returns First failed result, or successful result if all pass
 */
export async function checkMultipleRateLimits(
  checks: Array<{ identifier: string; config: RateLimitConfig }>
): Promise<RateLimitResult> {
  if (!checks.length) throw new Error('At least one rate limit is required');
  let result: RateLimitResult;
  for (const { identifier, config } of checks) {
    result = await checkRateLimit(identifier, config);
    if (!result.success) {
      return result; // Return first failure
    }
  }

  // All checks passed, return success from last check
  return result!;
}

/**
 * Preset rate limit configurations
 */
export const RateLimitPresets = {
  /**
   * Very strict - for sensitive operations like password reset
   * 5 requests per 15 minutes
   */
  STRICT: {
    max: 5,
    windowMs: 15 * 60 * 1000,
  },

  /**
   * Per-IP limit for login attempts (prevents mass attacks from single IP)
   * 50 login attempts per hour from any IP
   * This is generous to avoid blocking corporate networks/VPNs
   */
  LOGIN_PER_IP: {
    max: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
  },

  /**
   * Per-email limit for login attempts (prevents credential stuffing)
   * 10 attempts per email per 15 minutes
   * This is strict to prevent brute force on individual accounts
   */
  LOGIN_PER_EMAIL: {
    max: 10,
    windowMs: 15 * 60 * 1000,
  },

  /**
   * Per-IP limit for signup (prevents mass fake account creation)
   * 20 signups per hour from any IP
   */
  SIGNUP_PER_IP: {
    max: 20,
    windowMs: 60 * 60 * 1000,
  },

  /**
   * Auth endpoints - login, signup (legacy, prefer specific presets above)
   * 10 requests per 15 minutes
   */
  AUTH: {
    max: 10,
    windowMs: 15 * 60 * 1000,
  },

  /**
   * Standard API endpoints
   * 100 requests per 15 minutes
   */
  STANDARD: {
    max: 100,
    windowMs: 15 * 60 * 1000,
  },

  /**
   * Generous limit for authenticated users
   * 1000 requests per hour
   */
  GENEROUS: {
    max: 1000,
    windowMs: 60 * 60 * 1000,
  },
} as const;

/**
 * Simple rate limit function that returns ok/not ok status
 * Supports object-based configuration for consistency
 */
export async function rateLimit(opts: {
  userId?: string;
  scope: string;
  limit: number;
  windowMs: number;
}): Promise<{ ok: boolean; remaining: number; reset: number }> {
  const key = opts.userId ? `${opts.userId}:${opts.scope}` : opts.scope;
  const result = await checkRateLimit(key, { max: opts.limit, windowMs: opts.windowMs });
  return {
    ok: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

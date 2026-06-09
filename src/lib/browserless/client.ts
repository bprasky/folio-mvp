/**
 * Browserless client.
 *
 * This is the single place in the app that reads the Browserless key, builds a
 * Browserless URL, and applies a request timeout. Every external page scrape
 * goes through here so that later escalation (stealth, residential proxy,
 * captcha solve, smart-scrape, BrowserQL) becomes a change in this one module
 * rather than an edit across six call sites.
 *
 * Phase 0 contract: behavior on the wire is unchanged. The escalation options
 * below are wired as a typed pass-through and default to off, so the request
 * bodies sent are byte for byte what they were before this client existed
 * (`{ url }` for /content, `{ code, context }` for /function). The mapping from
 * these options onto real Browserless params is confirmed against
 * docs.browserless.io and turned on in Phase 2, not here. Until then the options
 * are accepted and ignored, and `smartScrape` / `bql` are inert stubs.
 */

const BROWSERLESS_HOST = 'https://production-sfo.browserless.io';
const DEFAULT_TIMEOUT_MS = 20000;

export type ScrapeEndpoint =
  | 'content'
  | 'function'
  | 'smart-scrape'
  | 'bql'
  | 'direct';

/**
 * Escalation surface. All flags default off in Phase 0 and are not yet mapped
 * onto the Browserless request. Phase 2 confirms the exact param names against
 * the docs and enables them per domain. Do not add guessed param wiring here.
 */
export interface BrowserlessOptions {
  /** Per call timeout. Defaults to 20s when omitted. */
  timeoutMs?: number;
  stealth?: boolean;
  proxy?: 'residential' | 'datacenter';
  proxyCountry?: string;
  solveCaptchas?: boolean;
  unblock?: boolean;
}

export interface DirectFetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface BrowserlessResult {
  /** True when the Browserless (or direct) request itself returned a 2xx. */
  ok: boolean;
  /** HTTP status of the Browserless response (or the direct fetch response). */
  status: number;
  /**
   * HTTP status of the target page being scraped, not Browserless's own status.
   * For the direct-fetch helper this is the page status and is filled now. For
   * the Browserless endpoints this is left null in Phase 0 and surfaced properly
   * in Phase 1 from the endpoint payload.
   */
  targetStatus: number | null;
  /** Raw response body text. Callers parse as needed (HTML for content, JSON for function). */
  payload: string;
  endpoint: ScrapeEndpoint;
  durationMs: number;
  /** Set when the request threw or timed out. "timeout" | "no-key" | message. */
  error?: string;
}

let aliasWarned = false;

/**
 * Read the Browserless key. Prefers BROWSERLESS_API_KEY. Accepts BROWSERLESS_TOKEN
 * as a fallback alias so the standalone test scripts keep working, but warns once
 * when only the alias is set.
 */
function readKey(): string | null {
  const primary = process.env.BROWSERLESS_API_KEY;
  if (primary) return primary;
  const alias = process.env.BROWSERLESS_TOKEN;
  if (alias) {
    if (!aliasWarned) {
      aliasWarned = true;
      console.warn(
        '[browserless] BROWSERLESS_API_KEY is not set; falling back to BROWSERLESS_TOKEN. Set BROWSERLESS_API_KEY.',
      );
    }
    return alias;
  }
  return null;
}

/** True when a Browserless key is available under either name. */
export function hasBrowserlessKey(): boolean {
  return !!(process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN);
}

/** Shared POST against a Browserless REST endpoint with a uniform timeout. */
async function postEndpoint(
  endpoint: ScrapeEndpoint,
  path: string,
  body: Record<string, unknown>,
  opts: BrowserlessOptions,
): Promise<BrowserlessResult> {
  const key = readKey();
  if (!key) {
    return { ok: false, status: 0, targetStatus: null, payload: '', endpoint, durationMs: 0, error: 'no-key' };
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${BROWSERLESS_HOST}${path}?token=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await res.text();
    return { ok: res.ok, status: res.status, targetStatus: null, payload, endpoint, durationMs: Date.now() - started };
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      targetStatus: null,
      payload: '',
      endpoint,
      durationMs: Date.now() - started,
      error: aborted ? 'timeout' : err?.message || 'error',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Rendered HTML via the /content endpoint. Phase 0 body is exactly `{ url }`.
 */
export async function getContent(url: string, opts: BrowserlessOptions = {}): Promise<BrowserlessResult> {
  return postEndpoint('content', '/content', { url }, opts);
}

/**
 * In-page JS harvest via the /function endpoint. Phase 0 body is exactly
 * `{ code, context }`.
 */
export async function runFunction(
  code: string,
  context: Record<string, unknown>,
  opts: BrowserlessOptions = {},
): Promise<BrowserlessResult> {
  return postEndpoint('function', '/function', { code, context }, opts);
}

/**
 * Plain server-side fetch of the page, centralized so the direct-fetch fallback
 * shared by several scrape paths lives in one place. The target page status is
 * available directly on the Response, so it is filled here.
 */
export async function directFetch(url: string, opts: DirectFetchOptions = {}): Promise<BrowserlessResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: opts.headers, signal: controller.signal });
    const payload = res.ok ? await res.text() : '';
    return {
      ok: res.ok,
      status: res.status,
      targetStatus: res.status,
      payload,
      endpoint: 'direct',
      durationMs: Date.now() - started,
    };
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      targetStatus: null,
      payload: '',
      endpoint: 'direct',
      durationMs: Date.now() - started,
      error: aborted ? 'timeout' : err?.message || 'error',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Smart-scrape endpoint. Inert until Phase 2 enables it; the interface is
 * settled now so call sites can be pointed at it later without a signature
 * change.
 */
export async function smartScrape(_url: string, _opts: BrowserlessOptions = {}): Promise<BrowserlessResult> {
  throw new Error('[browserless] smartScrape is not enabled until Phase 2');
}

/**
 * BrowserQL endpoint, including the conditional captcha solve. Inert until
 * Phase 2 enables it.
 */
export async function bql(
  _query: string,
  _vars: Record<string, unknown> = {},
  _opts: BrowserlessOptions = {},
): Promise<BrowserlessResult> {
  throw new Error('[browserless] bql is not enabled until Phase 2');
}

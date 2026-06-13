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
 * are accepted and ignored, and `smartScrape` is an inert stub. As of Phase 2a
 * the `bql` rung is live: it maps the stealth / residential-proxy / conditional
 * solve options onto a confirmed BrowserQL mutation. It is not yet wired into
 * the scrape path, which still runs the Phase 0 byte-for-byte bodies.
 */

const BROWSERLESS_HOST = 'https://production-sfo.browserless.io';
const DEFAULT_TIMEOUT_MS = 20000;
// BrowserQL needs a higher ceiling than the REST endpoints: a navigation plus a
// conditional captcha solve can legitimately run long (the solve mutation alone
// defaults to a 30s wait), so a 20s abort would cut off a real challenge clear.
const BQL_DEFAULT_TIMEOUT_MS = 90000;

// Single BrowserQL mutation for the escalation rung. Confirmed against the BQL
// reference on docs.browserless.io (goto / if / solve / html operations):
//
//   - goto(url, waitUntil: load) { status }  navigates and surfaces the page
//     status. Stealth is the BQL endpoint default, and the residential proxy is
//     selected via query params on the endpoint URL (see bql() below), not as a
//     mutation argument.
//   - if(selector) { solve(type) { ... } }  is a point-in-time presence check
//     that runs the nested solve ONLY when that widget is in the DOM. This keeps
//     the 10-unit solve charge gated to an actual challenge: on a clean page the
//     if branch is skipped and solve never fires.
//   - solve(type: CaptchaTypes) { found solved time }  takes an explicit captcha
//     type. solve runs once per call against a single type, so the conditional
//     rung is split per widget, each passing the matching enum value. The
//     supported types were confirmed against the BQL CaptchaTypes enum on
//     docs.browserless.io: recaptcha / recaptchaV3, cloudflare (which also
//     covers Turnstile), datadome, and others. Notably absent: hCaptcha and
//     PerimeterX (Wayfair's px-captcha). Those are intentionally given no solve
//     branch — an unsupported challenge falls through to the returned HTML and
//     is recorded as a failure by the classifier rather than looping on a type
//     solve cannot handle. In practice Wayfair clears on the residential proxy +
//     stealth without ever presenting a captcha, so neither if branch fires.
//   - html { html }  returns the final page HTML, which the classifier consumes
//     exactly like the /content payload.
//
// Caveat surfaced for Phase 2: goto.status reflects only the first navigation,
// so a challenge that is cleared by the solve still reports its handshake status
// (e.g. 403). The recorder keys BQL success on usable content, not status, so a
// solved 403 is not mislabeled as a block. `solved` is surfaced alongside the
// status so a cleared challenge stays legible.
const BQL_RECAPTCHA_SELECTOR = ".g-recaptcha, iframe[src*='recaptcha']";
const BQL_CLOUDFLARE_SELECTOR = ".cf-turnstile, iframe[src*='challenges.cloudflare.com']";

const BQL_SCRAPE_MUTATION = `mutation FolioBqlScrape($url: String!) {
  goto(url: $url, waitUntil: load) {
    status
  }
  recaptcha: if(selector: ${JSON.stringify(BQL_RECAPTCHA_SELECTOR)}) {
    solve(type: recaptcha) {
      found
      solved
      time
    }
  }
  cloudflare: if(selector: ${JSON.stringify(BQL_CLOUDFLARE_SELECTOR)}) {
    solve(type: cloudflare) {
      found
      solved
      time
    }
  }
  content: html {
    html
  }
}`;

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
  /**
   * BQL only: true when the conditional rung detected a captcha and the solve
   * succeeded (the only path that incurs the 10-unit solve charge). Left
   * undefined for every non-BQL endpoint, which never runs a solve.
   */
  solved?: boolean;
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
 * BrowserQL escalation rung (spec 17 Phase 2a). Runs the single
 * BQL_SCRAPE_MUTATION above against the /bql GraphQL endpoint: navigate with
 * stealth (the BQL default) over a residential proxy, conditionally solve a
 * captcha only when one is present, then return the page HTML.
 *
 * The residential proxy is selected via query params on the endpoint URL, the
 * documented way to use Browserless's built-in proxy from BQL. `opts.stealth`
 * is accepted for signature parity but needs no wire mapping: the BQL endpoint
 * is stealth-first by default.
 *
 * Result shape matches the other client methods so it flows straight through
 * the classifier and recorder: `payload` carries the page HTML (so the bot-wall
 * signatures match real page text), `targetStatus` carries goto.status, and
 * `ok` reflects BQL transport success, not the page status. A GraphQL `errors`
 * array comes back on a 200, so it is treated as a failure, not an ok response.
 */
export async function bql(url: string, opts: BrowserlessOptions = {}): Promise<BrowserlessResult> {
  const key = readKey();
  if (!key) {
    return { ok: false, status: 0, targetStatus: null, payload: '', endpoint: 'bql', durationMs: 0, error: 'no-key' };
  }

  // Token plus the built-in residential proxy ride as query params on the BQL
  // endpoint URL. Default to a US residential exit for this rung; honor an
  // explicit datacenter choice if a caller asks for it.
  const params = new URLSearchParams({ token: key });
  if (opts.proxy === 'datacenter') {
    params.set('proxy', 'datacenter');
  } else {
    params.set('proxy', 'residential');
    params.set('proxyCountry', opts.proxyCountry ?? 'us');
  }

  const timeoutMs = opts.timeoutMs ?? BQL_DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${BROWSERLESS_HOST}/bql?${params.toString()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: BQL_SCRAPE_MUTATION, variables: { url } }),
      signal: controller.signal,
    });
    const raw = await res.text();
    const durationMs = Date.now() - started;

    // Parse the GraphQL envelope. BQL returns 200 with an `errors` array when a
    // mutation throws (bad navigation, malformed query), so a 200 alone is not
    // success.
    let data: any = null;
    let gqlError: string | undefined;
    try {
      const parsed = JSON.parse(raw);
      data = parsed?.data ?? null;
      if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
        gqlError = parsed.errors.map((e: any) => e?.message).filter(Boolean).join('; ') || 'bql-error';
      }
    } catch {
      gqlError = 'bql-parse-error';
    }

    const targetStatus: number | null = typeof data?.goto?.status === 'number' ? data.goto.status : null;
    const html: string = typeof data?.content?.html === 'string' ? data.content.html : '';
    // Each alias is null when its if branch was skipped (that widget absent), so
    // a truthy solved on either means a captcha was both found and solved.
    const solved =
      data?.recaptcha?.solve?.solved === true ||
      data?.cloudflare?.solve?.solved === true;
    const ok = res.ok && !gqlError;

    return {
      ok,
      status: res.status,
      targetStatus,
      // On success surface the page HTML for the classifier; on failure surface
      // the raw envelope so the error is debuggable.
      payload: ok ? html : raw,
      endpoint: 'bql',
      durationMs,
      error: gqlError,
      solved,
    };
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      targetStatus: null,
      payload: '',
      endpoint: 'bql',
      durationMs: Date.now() - started,
      error: aborted ? 'timeout' : err?.message || 'error',
    };
  } finally {
    clearTimeout(timer);
  }
}

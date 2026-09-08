// Compatibility types for existing scrape recorders. All rendering uses the isolated worker.
import { renderProductPage, hasRenderWorker } from '@/lib/server/render-product';
import { safeProductFetch } from '@/lib/server/safe-product-url';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

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
   * Non-fatal diagnostic that did NOT make the result a failure. Used by the BQL
   * rung to record a goto navigation-wait timeout that still returned a usable
   * page: `ok` stays true, the page flows to the classifier, and this carries the
   * timeout note for observability. Distinct from `error`, which means failure.
   */
  note?: string;
  /**
   * BQL only: true when the conditional rung detected a captcha and the solve
   * succeeded (the only path that incurs the 10-unit solve charge). Left
   * undefined for every non-BQL endpoint, which never runs a solve.
   */
  solved?: boolean;
}


export const hasBrowserlessKey = hasRenderWorker;

export async function getContent(url: string, _opts: BrowserlessOptions = {}): Promise<BrowserlessResult> {
  void _opts; // Legacy flags are never forwarded; worker owns its fixed bounds.
  const started = Date.now();
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, status: 401, targetStatus: null, payload: '', endpoint: 'content', durationMs: 0, error: 'unauthorized' };
    const budget = await rateLimit({ userId: session.user.id, scope: 'legacy-render', limit: 20, windowMs: 3600000 });
    if (!budget.ok) return { ok: false, status: 429, targetStatus: null, payload: '', endpoint: 'content', durationMs: 0, error: 'render-budget' };
    const page = await renderProductPage(url);
    return { ok: !!page, status: page ? 200 : 503, targetStatus: page?.status ?? null, payload: page?.html || '', endpoint: 'content', durationMs: Date.now() - started, error: page ? undefined : 'renderer-unavailable' };
  } catch { return { ok: false, status: 503, targetStatus: null, payload: '', endpoint: 'content', durationMs: Date.now() - started, error: 'renderer-unavailable' }; }
}

export async function directFetch(url: string, _opts: DirectFetchOptions = {}): Promise<BrowserlessResult> {
  void _opts; // Pinned transport owns request headers and timeout.
  const started = Date.now();
  try {
    const page = await safeProductFetch(url);
    return { ok: page.status >= 200 && page.status < 300, status: page.status, targetStatus: page.status, payload: page.html, endpoint: 'direct', durationMs: Date.now() - started };
  } catch { return { ok: false, status: 503, targetStatus: null, payload: '', endpoint: 'direct', durationMs: Date.now() - started, error: 'fetch-unavailable' }; }
}

// Kept for standalone historical callers; no GraphQL, proxy or solver is executed.
export const bql = getContent;
export async function smartScrape(_url: string, _opts: BrowserlessOptions = {}): Promise<BrowserlessResult> { void _opts; throw new Error('Unsupported render operation'); }

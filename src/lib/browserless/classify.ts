/**
 * Shared scrape classifier.
 *
 * Phase 0 hosts the single bot-wall detector that both vendor scrape paths
 * (`/api/scrape-product` and the `scrapeProduct` server action) now share. This
 * closes the divergence where the server action had no bot-wall detection and
 * would turn a denial page title into a low-confidence product.
 *
 * Phase 1 adds classifyScrapeOutcome, a typed ScrapeOutcome keyed on the target
 * HTTP status plus content signature, separating a challenge page from a
 * CAPTCHA. The phrase list below stays only as a secondary signal behind status.
 */

import type { BrowserlessResult } from './client';

// Anti-scrape walls (PerimeterX, Cloudflare, Incapsula, Akamai and similar)
// return a denial page instead of the product. Its title or description would
// otherwise become the "product" (for example name: "Access to this page has
// been denied"). Detect those so a bot wall is never surfaced as a real product.
export const BOT_WALL_SIGNATURES = [
  'access to this page has been denied',
  'access denied',
  'restricted access',
  'px-captcha',
  'perimeterx',
  'pardon our interruption',
  'are you a human',
  'verify you are a human',
  'enable javascript and cookies to continue',
  'attention required', // Cloudflare
  'checking your browser before accessing',
  'request unsuccessful. incapsula',
  'incapsula incident',
  'unusual traffic from your',
  'bot detection',
  'captcha',
];

export function looksLikeBotWall(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return BOT_WALL_SIGNATURES.some((sig) => t.includes(sig));
}

/** Mirrors the ScrapeOutcome enum in schema.prisma. */
export type ScrapeOutcome =
  | 'RENDERED_OK'
  | 'THIN_CONTENT'
  | 'BLOCKED_403'
  | 'BLOCKED_429'
  | 'CHALLENGE_PAGE'
  | 'CAPTCHA_PRESENT'
  | 'BROWSERLESS_ERROR'
  | 'DIRECT_FETCH_FALLBACK'
  | 'TIMEOUT';

// Explicit CAPTCHA widgets. Presence of any of these is a CAPTCHA, not just a
// generic challenge. Primary signal, ahead of the phrase list.
const CAPTCHA_MARKERS = ['g-recaptcha', 'cf-turnstile', 'px-captcha', 'h-captcha'];

// Interstitial fingerprints for the common WAFs. Secondary signal, used to tell
// a challenge page apart from a plain block and to catch 200-status walls.
const CHALLENGE_SIGNATURES = [
  'cloudflare',
  'perimeterx',
  'incapsula',
  'akamai',
  'attention required',
  'checking your browser before accessing',
  'pardon our interruption',
  'enable javascript and cookies to continue',
];

// Below this a 200 body has effectively rendered nothing usable.
const MIN_USABLE_BODY = 500;

function hasAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * Content-first usability check for a returned page body. A body is usable when
 * it is non-trivial (at least MIN_USABLE_BODY chars) and free of a lingering
 * captcha or challenge wall. Status is intentionally ignored: a solved challenge
 * clears the page yet goto.status still reports the original handshake.
 *
 * Shared between the BQL branch of classifyScrapeOutcome and the bql() recovery
 * path, so both decide "did a usable page come back?" by the same rule. This is
 * what lets bql() keep a content-bearing response that a goto navigation-wait
 * timeout would otherwise have discarded.
 */
export function hasUsablePageContent(payload: string | null | undefined): boolean {
  if (!payload) return false;
  const body = payload.toLowerCase();
  if (hasAny(body, CAPTCHA_MARKERS)) return false;
  if (hasAny(body, CHALLENGE_SIGNATURES) || looksLikeBotWall(payload)) return false;
  return payload.trim().length >= MIN_USABLE_BODY;
}

/**
 * Classify a scrape attempt into a ScrapeOutcome, keyed on the target HTTP
 * status plus content signature. Status is the primary signal; the bot-wall
 * phrase list (looksLikeBotWall) is a secondary signal behind it. The caller
 * can still steer the THIN_CONTENT vs RENDERED_OK split via the recorder's
 * emptyResult flag, since payload emptiness (no image, no product fields, no
 * image list) is consumer specific and not visible here. A detected block is
 * never overridden by that flag.
 */
export function classifyScrapeOutcome(result: BrowserlessResult): ScrapeOutcome {
  if (result.error === 'timeout') return 'TIMEOUT';

  // A Browserless endpoint that did not return 2xx (or threw) is an
  // infrastructure failure, distinct from the target blocking us. The direct
  // fetch helper is not Browserless, so its transport failure is its own
  // fallback outcome rather than a Browserless error.
  if (!result.ok) {
    return result.endpoint === 'direct' ? 'DIRECT_FETCH_FALLBACK' : 'BROWSERLESS_ERROR';
  }

  const body = (result.payload || '').toLowerCase();
  const status = result.targetStatus;

  // BQL is content-first, not status-first. A solved challenge clears the page
  // yet goto.status still reports the original handshake (often 403), so keying
  // off status would log a real success as BLOCKED_403. Decide on the HTML: a
  // lingering captcha or wall is a failure, otherwise usable HTML is success
  // regardless of the reported status. Only the BQL rung uses this; the basic
  // tiers keep the status-first logic below.
  if (result.endpoint === 'bql') {
    if (hasAny(body, CAPTCHA_MARKERS)) return 'CAPTCHA_PRESENT';
    if (hasAny(body, CHALLENGE_SIGNATURES) || looksLikeBotWall(result.payload)) return 'CHALLENGE_PAGE';
    if (result.payload.trim().length < MIN_USABLE_BODY) return 'THIN_CONTENT';
    return 'RENDERED_OK';
  }

  // CAPTCHA is the most specific signal.
  if (hasAny(body, CAPTCHA_MARKERS)) return 'CAPTCHA_PRESENT';

  // Status-keyed blocks.
  if (status === 429) return 'BLOCKED_429';
  if (status === 403) {
    return hasAny(body, CHALLENGE_SIGNATURES) || looksLikeBotWall(result.payload)
      ? 'CHALLENGE_PAGE'
      : 'BLOCKED_403';
  }

  // A 200 (or status-unknown /content) body can still be a wall.
  if (hasAny(body, CHALLENGE_SIGNATURES) || looksLikeBotWall(result.payload)) return 'CHALLENGE_PAGE';

  // Empty or near-empty body rendered nothing usable.
  if (result.payload.trim().length < MIN_USABLE_BODY) return 'THIN_CONTENT';

  return 'RENDERED_OK';
}

/** True for the four outcomes that mean the target actively blocked us. */
export function isBlockedOutcome(outcome: ScrapeOutcome): boolean {
  return (
    outcome === 'BLOCKED_403' ||
    outcome === 'BLOCKED_429' ||
    outcome === 'CHALLENGE_PAGE' ||
    outcome === 'CAPTCHA_PRESENT'
  );
}

/**
 * Flagged-domain policy (spec 17 Phase 2b).
 *
 * A small, explicit allowlist of domains whose product pages need the expensive
 * BQL rung (residential proxy + stealth + conditional captcha solve) to read.
 * The default scrape path (cheerio + Browserless /content + /function) is left
 * untouched for every other domain; only these flagged domains escalate, because
 * the rung pulls multi-megabyte pages over a residential proxy and is gated to
 * keep that cost off the default path.
 *
 * Seeded with wayfair.com from the Phase 1 ScrapeAttempt observation window;
 * potterybarn.com added after it was observed returning a 403 denial page.
 * This list is now a fast-path optimization rather than the sole escalation
 * trigger: any domain whose cheap scrape records a block auto-escalates via the
 * scrape-bql route (see hasRecentBlockedAttempt). Listing a known-hard domain
 * here just skips the doomed cheap attempt up front.
 *
 * Matching is on the registrable domain, not the exact host, so subdomains
 * (www.wayfair.com, secure.wayfair.com) all resolve to the same policy entry.
 */

export const FLAGGED_DOMAINS: readonly string[] = ['wayfair.com', 'potterybarn.com'];

/**
 * Reduce a URL to its registrable domain (last two labels), lowercased, with a
 * leading `www.` stripped. Returns null for unparseable input.
 *
 * Caveat: this naive last-two-labels rule does not understand multi-part public
 * suffixes (e.g. co.uk would reduce to "co.uk"). The seed list is .com only, so
 * this is sufficient today. If a multi-part-TLD domain is ever flagged, switch
 * to a public-suffix-list lookup here rather than special-casing callers.
 */
export function registrableDomain(input: string): string | null {
  try {
    const host = new URL(input).hostname.toLowerCase().replace(/^www\./, '');
    if (!host) return null;
    const parts = host.split('.');
    return parts.length <= 2 ? host : parts.slice(-2).join('.');
  } catch {
    return null;
  }
}

/** True when the URL's registrable domain requires the BQL escalation rung. */
export function isFlaggedDomain(input: string): boolean {
  const domain = registrableDomain(input);
  return domain != null && FLAGGED_DOMAINS.includes(domain);
}

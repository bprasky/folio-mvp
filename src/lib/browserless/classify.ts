/**
 * Shared scrape classifier.
 *
 * Phase 0 hosts the single bot-wall detector that both vendor scrape paths
 * (`/api/scrape-product` and the `scrapeProduct` server action) now share. This
 * closes the divergence where the server action had no bot-wall detection and
 * would turn a denial page title into a low-confidence product.
 *
 * Phase 1 extends this module to return a typed ScrapeOutcome keyed on the
 * target HTTP status plus content signature, separating a challenge page from a
 * CAPTCHA. The phrase list below stays only as a secondary signal behind status.
 * Do not improve the classifier here.
 */

// Anti-scrape walls (PerimeterX, Cloudflare, Incapsula, Akamai and similar)
// return a denial page instead of the product. Its title or description would
// otherwise become the "product" (for example name: "Access to this page has
// been denied"). Detect those so a bot wall is never surfaced as a real product.
export const BOT_WALL_SIGNATURES = [
  'access to this page has been denied',
  'access denied',
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

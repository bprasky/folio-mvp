/**
 * Canonical CachedProduct cache key.
 *
 * Drops the query string and trailing slashes so the same product page resolves
 * to one CachedProduct row regardless of tracking params. Every surface that
 * reads or writes CachedProduct.url must key through this function so the AI
 * extractor (aiExtractProduct) and the BQL rung (scrape-bql) share cache hits
 * for the same URL instead of each paying for it once.
 */
export function normalizeProductUrl(url: string): string {
  return url.split('?')[0].replace(/\/+$/, '');
}

/**
 * Quotes for an Instagram export.
 *
 * SOURCE: the article's already-verified pull quote selections. Nothing else.
 *
 * What this used to do, and why it stopped: it read the verified selections, then
 * fell through to `lead.deck` (Folio's own summary copy, never anyone's speech),
 * then split every chapter body on `[.!?]` and took any sentence between 50 and
 * 150 characters. Those sentences are model-written article prose. Setting one in
 * quote marks over a photograph publishes a sentence the designer never said, to
 * an audience that has no way to check, on the one surface that leaves the
 * platform and cannot be corrected after the fact.
 *
 * The article's own quotes were cut from the designer's interview answers by
 * `extractQuoteCandidates` and re-checked with `isVerbatimSpan` before they were
 * stored. Reading them here inherits that guarantee. Re-deriving anything from
 * prose throws it away, which is why there is no fallback below: a project with
 * no verified selection returns an empty array, and the caller omits the quote
 * rather than generating one.
 */

import { Blocks, getSelectedPullQuoteText } from '@/lib/posting/schemas';

/** Instagram overlay limits. A quote outside them is dropped, never trimmed to fit. */
const MIN_LENGTH = 30;
const MAX_LENGTH = 200;

export function extractQuotes(expandedBlocks: Blocks | null | undefined): string[] {
  if (!expandedBlocks) return [];

  const quotes: string[] = [];

  // Top-level index. Built by `syncPullQuotesFromChapters` from the chapter
  // selections plus the hook quote, both of which are verified upstream.
  if (Array.isArray(expandedBlocks.pullQuotes)) {
    for (const q of expandedBlocks.pullQuotes) {
      if (typeof q === 'string') {
        if (q) quotes.push(q);
      } else if (q && typeof (q as { text?: unknown }).text === 'string') {
        quotes.push((q as { text: string }).text);
      }
    }
  }

  // Per-chapter selections. The same helper the article renders through, so the
  // export cannot show a quote the page does not.
  if (Array.isArray(expandedBlocks.galleryChapters)) {
    for (const chapter of expandedBlocks.galleryChapters) {
      const text = getSelectedPullQuoteText(chapter.pullQuote);
      if (text) quotes.push(text);
    }
  }

  const unique = Array.from(new Set(quotes.map((q) => q.trim()).filter(Boolean)));

  return unique
    .filter((q) => q.length >= MIN_LENGTH && q.length <= MAX_LENGTH)
    .slice(0, 4);
}

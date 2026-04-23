/**
 * Extract quotable excerpts from ProjectPost expandedBlocks
 * Returns array of quotes (max 4) suitable for Instagram carousel
 */

import { Blocks, getSelectedPullQuoteText } from '@/lib/posting/schemas';

export function extractQuotes(expandedBlocks: Blocks | null | undefined): string[] {
  if (!expandedBlocks) return [];

  const quotes: string[] = [];

  // Top-level pullQuotes can be string | { text, context?, sourceSection? }
  if (Array.isArray(expandedBlocks.pullQuotes)) {
    for (const q of expandedBlocks.pullQuotes) {
      if (typeof q === 'string') {
        if (q) quotes.push(q);
      } else if (q && typeof (q as { text?: unknown }).text === 'string') {
        quotes.push((q as { text: string }).text);
      }
    }
  }

  // Per-chapter pullQuote is string | PullQuoteSelection | null — use the shared helper
  if (Array.isArray(expandedBlocks.galleryChapters)) {
    for (const chapter of expandedBlocks.galleryChapters) {
      const text = getSelectedPullQuoteText(chapter.pullQuote);
      if (text) quotes.push(text);
    }
  }

  // Extract from lead.deck (if it's quotable)
  if (typeof expandedBlocks.lead?.deck === 'string' && expandedBlocks.lead.deck.length <= 150) {
    quotes.push(expandedBlocks.lead.deck);
  }

  // Extract from galleryChapters body text (look for short, impactful sentences)
  if (Array.isArray(expandedBlocks.galleryChapters)) {
    for (const chapter of expandedBlocks.galleryChapters) {
      if (Array.isArray(chapter.body)) {
        for (const para of chapter.body) {
          if (typeof para === 'string') {
            const sentences = para
              .split(/[.!?]+/)
              .map((s) => s.trim())
              .filter((s) => s.length >= 50 && s.length <= 150);
            quotes.push(...sentences.slice(0, 2));
          }
        }
      }
    }
  }

  // Deduplicate and limit to 4
  const uniqueQuotes = Array.from(
    new Set(quotes.map((q) => q.trim()).filter(Boolean))
  );

  // Filter out quotes that are too short or too long for Instagram
  const filtered = uniqueQuotes.filter((q) => q.length >= 30 && q.length <= 200);

  return filtered.slice(0, 4);
}


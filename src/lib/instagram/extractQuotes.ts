/**
 * Extract quotable excerpts from ProjectPost expandedBlocks
 * Returns array of quotes (max 4) suitable for Instagram carousel
 */

import { Blocks } from '@/lib/posting/schemas';

export function extractQuotes(expandedBlocks: Blocks | null | undefined): string[] {
  if (!expandedBlocks) return [];

  const quotes: string[] = [];

  // Extract from pullQuotes array (highest priority)
  if (expandedBlocks.pullQuotes && Array.isArray(expandedBlocks.pullQuotes)) {
    quotes.push(...expandedBlocks.pullQuotes.filter(Boolean));
  }

  // Extract from galleryChapters pullQuote fields
  if (expandedBlocks.galleryChapters && Array.isArray(expandedBlocks.galleryChapters)) {
    for (const chapter of expandedBlocks.galleryChapters) {
      if (chapter.pullQuote && typeof chapter.pullQuote === 'string') {
        quotes.push(chapter.pullQuote);
      }
    }
  }

  // Extract from lead.deck (if it's quotable)
  if (expandedBlocks.lead?.deck) {
    const deck = expandedBlocks.lead.deck;
    // Only include if it's short enough to be a quote (under 150 chars)
    if (deck.length <= 150) {
      quotes.push(deck);
    }
  }

  // Extract from galleryChapters body text (look for short, impactful sentences)
  if (expandedBlocks.galleryChapters && Array.isArray(expandedBlocks.galleryChapters)) {
    for (const chapter of expandedBlocks.galleryChapters) {
      if (chapter.body && Array.isArray(chapter.body)) {
        for (const para of chapter.body) {
          if (typeof para === 'string') {
            // Look for sentences that are 50-150 chars (good quote length)
            const sentences = para.split(/[.!?]+/).filter(s => s.trim().length >= 50 && s.trim().length <= 150);
            quotes.push(...sentences.slice(0, 2)); // Max 2 per paragraph
          }
        }
      }
    }
  }

  // Deduplicate and limit to 4
  const uniqueQuotes = Array.from(new Set(quotes.map(q => q.trim()).filter(Boolean)));
  
  // Filter out quotes that are too short or too long for Instagram
  const filtered = uniqueQuotes.filter(q => q.length >= 30 && q.length <= 200);
  
  return filtered.slice(0, 4);
}


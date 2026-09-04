/**
 * Smart quote-to-image matching utility
 * Matches quotes to images based on metadata, context, or distributes intelligently
 */

import { Blocks, getSelectedPullQuoteText } from '@/lib/posting/schemas';

interface QuoteWithMetadata {
  text: string;
  imageId?: string;
  room?: string;
  chapterIndex?: number;
}

interface ImageData {
  id: string;
  url: string;
  name?: string | null;
  room?: string | null;
}

/**
 * Extract quotes with metadata from expandedBlocks.
 *
 * SOURCE: the article's already-verified pull quote selections. Nothing else —
 * see the header of `./extractQuotes` for why the body-prose mining that used to
 * live here is gone. Same guarantee, same absence of a fallback: no verified
 * selection means no quote for that chapter, and `matchQuotesToImages` simply
 * has fewer quotes to place. `createImageSlideWithQuote` already renders the
 * photograph alone when it is handed none, so the slide loses its overlay
 * instead of gaining an invented line.
 *
 * The metadata (`imageId`, `chapterIndex`) is what this adds over `extractQuotes`
 * — it is how a quote lands on the photograph from the room it was said about
 * rather than on an arbitrary one.
 */
export function extractQuotesWithMetadata(expandedBlocks: Blocks | null | undefined): QuoteWithMetadata[] {
  if (!expandedBlocks) return [];

  const quotes: QuoteWithMetadata[] = [];

  // Top-level index, built by `syncPullQuotesFromChapters` from the chapter
  // selections plus the verified hook quote. Entries are objects on current
  // articles and bare strings on legacy ones; both carry verified text.
  if (Array.isArray(expandedBlocks.pullQuotes)) {
    expandedBlocks.pullQuotes.forEach((raw, index) => {
      const text = typeof raw === 'string' ? raw : (raw as { text?: unknown })?.text;
      if (typeof text === 'string' && text.trim()) {
        quotes.push({ text: text.trim(), chapterIndex: index });
      }
    });
  }

  // Per-chapter selections, resolved through the helper the article renders
  // through so the export cannot show a quote the page does not.
  if (Array.isArray(expandedBlocks.galleryChapters)) {
    expandedBlocks.galleryChapters.forEach((chapter, chapterIndex) => {
      const text = getSelectedPullQuoteText(chapter.pullQuote);
      if (!text) return;
      quotes.push({
        text: text.trim(),
        imageId: chapter.imageIds?.[0],
        chapterIndex,
      });
    });
  }

  // Deduplicate on text, keeping the first entry — the chapter-scoped one wins
  // over the top-level index only if it was seen first, which is fine: both carry
  // the same string, and the imageId is a placement hint, not a claim.
  const unique = Array.from(
    new Map(quotes.map(q => [q.text, q])).values()
  ).filter(q => q.text.length >= 30 && q.text.length <= 200);

  return unique.slice(0, 4);
}

/**
 * Match quotes to images intelligently
 * Returns a map of imageId -> quote, or distributes quotes across images
 */
export function matchQuotesToImages(
  quotes: Array<{ text: string; imageId?: string; room?: string; chapterIndex?: number }>,
  images: ImageData[]
): Map<string, string> {
  const matches = new Map<string, string>();
  const usedQuotes = new Set<number>();

  // First pass: Match quotes with explicit imageId
  quotes.forEach((quote, quoteIndex) => {
    if (quote.imageId) {
      const image = images.find(img => img.id === quote.imageId);
      if (image && !matches.has(image.id)) {
        matches.set(image.id, quote.text);
        usedQuotes.add(quoteIndex);
      }
    }
  });

  // Second pass: Match by room if available
  quotes.forEach((quote, quoteIndex) => {
    if (usedQuotes.has(quoteIndex)) return;
    
    if (quote.room) {
      const image = images.find(img => img.room === quote.room && !matches.has(img.id));
      if (image) {
        matches.set(image.id, quote.text);
        usedQuotes.add(quoteIndex);
      }
    }
  });

  // Third pass: Distribute remaining quotes intelligently
  // Place quotes on images 2, 5, 8, etc. (every 2-3 images, starting after 2nd)
  const remainingQuotes = quotes.filter((_, i) => !usedQuotes.has(i));
  let quoteIdx = 0;

  for (let i = 0; i < images.length && quoteIdx < remainingQuotes.length; i++) {
    // Place quote after 2nd, 5th, 8th image (i+1 % 3 === 2)
    if ((i + 1) % 3 === 2 && !matches.has(images[i].id)) {
      matches.set(images[i].id, remainingQuotes[quoteIdx].text);
      quoteIdx++;
    }
  }

  return matches;
}


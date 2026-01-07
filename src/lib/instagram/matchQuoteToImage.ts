/**
 * Smart quote-to-image matching utility
 * Matches quotes to images based on metadata, context, or distributes intelligently
 */

import { Blocks } from '@/lib/posting/schemas';

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
 * Extract quotes with metadata from expandedBlocks
 */
export function extractQuotesWithMetadata(expandedBlocks: Blocks | null | undefined): QuoteWithMetadata[] {
  if (!expandedBlocks) return [];

  const quotes: QuoteWithMetadata[] = [];

  // Extract from pullQuotes array
  if (expandedBlocks.pullQuotes && Array.isArray(expandedBlocks.pullQuotes)) {
    expandedBlocks.pullQuotes.forEach((quote, index) => {
      if (quote) {
        quotes.push({
          text: quote,
          chapterIndex: index,
        });
      }
    });
  }

  // Extract from galleryChapters with imageIds
  if (expandedBlocks.galleryChapters && Array.isArray(expandedBlocks.galleryChapters)) {
    expandedBlocks.galleryChapters.forEach((chapter, chapterIndex) => {
      // Pull quote from chapter
      if (chapter.pullQuote) {
        quotes.push({
          text: chapter.pullQuote,
          imageId: chapter.imageIds?.[0], // Use first image in chapter
          chapterIndex,
        });
      }
      
      // Extract quotable sentences from body
      if (chapter.body && Array.isArray(chapter.body)) {
        chapter.body.forEach((para) => {
          if (typeof para === 'string') {
            const sentences = para.split(/[.!?]+/).filter(s => {
              const trimmed = s.trim();
              return trimmed.length >= 50 && trimmed.length <= 150;
            });
            
            sentences.slice(0, 1).forEach((sentence) => {
              quotes.push({
                text: sentence.trim(),
                imageId: chapter.imageIds?.[0],
                chapterIndex,
              });
            });
          }
        });
      }
    });
  }

  // Deduplicate and limit to 4
  const uniqueQuotes = Array.from(
    new Map(quotes.map(q => [q.text.trim(), q])).values()
  ).filter(q => q.text.length >= 30 && q.text.length <= 200);

  return uniqueQuotes.slice(0, 4);
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


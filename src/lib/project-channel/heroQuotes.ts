import { getSelectedPullQuoteText } from '@/lib/posting/schemas';
import type { RoomTileData } from '@/lib/story/buildRoomTiles';

type QuoteRoom = Pick<RoomTileData, 'heroImage' | 'additionalImages' | 'pullQuoteSelection'>;

/** Select a few short, published designer quotations without rewriting them. */
export function selectHeroQuotes(images: { id: string }[], rooms: QuoteRoom[]): Map<string, string> {
  const associations = new Map<string, Set<string | null>>();
  for (const room of rooms) {
    const selected = getSelectedPullQuoteText(room.pullQuoteSelection);
    const quote = typeof selected === 'string' && selected.trim() && selected.length <= 180 ? selected : null;
    for (const photo of [room.heroImage, ...room.additionalImages]) {
      const candidates = associations.get(photo.id) ?? new Set<string | null>();
      candidates.add(quote);
      associations.set(photo.id, candidates);
    }
  }
  const quotes = new Map<string, string>();
  const selected = new Set<string>();
  for (const image of images) {
    const candidates = associations.get(image.id);
    // A photograph reused across conflicting chapters has no unambiguous quote.
    if (candidates?.size !== 1) continue;
    const quote = candidates.values().next().value;
    if (!quote || (!selected.has(quote) && selected.size >= 3)) continue;
    selected.add(quote);
    quotes.set(image.id, quote);
  }
  return quotes;
}

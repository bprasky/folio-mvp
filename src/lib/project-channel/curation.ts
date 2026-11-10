export type ChannelKind = 'feature' | 'space' | 'media' | 'credit';
export type ChannelTile = {
  id: string;
  kind: ChannelKind;
  title: string;
  imageUrl: string | null;
  href: string;
  roomKey?: string | null;
  pinned?: boolean;
  /** Explicit owner choices override automatic prominence. */
  prominence?: 'large' | 'medium' | 'small' | null;
};
export type CuratedTile = ChannelTile & { size: 'large' | 'medium' | 'small' };
const priority: Record<ChannelKind, number> = { feature: 100, media: 85, space: 50, credit: 20 };

/** Stable editorial defaults: media first, then featured publication, then diverse spaces.
 * No engagement gaming or unverified visual-quality guesses. Owner overrides win.
 */
export function curateChannelTiles(items: ChannelTile[]): CuratedTile[] {
  const ranked = items.map((item, index) => ({
    ...item,
    index,
    score: (item.pinned ? 1000 : 0) + priority[item.kind] + (item.imageUrl ? 10 : 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  const usedRooms = new Set<string>();
  const diverse: typeof ranked = [];
  const deferred: typeof ranked = [];
  for (const item of ranked) {
    if (item.roomKey && usedRooms.has(item.roomKey) && !item.pinned) deferred.push(item);
    else { diverse.push(item); if (item.roomKey) usedRooms.add(item.roomKey); }
  }
  const ordered = [...diverse, ...deferred];
  return ordered.map((item, index) => {
    const { score, index: originalIndex, ...tile } = item;
    return { ...tile, size: item.prominence || (index === 0 ? 'large' : index < 4 ? 'medium' : 'small') };
  });
}

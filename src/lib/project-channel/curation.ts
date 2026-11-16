export type ChannelKind = 'feature' | 'space' | 'media' | 'credit';
export type ChannelTile = {
  id: string;
  kind: ChannelKind;
  title: string;
  imageUrl: string | null;
  href: string | null;
  roomKey?: string | null;
  pinned?: boolean;
  /** Explicit owner choices override automatic prominence. */
  prominence?: 'large' | 'medium' | 'small' | null;
  /** Module thumbnails may come from published CDNs outside Next's image allowlist. */
  unoptimized?: boolean;
};
export type CuratedTile = ChannelTile & { size: 'large' | 'medium' | 'small' };
const priority: Record<ChannelKind, number> = { feature: 90, media: 100, space: 50, credit: 20 };

/** Stable editorial defaults: media first, then featured publication, then diverse spaces.
 * No engagement gaming or unverified visual-quality guesses. Owner overrides win.
 */
export function curateChannelTiles(items: ChannelTile[]): CuratedTile[] {
  const ranked = items.map((item, index) => ({
    ...item,
    index,
    score: (item.pinned ? 1000 : 0) + (item.imageUrl ? priority[item.kind] : item.kind === 'feature' ? 45 : 10),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  const usedRooms = new Set<string>();
  const diverse: typeof ranked = [];
  const deferred: typeof ranked = [];
  for (const item of ranked) {
    if (item.roomKey && usedRooms.has(item.roomKey) && !item.pinned) deferred.push(item);
    else { diverse.push(item); if (item.roomKey) usedRooms.add(item.roomKey); }
  }
  const ordered = [...diverse.filter(item => item.imageUrl || item.pinned), ...deferred,
    ...diverse.filter(item => !item.imageUrl && !item.pinned)];
  // Keep the publication in the opening group even with a large media library.
  // Explicit pins retain their positions; the hero CTA is always available too.
  const featureIndex = ordered.findIndex(item => item.kind === 'feature');
  const featureSlot = Math.max(1, ordered.filter(item => item.pinned).length);
  if (featureIndex > featureSlot && !ordered[featureIndex].pinned) {
    ordered.splice(featureSlot, 0, ordered.splice(featureIndex, 1)[0]);
  }
  let visualIndex = 0;
  return ordered.map((item, index) => {
    const { score: _score, index: _originalIndex, ...tile } = item;
    const visual = Boolean(tile.imageUrl);
    const defaultSize = visual ? (visualIndex++ === 0 ? 'large' : index < 5 ? 'medium' : 'small') : 'small';
    return { ...tile, size: visual ? item.prominence || defaultSize : 'small' };
  });
}

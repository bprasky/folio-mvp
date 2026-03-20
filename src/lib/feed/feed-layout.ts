export type FeedLayoutState = 'empty' | 'nascent' | 'mosaic';

export const FEED_LAYOUT_THRESHOLDS = {
  nascent: 1, // 1+ projects → featured stack
  mosaic: 4, // 4+ projects → mosaic activates
} as const;

export interface FeedProjectItem {
  id: string;
  title: string;
  heroImage: string | null;
  location: string | null;
  isEditorial: boolean;
  roomCount: number;
  saveCount: number;
}

export function getFeedLayoutState(
  publishedCount: number
): FeedLayoutState {
  if (publishedCount === 0) return 'empty';
  if (publishedCount < FEED_LAYOUT_THRESHOLDS.mosaic) return 'nascent';
  return 'mosaic';
}

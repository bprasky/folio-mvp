import { Blocks, getSelectedRoomLineText } from '@/lib/posting/schemas';
import { articleFolioLines } from '@/lib/posting/folioLines';

/** Published room selections, with authorship intact all the way to social output. */
export interface RoomTeaser {
  text: string;
  authorship: 'verbatim' | 'folio';
  imageId?: string;
  imageIds?: string[];
  chapterIndex?: number;
}

export function extractRoomTeasers(blocks: Blocks | null | undefined): RoomTeaser[] {
  if (!blocks) return [];
  if (blocks.galleryChapters?.length) {
    return blocks.galleryChapters.flatMap((chapter, chapterIndex) => {
      if (chapter.kind === 'gallery') return [];
      const selected = getSelectedRoomLineText(chapter.pullQuote)?.trim();
      const text = selected || articleFolioLines(chapter.title ?? 'Room', chapter.body ?? [])[0]?.text;
      if (!text) return [];
      return [{
        text,
        authorship: !selected || (typeof chapter.pullQuote === 'object' && chapter.pullQuote?.authorship === 'folio')
          ? 'folio' as const : 'verbatim' as const,
        imageId: chapter.imageIds?.[0],
        imageIds: chapter.imageIds,
        chapterIndex,
      }];
    });
  }
  // Legacy articles without chapters have only their verified quote index.
  return (blocks.pullQuotes ?? []).flatMap(raw => {
    const text = (typeof raw === 'string' ? raw : raw.text)?.trim();
    return text ? [{ text, authorship: 'verbatim' as const }] : [];
  });
}

export function matchRoomTeasersToImages(
  teasers: RoomTeaser[],
  images: Array<{ id: string }>,
): Map<string, RoomTeaser> {
  const matches = new Map<string, RoomTeaser>();
  for (const teaser of teasers) {
    const roomImageIds = teaser.imageIds ?? (teaser.imageId ? [teaser.imageId] : []);
    const image = images.find(image => roomImageIds.includes(image.id) && !matches.has(image.id));
    if (image) matches.set(image.id, teaser);
  }
  // Unscoped legacy selections may be distributed; a room-scoped line never
  // migrates to a different room when its photograph is absent from the export.
  const unscoped = teasers.filter(teaser => teaser.chapterIndex === undefined && !teaser.imageId);
  for (const image of images) {
    if (!matches.has(image.id) && unscoped.length) matches.set(image.id, unscoped.shift()!);
  }
  return matches;
}

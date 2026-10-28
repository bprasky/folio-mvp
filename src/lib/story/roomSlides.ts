import type { RoomTileData } from './buildRoomTiles';

export type RoomPhoto = { room: RoomTileData; image: RoomTileData['heroImage'] };
export type RoomSlide = { id: string; kind: 'story'; room: RoomTileData }
  | { id: string; kind: 'gallery'; photos: RoomPhoto[] };

export function orderedRooms(rooms: RoomTileData[], order: string[]): RoomTileData[] {
  const positions = new Map(order.map((id, index) => [id, index]));
  return rooms.filter(room => !!room.heroImage?.url).map((room, index) => ({ room, index }))
    .sort((a, b) => (positions.get(a.room.roomId) ?? order.length + a.index) - (positions.get(b.room.roomId) ?? order.length + b.index))
    .map(({ room }) => room);
}

export function hasRoomStory(room: RoomTileData): boolean {
  return !!room.editorialNarrative?.trim();
}

/** Distribute rather than leave a lonely final photograph: 5→3+2, 6→3+3. */
export function gallerySizes(count: number): number[] {
  if (count < 1) return [];
  const groups = Math.ceil(count / 4);
  const base = Math.floor(count / groups);
  return Array.from({ length: groups }, (_, index) => base + (index < count % groups ? 1 : 0));
}

export function buildRoomSlides(rooms: RoomTileData[], order: string[] = []): RoomSlide[] {
  const sorted = orderedRooms(rooms, order);
  const seenPhotos = new Set<string>();
  const photos: RoomPhoto[] = sorted.filter(room => !hasRoomStory(room))
    .flatMap(room => [room.heroImage, ...room.additionalImages].filter(image => {
      if (!image.url || seenPhotos.has(image.id)) return false;
      seenPhotos.add(image.id); return true;
    }).map(image => ({ room, image })));
  const galleries: RoomSlide[] = [];
  let offset = 0;
  for (const count of gallerySizes(photos.length)) {
    const group = photos.slice(offset, offset + count);
    galleries.push({ kind: 'gallery', id: `gallery-${group[0].image.id}`, photos: group });
    offset += count;
  }
  let inserted = false;
  return sorted.flatMap(room => {
    if (hasRoomStory(room)) return [{ kind: 'story', id: room.roomId, room } as RoomSlide];
    if (inserted) return [];
    inserted = true;
    return galleries;
  });
}

export function slideLabel(slide: RoomSlide): string {
  return slide.kind === 'story' ? slide.room.roomLabel : Array.from(new Set(slide.photos.map(photo => photo.room.roomLabel))).join(' · ');
}

/** Presentation only; the authored paragraph and its edit index stay untouched. */
export function capitalizeOpening(text: string): string {
  return text.trimStart().replace(new RegExp('^(\\P{L}*)(\\p{L})', 'u'), (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase());
}

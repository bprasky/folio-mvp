// Resolve a ProjectImage's room to a current Room, correctly and without guessing.
//
// ProjectImage carries TWO room signals that drift apart:
//   - `roomId`  — the real FK to Room (authoritative, user-managed).
//   - `room`    — a denormalized free-text string that different pipelines write
//                 differently (a room *type* like "bathroom", a display *label*
//                 like "Bathroom", or even a Room *UUID*). It goes stale after
//                 renames/merges because cascades match on the old name only.
//
// The editorial generator groups gallery chapters BY this room value and derives
// each chapter's title AND its images from it, so a wrong room value files a
// photo under the wrong heading (e.g. a bathroom photo under "Stairway").
//
// Resolution priority:
//   1. The authoritative FK (`roomId` → Room.name) whenever it is set.
//   2. The `room` string matched to a current Room.name — by normalized name, or
//      by UUID when the string is actually a Room id.
//   3. Otherwise keep the raw string. We NEVER pair a leftover image-room to a
//      leftover Room name by position: that by-elimination guess had no semantic
//      basis and is exactly what produced confident mislabels. An ungrouped raw
//      label is a far less harmful failure than a confidently wrong one.

export type RoomLike = { id: string; name: string };
export type ImageRoomLike = { room?: string | null; roomId?: string | null };

const normalizeForMatch = (s: string) => s.replace(/_/g, ' ').trim().toLowerCase();

/**
 * Build a resolver closure over a project's current rooms. Returns a function
 * that maps a single image to its current Room.name (or null / a raw fallback).
 */
export function buildRoomResolver(rooms: RoomLike[]): (img: ImageRoomLike) => string | null {
  const nameByNormalized = new Map(rooms.map((r) => [normalizeForMatch(r.name), r.name]));
  const nameById = new Map(rooms.map((r) => [r.id, r.name]));

  return function resolveRoomName(img: ImageRoomLike): string | null {
    // 1. Authoritative FK.
    if (img.roomId) {
      const byFk = nameById.get(img.roomId);
      if (byFk) return byFk;
    }
    if (!img.room) return null;
    // 2a. Denormalized string matches a current Room name.
    const byName = nameByNormalized.get(normalizeForMatch(img.room));
    if (byName) return byName;
    // 2b. The string is itself a Room UUID.
    const byId = nameById.get(img.room);
    if (byId) return byId;
    // 3. Keep the raw value — never guess by position.
    return img.room;
  };
}

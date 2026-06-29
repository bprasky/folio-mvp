/**
 * Finish Schedule locate stage — VALIDATION HARNESS ONLY.
 *
 * Pure wiring. Takes parsed rows + a projectId, resolves rooms, enumerates each
 * room's photos via the structured `Room.projectImages` relation, and runs the
 * existing targeted vision call to produce coordinates. Persists nothing. Reads
 * the DB read-only (findMany only). Implements Deliverable 2.
 *
 * Mirrors the invocation at
 *   src/app/api/posting/project/[projectId]/auto-tag/route.ts:244
 *     estimateProductCoordinates(image.url, productNames)
 * but deliberately does NOT use matchProductsToLocations(), which fabricates
 * evenly-spaced fallback coordinates for unmatched products. For locate we must
 * preserve the miss signal (a product absent from the detections is UNLOCATED),
 * because that is exactly what `isLocated` will key off in the gated step two.
 */

import { prisma } from '@/lib/prisma';
import { estimateProductCoordinates, type ProductLocation } from '@/lib/tagging/estimateProductCoordinates';
import type { ScheduleRow } from './parse';

export type LocatedProduct = {
  roomLabel: string;
  resolvedRoom: { id: string; name: string } | null;
  product: { description: string; vendor?: string; sku?: string; sourceRef: string };
  photoUsed: { id: string; url: string } | null;
  located: boolean;
  coordinate: { x: number; y: number; confidence: ProductLocation['confidence'] } | null;
  reason?: string;
};

export type LocateResult = {
  products: LocatedProduct[];
  unresolvedRoomLabels: string[];
  roomsMatched: number;
  roomsWithoutPhotos: string[];
};

type RoomRecord = {
  id: string;
  name: string;
  projectImages: Array<{ id: string; url: string }>;
};

export async function locateFromSchedule(projectId: string, rows: ScheduleRow[]): Promise<LocateResult> {
  // Read-only: project's rooms + their structured photos.
  const rooms = (await prisma.room.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      projectImages: { select: { id: true, url: true } },
    },
  })) as RoomRecord[];

  // Group parsed rows by room label.
  const byRoom = new Map<string, ScheduleRow[]>();
  for (const row of rows) {
    const key = row.roomLabel;
    if (!byRoom.has(key)) byRoom.set(key, []);
    byRoom.get(key)!.push(row);
  }

  const products: LocatedProduct[] = [];
  const unresolvedRoomLabels: string[] = [];
  const roomsWithoutPhotos: string[] = [];
  let roomsMatched = 0;

  for (const [roomLabel, roomRows] of byRoom) {
    const room = matchRoom(roomLabel, rooms);

    if (!room) {
      unresolvedRoomLabels.push(roomLabel);
      for (const r of roomRows) {
        products.push({
          roomLabel,
          resolvedRoom: null,
          product: toProduct(r),
          photoUsed: null,
          located: false,
          coordinate: null,
          reason: 'room label did not resolve to a Room',
        });
      }
      continue;
    }
    roomsMatched++;

    if (room.projectImages.length === 0) {
      roomsWithoutPhotos.push(room.name);
      for (const r of roomRows) {
        products.push({
          roomLabel,
          resolvedRoom: { id: room.id, name: room.name },
          product: toProduct(r),
          photoUsed: null,
          located: false,
          coordinate: null,
          reason: 'matched room has no photos',
        });
      }
      continue;
    }

    // One targeted vision call per photo, ranging over all the room's products.
    const descriptions = roomRows.map((r) => r.productDescription);
    const perPhotoDetections: Array<{ photo: { id: string; url: string }; detections: ProductLocation[] }> = [];
    for (const photo of room.projectImages) {
      let detections: ProductLocation[] = [];
      try {
        detections = await estimateProductCoordinates(photo.url, descriptions);
      } catch (err) {
        // estimateProductCoordinates already swallows errors to [], but guard anyway.
        detections = [];
      }
      perPhotoDetections.push({ photo, detections });
    }

    // For each product, take the best photo+coordinate across the room's photos.
    for (const r of roomRows) {
      let best: { photo: { id: string; url: string }; det: ProductLocation } | null = null;
      for (const { photo, detections } of perPhotoDetections) {
        const det = bestDetection(r.productDescription, detections);
        if (det && (!best || rank(det.confidence) > rank(best.det.confidence))) {
          best = { photo, det };
        }
      }

      if (best) {
        products.push({
          roomLabel,
          resolvedRoom: { id: room.id, name: room.name },
          product: toProduct(r),
          photoUsed: best.photo,
          located: true,
          coordinate: { x: best.det.x, y: best.det.y, confidence: best.det.confidence },
        });
      } else {
        products.push({
          roomLabel,
          resolvedRoom: { id: room.id, name: room.name },
          product: toProduct(r),
          photoUsed: null,
          located: false,
          coordinate: null,
          reason: 'product not detected in any of the room photos',
        });
      }
    }
  }

  return { products, unresolvedRoomLabels, roomsMatched, roomsWithoutPhotos };
}

function toProduct(r: ScheduleRow): LocatedProduct['product'] {
  return {
    description: r.productDescription,
    ...(r.vendor ? { vendor: r.vendor } : {}),
    ...(r.sku ? { sku: r.sku } : {}),
    sourceRef: r.sourceRef,
  };
}

function rank(c: ProductLocation['confidence']): number {
  return c === 'high' ? 3 : c === 'medium' ? 2 : 1;
}

/**
 * Tolerant room-name match: normalized exact, then containment, then token
 * overlap. Returns null when nothing clears the bar (reported as unresolved).
 */
function matchRoom(label: string, rooms: RoomRecord[]): RoomRecord | null {
  const target = norm(label);
  if (!target) return null;

  let exact = rooms.find((r) => norm(r.name) === target);
  if (exact) return exact;

  const contains = rooms.find((r) => {
    const n = norm(r.name);
    return n.includes(target) || target.includes(n);
  });
  if (contains) return contains;

  let best: RoomRecord | null = null;
  let bestScore = 0;
  for (const r of rooms) {
    const score = tokenOverlap(target, norm(r.name));
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

/**
 * Best detection for a product description, or null. Mirrors the spirit of the
 * fuzzy match in estimateProductCoordinates but returns NO fallback — absence is
 * the miss signal we must preserve.
 */
function bestDetection(description: string, detections: ProductLocation[]): ProductLocation | null {
  const target = norm(description);
  let best: ProductLocation | null = null;
  let bestScore = 0;
  for (const d of detections) {
    const score = tokenOverlap(target, norm(d.description));
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return bestScore >= 0.3 ? best : null;
}

function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlap(a: string, b: string): number {
  const wa = new Set(a.split(' ').filter((w) => w.length > 2));
  const wb = new Set(b.split(' ').filter((w) => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let overlap = 0;
  for (const w of wa) {
    if (wb.has(w)) overlap++;
    else {
      for (const x of wb) {
        if (x.includes(w) || w.includes(x)) { overlap += 0.5; break; }
      }
    }
  }
  return overlap / Math.max(wa.size, wb.size);
}

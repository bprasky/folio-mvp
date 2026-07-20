"use client";

import { useMemo } from "react";

export interface RoomPhotoImage {
  id: string;
  url: string;
  name?: string;
  /** Free-text room label (legacy). */
  room?: string | null;
  /** FK to the Room model — the reliable room match. */
  roomId?: string | null;
  displayOrder?: number | null;
}

function normalizeRoom(value: string): string {
  return value.toLowerCase().replace(/[_\s]+/g, " ").trim();
}

/**
 * Resolve the single reference photo shown alongside a question.
 *
 * - Room questions: the room's own photo, matched by `roomId` FK first (reliable),
 *   then by free-text room label as a fallback. Prefers the question's linked
 *   image when it belongs to the room, else the first image by displayOrder.
 * - Project ("about this project") questions: only a photo the question is
 *   genuinely linked to — otherwise nothing (the caller shows a warm fallback).
 *   A project question shouldn't borrow an unrelated room photo.
 */
export function computeRoomHeroImage(
  images: RoomPhotoImage[],
  currentRoom: { roomId: string; roomName: string } | null,
  linkedImageId?: string | null,
): RoomPhotoImage | null {
  const byDisplayOrder = [...images].sort((a, b) => {
    const ao = a.displayOrder;
    const bo = b.displayOrder;
    if (ao == null && bo == null) return 0;
    if (ao == null) return 1;
    if (bo == null) return -1;
    return ao - bo;
  });

  const isProject = !currentRoom || currentRoom.roomId === "project";

  if (isProject) {
    // Relevant if shown: only surface a photo the question points at.
    if (linkedImageId) {
      return byDisplayOrder.find((img) => img.id === linkedImageId) ?? null;
    }
    return null;
  }

  const roomImages = byDisplayOrder.filter((img) => {
    // Explicit assignment wins: a photo sorted into a room (roomId) belongs to
    // EXACTLY that room — no free-text bleed. Mirrors auto-tag's imageMatchesRoom
    // and the RoomGroupedMedia workspace, which both key off roomId alone. Without
    // this, a photo sorted elsewhere (or left uncategorized) whose stale legacy
    // `room` text still reads e.g. "kitchen" leaks in as the kitchen reference,
    // because assignImageToRoom updates roomId but never clears the old `room`.
    if (img.roomId) return img.roomId === currentRoom.roomId;
    // Legacy/unsorted photos (no roomId): fall back to the free-text `room` label,
    // matched by the room's id-in-string (generated images) or normalized name.
    return (
      !!img.room &&
      (img.room === currentRoom.roomId ||
        normalizeRoom(img.room) === normalizeRoom(currentRoom.roomName))
    );
  });

  if (roomImages.length === 0) return null;

  if (linkedImageId) {
    const linked = roomImages.find((img) => img.id === linkedImageId);
    if (linked) return linked;
  }

  return roomImages[0];
}

/**
 * The left column of the interview modal — a full-bleed room reference photo with
 * a glass caption pill. Renders a warm fallback surface when no relevant photo
 * exists so the two-column layout never collapses.
 */
export function RoomPhoto({
  images,
  currentRoom,
  linkedImageId,
}: {
  images: RoomPhotoImage[];
  currentRoom: { roomId: string; roomName: string } | null;
  linkedImageId?: string | null;
}) {
  const hero = useMemo(
    () => computeRoomHeroImage(images, currentRoom, linkedImageId),
    [images, currentRoom, linkedImageId],
  );

  const isProject = !currentRoom || currentRoom.roomId === "project";
  const captionLabel = isProject ? "This project" : currentRoom!.roomName;

  return (
    <div
      className="relative min-h-[560px] h-full w-full overflow-hidden"
      style={{ background: "var(--surface-elevated)" }}
    >
      {hero ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Bottom-left glass caption pill — gold dot + room name + reference. */}
          <div className="absolute bottom-5 left-5 z-10">
            <div className="glass-overlay flex items-center gap-2.5 rounded-full px-4 py-2">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--folio-gold-ornament)" }}
              />
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-folio-text-primary">
                {captionLabel}
              </span>
              <span className="text-[11px] uppercase tracking-[0.16em] text-folio-text-tertiary">
                Reference
              </span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

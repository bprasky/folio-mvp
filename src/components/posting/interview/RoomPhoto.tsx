"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
 * Resolve the ordered list of reference photos shown alongside a question.
 *
 * - Room questions: every photo that belongs to the room, matched by `roomId` FK
 *   first (reliable), then by free-text room label as a fallback, ordered by
 *   displayOrder. The question's linked image (if any) is floated to the front so
 *   the carousel opens on the most relevant shot.
 * - Project ("about this project") questions: only the photo the question is
 *   genuinely linked to — otherwise nothing (the caller shows a warm fallback).
 *   A project question shouldn't borrow an unrelated room photo.
 */
export function computeRoomHeroImages(
  images: RoomPhotoImage[],
  currentRoom: { roomId: string; roomName: string } | null,
  linkedImageId?: string | null,
): RoomPhotoImage[] {
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
      const found = byDisplayOrder.find((img) => img.id === linkedImageId);
      return found ? [found] : [];
    }
    return [];
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

  if (roomImages.length === 0) return [];

  // Float the linked image to the front so the carousel opens on it, but keep the
  // rest so it can still page through the whole room.
  if (linkedImageId) {
    const idx = roomImages.findIndex((img) => img.id === linkedImageId);
    if (idx > 0) {
      return [
        roomImages[idx],
        ...roomImages.slice(0, idx),
        ...roomImages.slice(idx + 1),
      ];
    }
  }

  return roomImages;
}

/**
 * Resolve the single lead reference photo. Thin wrapper over
 * {@link computeRoomHeroImages} — used by callers that only need to know whether a
 * photo exists (e.g. whether to mount the left column at all).
 */
export function computeRoomHeroImage(
  images: RoomPhotoImage[],
  currentRoom: { roomId: string; roomName: string } | null,
  linkedImageId?: string | null,
): RoomPhotoImage | null {
  return computeRoomHeroImages(images, currentRoom, linkedImageId)[0] ?? null;
}

/**
 * The left column of the interview modal — a full-bleed room reference photo with
 * a glass caption pill. When the room has more than one photo it becomes a
 * manually-paged gallery: click the photo (or the hover arrows) to advance, and
 * the dots show position. Advancing is a soft crossfade. Rotation is intentionally
 * manual, not timed, so the reference never moves on its own while the designer is
 * composing an answer.
 *
 * `onActiveImageChange` reports the currently-shown photo up to the modal, which
 * mirrors it as a blurred full-screen backdrop for a cinematic feel.
 */
export function RoomPhoto({
  images,
  currentRoom,
  linkedImageId,
  onActiveImageChange,
}: {
  images: RoomPhotoImage[];
  currentRoom: { roomId: string; roomName: string } | null;
  linkedImageId?: string | null;
  onActiveImageChange?: (image: RoomPhotoImage | null) => void;
}) {
  const roomImages = useMemo(
    () => computeRoomHeroImages(images, currentRoom, linkedImageId),
    [images, currentRoom, linkedImageId],
  );

  const count = roomImages.length;
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);

  // Reset to the first photo whenever the underlying set changes (room switch).
  // The parent also remounts via `key`, but this keeps state sane if it doesn't.
  useEffect(() => {
    setIndex(0);
  }, [currentRoom?.roomId, count]);

  const safeIndex = count > 0 ? index % count : 0;

  const goNext = useCallback(() => {
    setIndex((i) => (count > 0 ? (i + 1) % count : 0));
  }, [count]);
  const goPrev = useCallback(() => {
    setIndex((i) => (count > 0 ? (i - 1 + count) % count : 0));
  }, [count]);

  // Report the active photo up (for the modal's blurred backdrop). Kept in a ref
  // so a changing callback identity never churns the effect, and cleared on
  // unmount so the backdrop reverts when the left column goes away.
  const reportRef = useRef(onActiveImageChange);
  reportRef.current = onActiveImageChange;
  useEffect(() => {
    reportRef.current?.(roomImages[safeIndex] ?? null);
  }, [roomImages, safeIndex]);
  useEffect(() => () => reportRef.current?.(null), []);

  const isProject = !currentRoom || currentRoom.roomId === "project";
  const captionLabel = isProject ? "This project" : currentRoom!.roomName;
  const hasGallery = count > 1;

  if (count === 0) {
    return (
      <div
        className="relative min-h-[560px] h-full w-full overflow-hidden"
        style={{ background: "var(--surface-elevated)" }}
      />
    );
  }

  return (
    // Click the photo body to advance. Nested controls (arrows, dots) stopPropagation.
    // A title gives the affordance a tooltip; keyboard users page via the real
    // arrow/dot buttons below.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className={`relative min-h-[560px] h-full w-full overflow-hidden ${
        hasGallery ? "cursor-pointer" : ""
      }`}
      style={{ background: "var(--surface-elevated)" }}
      title={hasGallery ? "Click for next photo" : undefined}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={hasGallery ? goNext : undefined}
    >
      {/* Crossfade stack — all room photos are mounted and preloaded; only the
          active one is opaque, so paging is a smooth dissolve. */}
      {roomImages.map((img, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img.id}
          src={img.url}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === safeIndex ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Prev / next — revealed on hover, only when there's more than one photo. */}
      {hasGallery && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className={`glass-overlay absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-folio-text-primary transition-opacity duration-200 ${
              hovering ? "opacity-100" : "opacity-0"
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className={`glass-overlay absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-folio-text-primary transition-opacity duration-200 ${
              hovering ? "opacity-100" : "opacity-0"
            }`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Progress dots — bottom-right, so they never collide with the caption. */}
          <div className="absolute bottom-6 right-5 z-20 flex items-center gap-1.5">
            {roomImages.map((img, i) => (
              <button
                key={img.id}
                type="button"
                aria-label={`Show photo ${i + 1} of ${count}`}
                aria-current={i === safeIndex}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === safeIndex
                    ? "w-4 bg-white"
                    : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}

      {/* Bottom-left glass caption pill — gold dot + room name + reference. */}
      <div className="absolute bottom-5 left-5 z-10">
        <div className="glass-overlay flex items-center gap-2.5 rounded-full px-4 py-2">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: "var(--folio-gold-ornament)" }}
          />
          <span className="text-[length:var(--type-eyebrow)] font-medium uppercase tracking-[var(--ls-eyebrow)] text-folio-text-primary">
            {captionLabel}
          </span>
          <span className="text-[length:var(--type-eyebrow)] uppercase tracking-[var(--ls-eyebrow)] text-folio-text-tertiary">
            Reference
          </span>
        </div>
      </div>
    </div>
  );
}

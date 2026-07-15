"use client";

import { useMemo, useState } from "react";
import Lightbox from "@/components/article/images/Lightbox";

export interface StripImage {
  id: string;
  url: string;
  name?: string;
  room?: string | null;
  displayOrder?: number | null;
}

/**
 * Recompute, client-side and deterministically, the exact image set the
 * question generator saw when it wrote this room's questions. No new fields, no
 * model output. The photo and the question text triangulate — nothing here
 * states or implies what is in a photo.
 *
 * - Room questions: that room's ProjectImages by displayOrder, capped at 8.
 *   Mirrors generateAllRoomQuestions.ts (ProjectImage.room resolves to
 *   room.name) + generateRoomQuestions.ts slice(0, 8).
 * - Project-level questions (roomId 'project' / no room): the first 3 project
 *   images by displayOrder. Mirrors getInterviewQuestions.ts buildProjectGroup
 *   (orderBy displayOrder asc, take 3).
 * - Room with zero matching images: return nothing (caller renders nothing).
 */
export function computeRoomStripImages(
  images: StripImage[],
  currentRoom: { roomId: string; roomName: string } | null,
): StripImage[] {
  // displayOrder asc, nulls last — matches Postgres ASC NULLS LAST and the
  // generator's orderBy. Array.sort is stable, so equal keys keep input order.
  const byDisplayOrder = [...images].sort((a, b) => {
    const ao = a.displayOrder;
    const bo = b.displayOrder;
    if (ao == null && bo == null) return 0;
    if (ao == null) return 1;
    if (bo == null) return -1;
    return ao - bo;
  });

  // Project-level group (or the room-less flat flow): first 3 project-wide.
  if (!currentRoom || currentRoom.roomId === "project") {
    return byDisplayOrder.slice(0, 3);
  }

  // Room group: images whose stored `room` resolves to this room — the value is
  // either the Room.id or the room name (the generator resolves id→name; for the
  // current room, matching either form is equivalent). Capped at 8.
  return byDisplayOrder
    .filter(
      (img) =>
        !!img.room &&
        (img.room === currentRoom.roomId || img.room === currentRoom.roomName),
    )
    .slice(0, 8);
}

/**
 * A room-level horizontal photo strip. Renders the photos the model actually
 * saw for the current room, unadorned — no pins, labels, gradients, or text
 * over the image. Clicking a photo opens it full size.
 *
 * Keyed on roomId at the call site so it persists across questions within a room
 * and only changes at room boundaries.
 */
export function RoomPhotoStrip({
  images,
  currentRoom,
}: {
  images: StripImage[];
  currentRoom: { roomId: string; roomName: string } | null;
}) {
  const stripImages = useMemo(
    () => computeRoomStripImages(images, currentRoom),
    [images, currentRoom],
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Room with zero images: render nothing. Do not substitute.
  if (stripImages.length === 0) return null;

  return (
    <div className="px-8 md:px-16 pt-3 pb-1 shrink-0">
      <div className="flex gap-2 overflow-x-auto snap-x scrollbar-hide -mx-1 px-1">
        {stripImages.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="snap-start shrink-0 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            aria-label="View photo full size"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt=""
              className="h-28 w-auto object-contain rounded-md bg-surface-ground"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <Lightbox
          images={stripImages.map((img) => ({ url: img.url }))}
          openIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}

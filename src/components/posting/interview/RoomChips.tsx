"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import type { RoomProgressStatus } from "@/lib/editorial/roomPacing";

export interface RoomChip {
  roomId: string;
  roomName: string;
  status: RoomProgressStatus;
}

/**
 * The room-selector chip row across the top of the interview modal. The active
 * room reads as a gold-gradient chip with an italic Cormorant label and a check;
 * every other room is a quiet outlined pill with a dot (filled once complete).
 *
 * Non-interactive by design — the interview advances room-to-room through the
 * flow, and these chips mirror that state (matching the prior progress rail).
 */
export function RoomChips({
  rooms,
  currentRoomIndex,
}: {
  rooms: RoomChip[];
  currentRoomIndex: number;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Keep the active chip in view as the interview moves between rooms.
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [currentRoomIndex]);

  if (rooms.length === 0) return null;

  return (
    <div
      ref={railRef}
      className="flex-1 min-w-0 overflow-x-auto scrollbar-hide"
    >
      <div className="flex items-center gap-2 px-1 w-max">
        {rooms.map((room, idx) => {
          const isActive = idx === currentRoomIndex;
          const isComplete = room.status === "complete";

          if (isActive) {
            return (
              <div
                key={room.roomId}
                ref={activeRef}
                aria-current="step"
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5"
                style={{
                  background:
                    "linear-gradient(135deg, var(--folio-gold) 0%, var(--folio-gold-ornament) 100%)",
                  boxShadow: "var(--shadow-1)",
                }}
              >
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                <span
                  className="text-[length:var(--type-body)] italic leading-none text-white"
                  style={{ fontFamily: "var(--font-headline)" }}
                >
                  {room.roomName}
                </span>
              </div>
            );
          }

          return (
            <div
              key={room.roomId}
              className="flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5"
              style={{ borderColor: "var(--folio-border-strong)" }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={
                  isComplete
                    ? { background: "var(--folio-gold-ornament)" }
                    : {
                        border: "1px solid var(--folio-border-strong)",
                        background: "transparent",
                      }
                }
              />
              <span className="whitespace-nowrap text-xs font-medium text-folio-text-secondary">
                {room.roomName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

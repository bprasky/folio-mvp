"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { RoomProgressStatus } from "@/lib/editorial/roomPacing";

interface RoomProgressBarProps {
  rooms: Array<{
    roomId: string;
    roomName: string;
    status: RoomProgressStatus;
    answeredCount: number;
    totalQuestions: number;
  }>;
  currentRoomIndex: number;
  currentQuestionInRoom: number;
  totalQuestionsInRoom: number;
  /** Current round (1 = base questions, 2+ = follow-up rounds) */
  currentRound?: number;
  /** Number of base questions in the current room (for follow-up offset) */
  baseQuestionCount?: number;
}

// Folio palette (A4). Four visually distinct states.
const TAUPE = "#8A7E70";
const INK = "#1A1A1A";
const GOLD = "var(--folio-gold-ornament)";

// Edge fade so the rail reads as scrollable on both sides.
const FADE =
  "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)";

function StatusGlyph({ status }: { status: RoomProgressStatus }) {
  switch (status) {
    case "complete":
      return <span className="text-xs font-bold">&#10003;</span>; // check
    case "in_progress":
      return <span className="text-[10px] leading-none">&#9679;</span>; // filled dot (light on ink)
    case "skipped":
      return <span className="text-xs line-through">&#8709;</span>; // struck empty-set
    case "not_started":
    default:
      return <span className="text-xs">&#9675;</span>; // outline circle
  }
}

// Fill / outline / glyph tone per state. One 400ms transition carries the
// complete → gold fill when a room turns complete.
function pillStyle(status: RoomProgressStatus, isCurrent: boolean): CSSProperties {
  const base: CSSProperties = {
    borderWidth: 1,
    borderStyle: "solid",
    transition:
      "background-color 400ms ease, border-color 400ms ease, color 400ms ease",
    // Current-room distinction sits on top of the four states.
    boxShadow: isCurrent ? "0 0 0 2px var(--accent)" : "none",
  };

  switch (status) {
    case "complete":
      return { ...base, backgroundColor: GOLD, borderColor: GOLD, color: INK };
    case "in_progress":
      return { ...base, backgroundColor: INK, borderColor: INK, color: "#FFFFFF" };
    case "skipped":
      return {
        ...base,
        backgroundColor: "transparent",
        borderColor: TAUPE,
        borderStyle: "dashed",
        color: TAUPE,
        opacity: 0.6,
      };
    case "not_started":
    default:
      return {
        ...base,
        backgroundColor: "transparent",
        borderColor: TAUPE,
        color: TAUPE,
      };
  }
}

export function RoomProgressBar({
  rooms,
  currentRoomIndex,
  currentQuestionInRoom,
  totalQuestionsInRoom,
  currentRound = 1,
  baseQuestionCount = 0,
}: RoomProgressBarProps) {
  const currentRoom = rooms[currentRoomIndex];
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Recenter: keep the active pill centered as the designer moves through rooms,
  // so what remains stays visible to the right. Horizontal only (block: nearest).
  useEffect(() => {
    const room = rooms[currentRoomIndex];
    if (!room) return;
    pillRefs.current[room.roomId]?.scrollIntoView({
      inline: "center",
      behavior: "smooth",
      block: "nearest",
    });
  }, [currentRoomIndex, rooms]);

  return (
    <div className="flex items-center gap-3 min-w-0">
      {/* Scrollable pill rail with edge fades */}
      <div
        className="flex-1 min-w-0 overflow-x-auto scrollbar-hide"
        style={{ WebkitMaskImage: FADE, maskImage: FADE }}
      >
        <div className="flex items-center gap-1.5 px-1 w-max">
          {rooms.map((room, idx) => {
            const isProject = room.roomId === "project";
            const showSeparator = isProject && rooms.length > 1;
            const isCurrent = idx === currentRoomIndex;
            return (
              <div key={room.roomId} className="flex items-center gap-1.5 shrink-0">
                <button
                  ref={(el) => {
                    pillRefs.current[room.roomId] = el;
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                    isProject ? "italic" : ""
                  }`}
                  style={pillStyle(room.status, isCurrent)}
                  disabled
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <StatusGlyph status={room.status} />
                  <span
                    className={room.status === "skipped" ? "line-through" : ""}
                  >
                    {room.roomName}
                  </span>
                </button>
                {showSeparator && (
                  <span className="h-4 w-px bg-[var(--ridge-outer)] shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed counter — never scrolls, so the designer keeps their place. */}
      <div className="shrink-0 text-right leading-tight whitespace-nowrap">
        <div className="text-[11px] font-medium text-folio-text-primary">
          Room {currentRoomIndex + 1} of {rooms.length}
        </div>
        {currentRoom && (
          <div className="text-[11px] text-folio-text-secondary">
            {currentRoom.roomName} &mdash;{" "}
            {currentRound > 1 && baseQuestionCount > 0
              ? `Follow-up ${currentQuestionInRoom + 1 - baseQuestionCount} of ${totalQuestionsInRoom - baseQuestionCount}`
              : `${currentQuestionInRoom + 1} of ${totalQuestionsInRoom} questions`}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

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
}

function StatusIcon({ status }: { status: RoomProgressStatus }) {
  switch (status) {
    case "complete":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <path
            d="M2.5 6L5 8.5L9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "in_progress":
      return (
        <span className="block w-1.5 h-1.5 rounded-full bg-current shrink-0" />
      );
    case "skipped":
      return null;
    case "not_started":
    default:
      return (
        <span className="block w-1.5 h-1.5 rounded-full border border-current opacity-40 shrink-0" />
      );
  }
}

function pillClasses(status: RoomProgressStatus, isCurrent: boolean): string {
  const base = "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-200 shrink-0 leading-tight";

  if (isCurrent) {
    return `${base} bg-[var(--accent)] text-white border border-[var(--accent)]`;
  }

  switch (status) {
    case "complete":
      return `${base} bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/25`;
    case "skipped":
      return `${base} bg-transparent text-[var(--text-tertiary)] border border-[var(--border-default)] line-through`;
    case "in_progress":
      return `${base} bg-[var(--accent)]/5 text-[var(--text-secondary)] border border-[var(--accent)]/20`;
    case "not_started":
    default:
      return `${base} bg-transparent text-[var(--text-tertiary)] border border-[var(--border-default)]`;
  }
}

export function RoomProgressBar({
  rooms,
  currentRoomIndex,
  currentQuestionInRoom,
  totalQuestionsInRoom,
}: RoomProgressBarProps) {
  const currentRoom = rooms[currentRoomIndex];

  return (
    <div className="flex flex-col gap-1.5">
      {/* Room pills row — horizontally scrollable, no wrapping */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-0.5 py-0.5" style={{ maxHeight: '40px' }}>
        {rooms.map((room, idx) => (
          <div
            key={room.roomId}
            className={pillClasses(room.status, idx === currentRoomIndex)}
            role="listitem"
            aria-current={idx === currentRoomIndex ? "step" : undefined}
          >
            <StatusIcon status={idx === currentRoomIndex ? "in_progress" : room.status} />
            <span>{room.roomName}</span>
          </div>
        ))}
      </div>

      {/* Current room progress text */}
      {currentRoom && (
        <span className="text-[11px] text-[var(--text-secondary)] px-0.5 leading-tight">
          {currentRoom.roomName} &mdash; Q {currentQuestionInRoom + 1} of{" "}
          {totalQuestionsInRoom}
        </span>
      )}
    </div>
  );
}

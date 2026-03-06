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
        <span className="text-[var(--accent)] text-xs font-bold">&#10003;</span>
      );
    case "in_progress":
      return (
        <span className="text-[var(--accent)] text-xs">&#9684;</span>
      );
    case "skipped":
      return (
        <span className="text-[var(--text-tertiary)] text-xs line-through">&#8709;</span>
      );
    case "not_started":
    default:
      return (
        <span className="text-[var(--text-tertiary)] text-xs">&#9675;</span>
      );
  }
}

function statusBorderClass(status: RoomProgressStatus, isCurrent: boolean): string {
  if (isCurrent) return "border-[var(--accent)] bg-[var(--accent)]/5";
  switch (status) {
    case "complete":
      return "border-[var(--accent)]/40 bg-[var(--accent)]/5";
    case "in_progress":
      return "border-[var(--accent)]/20 bg-transparent";
    case "skipped":
      return "border-[var(--border-default)] bg-[var(--bg-elevated)]/50 opacity-60";
    case "not_started":
    default:
      return "border-[var(--border-default)] bg-transparent";
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
    <div className="flex flex-col gap-2">
      {/* Room pills row */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-1">
        {rooms.map((room, idx) => (
          <button
            key={room.roomId}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${statusBorderClass(room.status, idx === currentRoomIndex)}`}
            disabled
            aria-current={idx === currentRoomIndex ? "step" : undefined}
          >
            <StatusIcon status={room.status} />
            <span
              className={
                idx === currentRoomIndex
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)]"
              }
            >
              {room.roomName}
            </span>
          </button>
        ))}
      </div>

      {/* Current room progress text */}
      {currentRoom && (
        <span className="text-xs text-[var(--text-secondary)] px-1">
          {currentRoom.roomName} &mdash; {currentQuestionInRoom + 1} of{" "}
          {totalQuestionsInRoom} questions
        </span>
      )}
    </div>
  );
}

"use client";

import type { RoomCardData } from "@/lib/editorial/buildRoomCards";

interface Props {
  roomCards: RoomCardData[];
  onScrollToRoom: (roomSlug: string) => void;
  activeRoomSlug?: string | null;
}

export function RoomThumbnailStrip({ roomCards, onScrollToRoom, activeRoomSlug }: Props) {
  if (roomCards.length === 0) return null;

  return (
    <div className="hidden lg:flex items-center gap-3 overflow-x-auto px-2 py-2 no-scrollbar">
      {roomCards.map((card) => {
        const isActive = activeRoomSlug === card.roomSlug;
        return (
          <button
            key={card.roomId}
            onClick={() => onScrollToRoom(card.roomSlug)}
            className={`story-glass-thumb flex items-center gap-2 shrink-0 ${
              isActive ? "active" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.heroImage.url}
              alt={card.roomLabel}
              className="w-8 h-8 rounded-md object-cover"
            />
            <span className="text-[var(--type-meta)] font-medium text-[rgba(255,252,248,0.9)] whitespace-nowrap font-[var(--font-body)]">
              {card.roomLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
